import { describe, expect, it } from 'vitest'
import { changeFor, comparableScales, guidanceFor, overview, type ScaleResult } from '@/lib/results/build'
import { cutoffsAt, itemRowSchema, resultRowSchema } from '@/lib/results/schema'
import type { Cutoffs } from '@/lib/scoring'

/**
 * The results in three depths (handoff 6.12 and section 7; milestone 11; D-45): what the readers may return,
 * the change since the round before, which scales may be compared, and the guidance's tone. The levels,
 * labels and standings themselves are the snapshot's (supabase/tests/results_invariants.sql).
 */
const V1: Cutoffs = {
  version: 1,
  agreementHigh: 0.7,
  agreementLow: 0.5,
  higherPriorityBelow: 3.0,
  higherStrengthFrom: 3.4,
  lowerPriorityFrom: 3.5,
  lowerStrengthBelow: 2.8,
  changeMargin: 0.6,
}

const scale = (over: Partial<ScaleResult>): ScaleResult => ({
  key: 'trust',
  name: 'Trust',
  layer: 'states',
  readingType: 'higher',
  evidence: 'strong',
  ordinal: 19,
  level: 3.6,
  agreement: 'high',
  standing: 'strength',
  n: 5,
  ...over,
})

const row = {
  factor_key: 'trust',
  factor_name: { en: 'Trust' },
  layer: 'states',
  reading_type: 'higher',
  evidence: 'strong',
  ordinal: 19,
  level: 3.6,
  agreement: 'high',
  standing: 'strength',
  n: 5,
}

describe('what a result may show', () => {
  it('reads a scale row with level, agreement label and one standing', () => {
    expect(resultRowSchema.safeParse(row).success).toBe(true)
  })

  it('refuses a row that carries anything more: a spread, the agreement number, a lowest or a median', () => {
    for (const extra of [{ sd: 0.4 }, { agreement_value: 0.82 }, { lowest: 2 }, { median: 3 }, { person: 'x' }]) {
      expect(resultRowSchema.safeParse({ ...row, ...extra }).success).toBe(false)
    }
    expect(resultRowSchema.safeParse({ ...row, agreement: 0.82 }).success).toBe(false)
    expect(resultRowSchema.safeParse({ ...row, n: 3 }).success).toBe(false)
  })

  it('reads a question with its text and mean, and nothing else', () => {
    const item = { item_code: 'trust.1', item_text: { en: 'We rely on each other.' }, factor_key: 'trust', level: 3.5, n: 5 }
    expect(itemRowSchema.safeParse(item).success).toBe(true)
    expect(itemRowSchema.safeParse({ ...item, distribution: [1, 2, 0, 1, 1] }).success).toBe(false)
  })
})

describe('change since the round before', () => {
  const before = new Map([['trust', 3.0]])
  it('a first round shows none', () => {
    expect(changeFor('trust', 36, null, null, V1)).toEqual({ kind: 'first' })
  })

  it('0.5 reads within normal variation, 0.6 shows, either way', () => {
    expect(changeFor('trust', 35, before, null, V1)).toEqual({ kind: 'within' })
    expect(changeFor('trust', 36, before, null, V1)).toEqual({ kind: 'shown', deltaTenths: 6 })
    expect(changeFor('trust', 24, before, null, V1)).toEqual({ kind: 'shown', deltaTenths: -6 })
  })

  it('a scale whose questions changed, or that the round before lacks, is not compared (owner C5)', () => {
    expect(changeFor('trust', 36, before, new Set(['cohesion']), V1)).toEqual({ kind: 'not_comparable' })
    expect(changeFor('cohesion', 36, before, null, V1)).toEqual({ kind: 'not_comparable' })
  })

  it('compares scales whose items are the same in both versions, by id', () => {
    const a = [
      { factor: 'trust', item: 'i1' },
      { factor: 'trust', item: 'i2' },
      { factor: 'cohesion', item: 'i3' },
    ]
    const b = [
      { factor: 'trust', item: 'i2' },
      { factor: 'trust', item: 'i1' },
      { factor: 'cohesion', item: 'i4' },
    ]
    expect([...comparableScales(a, b)]).toEqual(['trust'])
  })
})

describe('the overview', () => {
  it('groups by layer, outcomes first, each in Appendix A order, with the change worked out', () => {
    const current = [
      scale({ key: 'cohesion', name: 'Cohesion', ordinal: 20, level: 4.0 }),
      scale({ key: 'trust', ordinal: 19, level: 3.6 }),
      scale({ key: 'viability', name: 'Viability', layer: 'outcomes', evidence: null, ordinal: 23 }),
    ]
    const previous = [scale({ key: 'trust', level: 3.0 }), scale({ key: 'cohesion', level: 3.6 })]
    const out = overview(current, previous, null, V1)
    expect(out.states.map((s) => s.key)).toEqual(['trust', 'cohesion'])
    expect(out.states.map((s) => s.change)).toEqual([{ kind: 'shown', deltaTenths: 6 }, { kind: 'within' }])
    expect(out.outcomes.map((s) => s.key)).toEqual(['viability'])
    expect(out.outcomes[0]!.change).toEqual({ kind: 'not_comparable' })
    expect(out.conditions).toEqual([])
  })
})

describe('the guidance', () => {
  it('follows the standing, in the tone of the scale\'s own evidence rating (handoff 7, Guidance wording)', () => {
    expect(guidanceFor(scale({ standing: 'priority', evidence: 'strong' }))).toBe('priority_direct')
    expect(guidanceFor(scale({ standing: 'priority', evidence: 'moderate' }))).toBe('priority_likely')
    expect(guidanceFor(scale({ standing: 'priority', evidence: 'not_rated' }))).toBe('priority_likely')
    expect(guidanceFor(scale({ standing: 'watch', evidence: 'mixed' }))).toBe('describe')
    expect(guidanceFor(scale({ standing: 'watch' }))).toBe('watch')
    expect(guidanceFor(scale({ standing: 'strength' }))).toBe('strength')
  })

  it('low agreement says the views differ, whatever the rating; facts and task conflict keep their own words', () => {
    expect(guidanceFor(scale({ standing: 'views_differ', evidence: 'strong' }))).toBe('views_differ')
    expect(guidanceFor(scale({ standing: 'fact', evidence: 'mixed' }))).toBe('fact')
    expect(guidanceFor(scale({ standing: 'read_with' }))).toBe('read_with')
    expect(guidanceFor(scale({ layer: 'outcomes', evidence: null, standing: 'priority' }))).toBe('outcome')
  })
})

describe('the cut-offs a result was made with', () => {
  const rows = [
    { validFrom: '2026-01-01T00:00:00Z', cutoffs: V1 },
    { validFrom: '2027-01-01T00:00:00Z', cutoffs: { ...V1, version: 2, changeMargin: 0.5 } },
  ]
  it('are the newest version that had started when the round closed', () => {
    expect(cutoffsAt(rows, '2026-10-14T08:00:00Z')?.version).toBe(1)
    expect(cutoffsAt(rows, '2027-02-01T00:00:00Z')?.version).toBe(2)
    expect(cutoffsAt(rows, '2025-01-01T00:00:00Z')).toBeNull()
  })
})
