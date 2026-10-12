import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import casesJson from '@/lib/scoring/cases.json'
import * as scoring from '@/lib/scoring'
import {
  AGREEMENT_LABELS,
  READING_TYPES,
  STANDINGS,
  agreementLabel,
  agreementValue,
  changeBetween,
  cutoffsSchema,
  formatTenths,
  itemLevel,
  levelTenths,
  parseTenths,
  personLevel,
  personSum,
  scaleLevel,
  standingFor,
  type AgreementLabel,
  type Cutoffs,
  type ReadingType,
  type Standing,
} from '@/lib/scoring'

/**
 * The measurement rules of handoff section 7. Two kinds of check:
 *
 * - every case in lib/scoring/cases.json, whose expected values were computed apart from this code with
 *   exact rationals; the SQL suite reads the same file, so the two implementations agree case by case;
 * - properties over every small group, where the integer comparisons must give what an exact rational
 *   computation gives, and over every shown level, where standing and change must follow the cut-off row
 *   they are handed rather than any number of their own.
 */

// ---- the case file, parsed rather than cast ----

const answer = z.number().int().min(1).max(5)
const tenthsText = z.string().regex(/^-?\d+\.\d$/)
const name = z.string().min(1)

const casesSchema = z.strictObject({
  about: z.string().min(1),
  cutoffs: z.unknown(),
  levels: z.array(z.strictObject({ name, persons: z.array(z.array(answer).min(1)).min(1), level: tenthsText })).min(1),
  items: z.array(z.strictObject({ name, answers: z.array(answer).min(1), level: tenthsText })).min(1),
  agreement: z
    .array(
      z.strictObject({
        name,
        items: z.number().int().positive(),
        persons: z.array(z.array(answer)).min(2),
        label: z.enum(AGREEMENT_LABELS),
        value: z.string().regex(/^\d\.\d{4}$/),
      }),
    )
    .min(1),
  standing: z
    .array(
      z.strictObject({
        name,
        readingType: z.enum(READING_TYPES),
        level: tenthsText,
        agreement: z.enum(AGREEMENT_LABELS),
        standing: z.enum(STANDINGS),
      }),
    )
    .min(1),
  change: z
    .array(
      z
        .strictObject({ name, from: tenthsText, to: tenthsText, shows: z.boolean(), delta: tenthsText.optional() })
        .refine((c) => c.shows === (c.delta !== undefined), 'a change that shows has a delta, and only then'),
    )
    .min(1),
  themes: z.array(z.strictObject({ name, items: z.array(answer).length(2), level: tenthsText })).min(1),
})

const cases = casesSchema.parse(casesJson)
const cutoffs = cutoffsSchema.parse(cases.cutoffs)

// ---- exact rationals, for the reference computations ----

type Q = { n: bigint; d: bigint }
const abs = (a: bigint) => (a < 0n ? -a : a)
const gcd = (a: bigint, b: bigint): bigint => {
  a = abs(a)
  b = abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1n
}
const q = (n: bigint | number, d: bigint | number = 1n): Q => {
  let nn = BigInt(n)
  let dd = BigInt(d)
  if (dd < 0n) [nn, dd] = [-nn, -dd]
  const g = gcd(nn, dd)
  return { n: nn / g, d: dd / g }
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n)
const cmp = (a: Q, b: Q) => {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}
const toNumber = (a: Q) => Number(a.n) / Number(a.d)

/** Round half up to tenths, by quotient and remainder */
function exactTenths(mean: Q): number {
  const scaled = mean.n * 10n
  let tenths = scaled / mean.d
  if (2n * (scaled % mean.d) >= mean.d) tenths += 1n
  return Number(tenths)
}

/** Agreement the textbook way: person means, their mean, squared deviations over n − 1 */
function exactAgreement(sums: readonly number[], items: number): Q {
  const p = sums.map((s) => q(s, items))
  const mean = div(p.reduce(add, q(0)), q(sums.length))
  const squares = p.reduce((acc, x) => {
    const d = sub(x, mean)
    return add(acc, mul(d, d))
  }, q(0))
  const raw = sub(q(1), div(div(squares, q(sums.length - 1)), q(2)))
  return cmp(raw, q(0)) < 0 ? q(0) : raw
}

function exactLabel(value: Q, high: number, low: number): AgreementLabel {
  if (cmp(value, q(high, 100)) > 0) return 'high'
  if (cmp(value, q(low, 100)) <= 0) return 'low'
  return 'medium'
}

/** Every multiset of n values from lo to hi, as non-decreasing arrays */
function* multisets(n: number, lo: number, hi: number, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === n) {
    yield prefix
    return
  }
  const from = prefix.length ? (prefix[prefix.length - 1] as number) : lo
  for (let v = from; v <= hi; v++) yield* multisets(n, lo, hi, [...prefix, v])
}

/** A small seeded generator, so a failure repeats (mulberry32) */
function seeded(seed: number) {
  let a = seed >>> 0
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sumsOf = (persons: readonly (readonly number[])[]) => persons.map(personSum)

// ---- the shared cases ----

describe('cases.json', () => {
  it('parses, and its cut-offs are a valid row', () => {
    expect(cutoffs.version).toBe(1)
  })

  it('names every case once', () => {
    const names = [cases.levels, cases.items, cases.agreement, cases.standing, cases.change, cases.themes].flat().map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('covers the group sizes and boundaries the rules turn on', () => {
    const sizes = new Set(cases.levels.map((c) => c.persons.length))
    for (const n of [4, 5, 8, 15]) expect(sizes.has(n)).toBe(true)

    const agreement = (value: string, label: AgreementLabel) => cases.agreement.filter((c) => c.value === value && c.label === label)
    expect(agreement('0.7000', 'medium').length).toBeGreaterThan(0)
    expect(agreement('0.5000', 'low').length).toBeGreaterThan(0)
    expect(agreement('0.0000', 'low').length).toBeGreaterThan(0)
    expect(agreement('1.0000', 'high').length).toBeGreaterThan(0)
    expect(cases.agreement.some((c) => c.label === 'high' && c.value > '0.7000' && c.value <= '0.7010')).toBe(true)
    expect(cases.agreement.some((c) => c.label === 'medium' && c.value > '0.5000' && c.value <= '0.5010')).toBe(true)
    for (const items of [2, 3]) expect(cases.agreement.some((c) => c.items === items)).toBe(true)

    const standing = (readingType: ReadingType, level: string) => cases.standing.some((c) => c.readingType === readingType && c.level === level)
    for (const level of ['2.9', '3.0', '3.3', '3.4']) expect(standing('higher', level)).toBe(true)
    for (const level of ['2.7', '2.8', '3.4', '3.5']) expect(standing('lower', level)).toBe(true)
    for (const readingType of READING_TYPES) {
      expect(cases.standing.some((c) => c.readingType === readingType && c.agreement === 'low')).toBe(true)
    }

    const delta = (c: { from: string; to: string }) => parseTenths(c.to) - parseTenths(c.from)
    expect(cases.change.some((c) => delta(c) === 5 && !c.shows)).toBe(true)
    expect(cases.change.some((c) => delta(c) === 6 && c.shows)).toBe(true)
    expect(cases.change.some((c) => delta(c) === -6 && c.shows)).toBe(true)
    expect(cases.change.some((c) => delta(c) === 0 && !c.shows)).toBe(true)
  })

  describe('levels', () => {
    for (const c of cases.levels) {
      it(c.name, () => expect(formatTenths(scaleLevel(c.persons))).toBe(c.level))
    }
  })

  describe('item levels', () => {
    for (const c of cases.items) {
      it(c.name, () => expect(formatTenths(itemLevel(c.answers))).toBe(c.level))
    }
  })

  describe('agreement', () => {
    for (const c of cases.agreement) {
      it(c.name, () => {
        for (const person of c.persons) expect(person).toHaveLength(c.items)
        const sums = sumsOf(c.persons)
        expect(agreementLabel(sums, c.items, cutoffs)).toBe(c.label)
        // the value is rounded half up to four decimals in the file; the stored number lies within half a step
        expect(Math.abs(agreementValue(sums, c.items) - Number(c.value))).toBeLessThanOrEqual(0.00005 + 1e-12)
      })
    }
  })

  describe('standing', () => {
    for (const c of cases.standing) {
      it(c.name, () => expect(standingFor(c.readingType, parseTenths(c.level), c.agreement, cutoffs)).toBe(c.standing))
    }
  })

  describe('change', () => {
    for (const c of cases.change) {
      it(c.name, () => {
        const change = changeBetween(parseTenths(c.from), parseTenths(c.to), cutoffs)
        expect(change.kind === 'shown').toBe(c.shows)
        if (change.kind === 'shown') expect(formatTenths(change.deltaTenths)).toBe(c.delta)
      })
    }
  })

  describe('scan themes, one person', () => {
    for (const c of cases.themes) {
      it(c.name, () => expect(formatTenths(personLevel(c.items))).toBe(c.level))
    }
  })
})

// ---- properties ----

describe('level', () => {
  it('rounds every mean of up to 60 answers half up, as an exact computation does', () => {
    for (let count = 1; count <= 60; count++) {
      for (let total = count; total <= 5 * count; total++) {
        expect(levelTenths(total, count)).toBe(exactTenths(q(total, count)))
      }
    }
  })

  it('is the mean of person means, for random groups of 1 to 15 on 1 to 3 items', () => {
    const random = seeded(7)
    for (let run = 0; run < 2000; run++) {
      const n = 1 + Math.floor(random() * 15)
      const items = 1 + Math.floor(random() * 3)
      const persons = Array.from({ length: n }, () => Array.from({ length: items }, () => 1 + Math.floor(random() * 5)))
      const mean = div(persons.map((p) => q(personSum(p), items)).reduce(add, q(0)), q(n))
      expect(scaleLevel(persons)).toBe(exactTenths(mean))
    }
  })

  it('writes and reads tenths', () => {
    expect(formatTenths(39)).toBe('3.9')
    expect(formatTenths(50)).toBe('5.0')
    expect(formatTenths(0)).toBe('0.0')
    expect(formatTenths(-6)).toBe('-0.6')
    expect(formatTenths(-40)).toBe('-4.0')
    for (let t = -50; t <= 50; t++) expect(parseTenths(formatTenths(t))).toBe(t)
    expect(parseTenths('-0.0')).toBe(0)
    expect(Object.is(parseTenths('-0.0'), -0)).toBe(false)
  })

  it('refuses what is not an answer or not a group', () => {
    for (const bad of [[0], [6], [3.5], [Number.NaN], []]) expect(() => personSum(bad)).toThrow(RangeError)
    expect(() => scaleLevel([])).toThrow(RangeError)
    expect(() => scaleLevel([[4, 4, 4], [4, 4]])).toThrow(RangeError)
    expect(() => itemLevel([])).toThrow(RangeError)
    expect(() => levelTenths(3, 4)).toThrow(RangeError)
    expect(() => levelTenths(21, 4)).toThrow(RangeError)
    expect(() => levelTenths(4, 0)).toThrow(RangeError)
    expect(() => formatTenths(3.5)).toThrow(RangeError)
    for (const bad of ['3', '3.75', '', '3.', '.5', '3,9', ' 3.9']) expect(() => parseTenths(bad)).toThrow(RangeError)
  })
})

describe('agreement', () => {
  // version 1, others a pilot might choose, and the extremes the schema allows
  const pairs: Array<[number, number]> = [
    [70, 50],
    [80, 60],
    [55, 45],
    [75, 25],
    [99, 98],
    [2, 1],
  ]

  function checkGroup(sums: number[], items: number) {
    const exact = exactAgreement(sums, items)
    for (const [high, low] of pairs) {
      const label = agreementLabel(sums, items, { agreementHigh: high / 100, agreementLow: low / 100 })
      if (label !== exactLabel(exact, high, low)) {
        throw new Error(`sums ${sums.join(',')} on ${items} items with ${high}/${low}: ${label}, exactly ${exactLabel(exact, high, low)}`)
      }
    }
    const value = agreementValue(sums, items)
    if (Math.abs(value - toNumber(exact)) > 1e-12) throw new Error(`sums ${sums.join(',')}: value ${value}, exactly ${toNumber(exact)}`)
  }

  it('gives the exact label for every group of 2 to 6 on 3 items, under several cut-off rows', () => {
    let groups = 0
    for (let n = 2; n <= 6; n++) {
      for (const sums of multisets(n, 3, 15)) {
        checkGroup(sums, 3)
        groups++
      }
    }
    expect(groups).toBe(27118)
  })

  it('gives the exact label for every group of 2 to 7 on 2 items (a scan theme)', () => {
    let groups = 0
    for (let n = 2; n <= 7; n++) {
      for (const sums of multisets(n, 2, 10)) {
        checkGroup(sums, 2)
        groups++
      }
    }
    expect(groups).toBe(11430)
  })

  it('gives the exact label for random groups of 8 to 15', () => {
    const random = seeded(42)
    for (let run = 0; run < 3000; run++) {
      const items = random() < 0.5 ? 2 : 3
      const n = 8 + Math.floor(random() * 8)
      checkGroup(Array.from({ length: n }, () => items + Math.floor(random() * (4 * items + 1))), items)
    }
  })

  it('does not depend on the order of the respondents', () => {
    const sums = [13, 11, 12, 13, 7]
    const label = agreementLabel(sums, 3, cutoffs)
    expect(agreementLabel([...sums].reverse(), 3, cutoffs)).toBe(label)
    expect(agreementValue([...sums].reverse(), 3)).toBe(agreementValue(sums, 3))
  })

  it('gives high agreement for identical answers, whatever the answer', () => {
    for (const items of [2, 3]) {
      for (let s = items; s <= 5 * items; s++) {
        for (const n of [2, 4, 8, 15]) {
          expect(agreementLabel(Array(n).fill(s), items, cutoffs)).toBe('high')
          expect(agreementValue(Array(n).fill(s), items)).toBe(1)
        }
      }
    }
  })

  it('refuses fewer than two respondents and sums that are not on the scale', () => {
    expect(() => agreementLabel([], 3, cutoffs)).toThrow(RangeError)
    expect(() => agreementLabel([12], 3, cutoffs)).toThrow(RangeError)
    expect(() => agreementValue([12], 3)).toThrow(RangeError)
    expect(() => agreementLabel([2, 12], 3, cutoffs)).toThrow(RangeError)
    expect(() => agreementLabel([16, 12], 3, cutoffs)).toThrow(RangeError)
    expect(() => agreementLabel([12.5, 12], 3, cutoffs)).toThrow(RangeError)
    expect(() => agreementLabel([12, 12], 0, cutoffs)).toThrow(RangeError)
  })
})

describe('standing', () => {
  const alternative: Cutoffs = {
    version: 2,
    agreementHigh: 0.75,
    agreementLow: 0.45,
    higherPriorityBelow: 3.2,
    higherStrengthFrom: 3.8,
    lowerPriorityFrom: 3.0,
    lowerStrengthBelow: 2.5,
    changeMargin: 0.3,
  }

  /** The first level, in tenths, at which a walk up the scale reaches each standing */
  function firsts(readingType: ReadingType, row: Cutoffs): Map<Standing, number> {
    const seen = new Map<Standing, number>()
    for (let level = 10; level <= 50; level++) {
      const s = standingFor(readingType, level, 'high', row)
      if (!seen.has(s)) seen.set(s, level)
      expect(standingFor(readingType, level, 'medium', row)).toBe(s)
    }
    return seen
  }

  for (const row of [cutoffs, alternative]) {
    it(`follows the cut-off row it is given (version ${row.version})`, () => {
      expect(cutoffsSchema.safeParse(row).success).toBe(true)
      const tenths = (value: number) => Math.round(value * 10)
      // higher is better: priority, then watch from the priority cut-off, then strength
      expect([...firsts('higher', row)]).toEqual([
        ['priority', 10],
        ['watch', tenths(row.higherPriorityBelow)],
        ['strength', tenths(row.higherStrengthFrom)],
      ])
      // lower is better: strength, then watch from the strength cut-off, then priority
      expect([...firsts('lower', row)]).toEqual([
        ['strength', 10],
        ['watch', tenths(row.lowerStrengthBelow)],
        ['priority', tenths(row.lowerPriorityFrom)],
      ])
    })
  }

  it('applies the order: descriptive, then conditional, then low agreement, then the table', () => {
    for (let level = 10; level <= 50; level++) {
      for (const agreement of AGREEMENT_LABELS) {
        expect(standingFor('descriptive', level, agreement, cutoffs)).toBe('fact')
        expect(standingFor('conditional', level, agreement, cutoffs)).toBe('read_with')
      }
      expect(standingFor('higher', level, 'low', cutoffs)).toBe('views_differ')
      expect(standingFor('lower', level, 'low', cutoffs)).toBe('views_differ')
    }
  })

  it('refuses a level that is not shown tenths', () => {
    for (const bad of [9, 51, 34.5, Number.NaN]) expect(() => standingFor('higher', bad, 'high', cutoffs)).toThrow(RangeError)
  })
})

describe('change', () => {
  it('shows from the margin, either way, and is within below it', () => {
    for (const margin of [0.6, 0.3, 1.0]) {
      const m = Math.round(margin * 10)
      for (let from = 10; from <= 50; from++) {
        for (let to = 10; to <= 50; to++) {
          const change = changeBetween(from, to, { changeMargin: margin })
          if (Math.abs(to - from) >= m) expect(change).toEqual({ kind: 'shown', deltaTenths: to - from })
          else expect(change).toEqual({ kind: 'within' })
        }
      }
    }
  })

  it('refuses a level that is not shown tenths', () => {
    expect(() => changeBetween(9, 30, cutoffs)).toThrow(RangeError)
    expect(() => changeBetween(30, 32.5, cutoffs)).toThrow(RangeError)
  })
})

describe('cut-offs', () => {
  const issues = (over: Record<string, unknown>) => {
    const parsed = cutoffsSchema.safeParse({ ...cutoffs, ...over })
    return parsed.success ? [] : parsed.error.issues.map((i) => i.path.join('.'))
  }

  it('accepts version 1', () => {
    expect(issues({})).toEqual([])
  })

  it('refuses cut-offs out of order', () => {
    expect(issues({ agreementLow: 0.7 })).toEqual(['agreementLow'])
    expect(issues({ agreementLow: 0.8 })).toEqual(['agreementLow'])
    expect(issues({ higherPriorityBelow: 3.4 })).toEqual(['higherPriorityBelow'])
    expect(issues({ lowerStrengthBelow: 3.6 })).toEqual(['lowerStrengthBelow'])
  })

  it('refuses values out of range or between the steps the rules compare in', () => {
    expect(issues({ agreementHigh: 1 })).toContain('agreementHigh')
    expect(issues({ agreementLow: 0 })).toContain('agreementLow')
    expect(issues({ higherPriorityBelow: 1 })).toContain('higherPriorityBelow')
    expect(issues({ lowerPriorityFrom: 5 })).toContain('lowerPriorityFrom')
    expect(issues({ changeMargin: 4 })).toContain('changeMargin')
    expect(issues({ agreementHigh: 0.705 })).toContain('agreementHigh')
    expect(issues({ higherStrengthFrom: 5.5 })).toContain('higherStrengthFrom')
    expect(issues({ lowerPriorityFrom: 0.5 })).toContain('lowerPriorityFrom')
    expect(issues({ higherPriorityBelow: 2.95 })).toContain('higherPriorityBelow')
    expect(issues({ changeMargin: 0 })).toContain('changeMargin')
    expect(issues({ changeMargin: 0.65 })).toContain('changeMargin')
    expect(issues({ version: 0 })).toContain('version')
    expect(issues({ version: 1.5 })).toContain('version')
    expect(issues({ agreementHigh: '0.70' })).toContain('agreementHigh')
  })

  it('accepts values whose binary form is not exact, such as 0.29 and 0.57', () => {
    expect(issues({ agreementHigh: 0.57, agreementLow: 0.29 })).toEqual([])
  })

  it('no export holds a row of cut-off values: they are data (CLAUDE.md, Model as data)', () => {
    for (const value of Object.values(scoring)) {
      expect(typeof value === 'number').toBe(false)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        expect(Object.keys(value)).not.toContain('agreementHigh')
      }
    }
  })
})
