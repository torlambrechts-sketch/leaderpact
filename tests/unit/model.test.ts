import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { copyFindings } from '@/lib/i18n/copy-rules'
import { Model, parseModel } from '@/lib/model/schema'
import { bodyHash, canonicalJson, OUTPUT, readFiles, render, versionBodies } from '@/scripts/seed/model.mjs'

/**
 * The model as data (CLAUDE.md; REUSE 4.10): the files in data/ pass lib/model/schema.ts, every rule
 * there refuses a broken copy, and the committed 0004 is exactly what scripts/seed/model.mjs makes.
 */
const model = parseModel(readFiles())

/** A copy of the valid model with one thing broken, and the messages the schema gives for it */
function broken(mutate: (m: Model) => void): string {
  const copy = structuredClone(model)
  mutate(copy)
  const r = Model.safeParse(copy)
  if (r.success) return ''
  return r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
}

const at = <T>(list: T[], i: number): T => {
  const v = list[i]
  if (v === undefined) throw new Error(`no element ${i}`)
  return v
}
const item = (m: Model, code: string) => {
  const found = m.bank.items.find((x) => x.code === code)
  if (!found) throw new Error(`no item ${code}`)
  return found
}
const factor = (m: Model, key: string) => {
  const found = m.bank.factors.find((f) => f.key === key)
  if (!found) throw new Error(`no scale ${key}`)
  return found
}

describe('the data files', () => {
  it('hold 21 scales and 3 outcomes, 96 items, 72 of them core, and a scan of 12', () => {
    expect(model.bank.factors.filter((f) => f.layer !== 'outcomes')).toHaveLength(21)
    expect(model.bank.factors.filter((f) => f.layer === 'outcomes')).toHaveLength(3)
    expect(model.bank.items).toHaveLength(96)
    expect(model.bank.items.filter((x) => x.use === 'core')).toHaveLength(72)
    expect(model.scan.items.map((s) => s.code)).toEqual([
      'clear_purpose.1', 'team_tasks.1', 'meeting_goals.1', 'focus.1', 'dialogue.2', 'dialogue.3',
      'behavioural_integration.1', 'behavioural_integration.2', 'psychological_safety.1', 'trust.1',
      'direction_alignment_and_commitment.1', 'direction_alignment_and_commitment.3',
    ])
  })

  it('keep the copy rules in every name and text, the instruments included', () => {
    const texts = [
      ...model.instruments.map((i) => i.name),
      ...model.bank.factors.map((f) => f.name),
      ...model.bank.items.map((x) => x.text),
      ...model.scan.themes.map((t) => t.name),
      ...model.plans.map((p) => p.name),
    ]
    expect(texts.flatMap(copyFindings)).toEqual([])
  })

  it('name the instruments as handoff 10 does', () => {
    expect(model.instruments.map((i) => i.name)).toEqual(['Leadership Team Scan', 'Full diagnostic', 'Pulse'])
  })
})

describe('each rule refuses a broken copy', () => {
  it('a scale with two core items', () => {
    expect(broken((m) => (item(m, 'clear_purpose.3').use = 'candidate'))).toMatch(/clear_purpose has 2 core and 2 candidate/)
  })

  it('an outcome with an evidence rating, and a scale without one', () => {
    expect(broken((m) => (factor(m, 'viability').evidence = 'strong'))).toMatch(/an outcome carries no evidence rating/)
    expect(broken((m) => (factor(m, 'trust').evidence = null))).toMatch(/a scale carries an evidence rating/)
  })

  it('a layer count that is not 6, 11, 4 and 3', () => {
    const issues = broken((m) => (factor(m, 'norms').layer = 'processes'))
    expect(issues).toMatch(/12 in processes/)
    expect(issues).toMatch(/3 in states/)
  })

  it('a missing scale, and ordinals out of order', () => {
    expect(broken((m) => m.bank.factors.pop())).toMatch(/23 scales and outcomes/)
    expect(broken((m) => (factor(m, 'trust').ordinal = 18))).toMatch(/ordinal 18 at place 19/)
  })

  it('an item coded out of its place, a duplicated code, and an item under no scale', () => {
    expect(broken((m) => (item(m, 'focus.2').code = 'focus.5'))).toMatch(/item 2 of focus is coded focus\.5/)
    expect(broken((m) => (item(m, 'focus.2').code = 'focus.1'))).toMatch(/item focus\.1 appears twice/)
    expect(broken((m) => (item(m, 'focus.2').factor = 'nothing'))).toMatch(/no scale nothing/)
  })

  it('items listed out of scale order', () => {
    expect(
      broken((m) => {
        const [first] = m.bank.items.splice(0, 1)
        if (first) m.bank.items.push(first)
      }),
    ).toMatch(/out of place/)
  })

  it('a duplicated scan item, a candidate in the scan, and an item not in the bank', () => {
    expect(broken((m) => (at(m.scan.items, 1).code = 'clear_purpose.1'))).toMatch(/clear_purpose\.1 is asked twice/)
    expect(broken((m) => (at(m.scan.items, 0).code = 'clear_purpose.4'))).toMatch(/candidate; the scan asks core items only/)
    expect(broken((m) => (at(m.scan.items, 0).code = 'clear_purpose.9'))).toMatch(/not in bank version 1/)
  })

  it('a theme with three items, and a scan out of order', () => {
    expect(broken((m) => (at(m.scan.items, 2).theme = 'purpose_and_priorities'))).toMatch(/purpose_and_priorities has 3 items/)
    expect(broken((m) => (at(m.scan.items, 0).order = 2))).toMatch(/order 2 at place 1/)
  })

  it('American spelling, an emoji, a long sentence and a forbidden name', () => {
    expect(broken((m) => (item(m, 'cohesion.2').text = 'Members put the whole organization before their own unit.'))).toMatch(
      /"organization" is American spelling/,
    )
    expect(broken((m) => (factor(m, 'trust').name = 'Trust 🤝'))).toMatch(/emoji/)
    const long = Array.from({ length: 25 }, () => 'word').join(' ') + '.'
    expect(broken((m) => (item(m, 'trust.1').text = long))).toMatch(/a sentence of 25 words/)
    expect(broken((m) => (at(m.instruments, 0).name = 'Team Scan'))).toMatch(/use Leadership Team Scan/)
    expect(broken((m) => (at(m.scan.themes, 0).name = ' Purpose and priorities'))).toMatch(/stray whitespace/)
  })

  it('cut-offs out of order, finer than their rule, or without a start (the rule of lib/scoring/cutoffs.ts)', () => {
    expect(broken((m) => (at(m.cutoffs, 0).agreementLow = 0.8))).toMatch(/agreementLow must be below agreementHigh/)
    expect(broken((m) => (at(m.cutoffs, 0).higherStrengthFrom = 2.9))).toMatch(/higherPriorityBelow must be below higherStrengthFrom/)
    expect(broken((m) => (at(m.cutoffs, 0).lowerPriorityFrom = 2.5))).toMatch(/lowerStrengthBelow must be below lowerPriorityFrom/)
    expect(broken((m) => (at(m.cutoffs, 0).changeMargin = 0.65))).toMatch(/cutoffs\.0\.changeMargin: must be a whole number of tenths/)
    expect(broken((m) => (at(m.cutoffs, 0).version = 2))).toMatch(/version 2 at place 1/)
    expect(broken((m) => (at(m.cutoffs, 0).validFrom = '2026-01-01'))).toMatch(/cutoffs\.0\.validFrom/)
    expect(broken((m) => Object.assign(at(m.cutoffs, 0), { agreementMedium: 0.6 }))).toMatch(/Unrecognized key/)
    expect(broken((m) => m.cutoffs.push({ ...at(m.cutoffs, 0), version: 2, validFrom: '2025-12-31T00:00:00Z' }))).toMatch(
      /a later version starts later/,
    )
  })

  it('a setting outside its range, a fixed setting with one, a list out of order', () => {
    const setting = (m: Model, key: string) => {
      const s = m.settings.find((x) => x.key === key)
      if (!s) throw new Error(`no setting ${key}`)
      return s
    }
    expect(broken((m) => (setting(m, 'anonymity_threshold').default = 3))).toMatch(/default 3 lies outside 4 to 8/)
    expect(broken((m) => (setting(m, 'scan_window_days').min = 20))).toMatch(/min 20 is above max 14/)
    expect(broken((m) => (setting(m, 'members_per_group').max = 15))).toMatch(/a fixed setting has no range/)
    expect(broken((m) => (setting(m, 'reminder_days').default = [7, 3]))).toMatch(/strictly upwards/)
    expect(broken((m) => (setting(m, 'reminder_days').default = [3, 31]))).toMatch(/default 31 lies outside 1 to 30/)
    expect(broken((m) => m.settings.push(structuredClone(at(m.settings, 0))))).toMatch(/anonymity_threshold appears twice/)
  })

  it('a negative or fractional price, and an unknown field', () => {
    const team = (m: Model) => at(at(m.plans, 1).prices, 0)
    expect(broken((m) => (team(m).amountMinor = -1))).toMatch(/plans\.1\.prices\.0\.amountMinor/)
    expect(broken((m) => (team(m).amountMinor = 1800.5))).toMatch(/plans\.1\.prices\.0\.amountMinor/)
    expect(broken((m) => Object.assign(factor(m, 'trust'), { reversed: true }))).toMatch(/Unrecognized key/)
  })
})

describe('the generator', () => {
  const sql = render(model)

  it('wrote the committed 0004 (node scripts/seed/model.mjs --check)', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(sql)
  })

  it('is deterministic and hard-codes no id', () => {
    expect(render(parseModel(readFiles()))).toBe(sql)
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  })

  it('hashes canonical JSON: key order does not matter, content does', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { f: 1, e: 0 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"e":0,"f":1}]},"b":1}')
    expect(bodyHash({ a: 1, b: 2 })).toBe(bodyHash({ b: 2, a: 1 }))
    expect(bodyHash({ a: 1 })).not.toBe(bodyHash({ a: 2 }))
    const bodies = versionBodies(model)
    for (const body of [bodies.scan, bodies.diagnostic]) expect(sql).toContain(`'${bodyHash(body)}'`)
  })

  it('escapes a quote inside a text', () => {
    expect(sql).toContain(`'{"en": "We ask questions to understand each other''s views."}'`)
  })
})
