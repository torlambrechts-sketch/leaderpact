import { describe, expect, it } from 'vitest'
import { LIVE_FLOW, PLAN_FLOW, PULSE_FLOW, PULSE_STATES, SYNC_FLOW, render } from '../../scripts/seed/fixture.mjs'
import { agreementsWaiting, choices, pulseChange, windowsFor } from '@/lib/pulses/build'
import { pulseReplySchema, pulseResultSchema, pulsesSchema, rhythmSchema, stopSchema } from '@/lib/pulses/schema'

/**
 * Milestone 15 (handoff 6.16 and 7; D-52): "A pulse assembles in the right order, closes after 7 days and shows
 * change only from 0.6." The database builds, closes and computes (supabase/tests/pulse_invariants.sql); here,
 * the boundary the pages read and send, and the change they show.
 */
const UUID = '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f'

describe("a pulse's change", () => {
  it('shows from 0.6 and reads 0.5 as within normal variation, either way', () => {
    expect(pulseChange(3.0, 3.6, 0.6)).toEqual({ kind: 'shown', deltaTenths: 6 })
    expect(pulseChange(3.6, 3.0, 0.6)).toEqual({ kind: 'shown', deltaTenths: -6 })
    expect(pulseChange(3.0, 3.5, 0.6)).toEqual({ kind: 'within' })
    expect(pulseChange(3.0, 2.5, 0.6)).toEqual({ kind: 'within' })
    // in tenths, so floating point never hides a change the rule shows
    expect(pulseChange(3.2, 3.8, 0.6)).toEqual({ kind: 'shown', deltaTenths: 6 })
  })

  it('shows none for a question no earlier pulse asked', () => {
    expect(pulseChange(null, 4.2, 0.6)).toEqual({ kind: 'first' })
  })

  it('follows the margin of the cut-offs the pulse closed with', () => {
    expect(pulseChange(3.0, 3.6, 0.7)).toEqual({ kind: 'within' })
    expect(pulseChange(3.0, 3.7, 0.7)).toEqual({ kind: 'shown', deltaTenths: 7 })
  })
})

describe('the rhythm', () => {
  it('offers every value in a setting, and windows that close before the next pulse', () => {
    expect(choices(2, 8)).toEqual([2, 3, 4, 5, 6, 7, 8])
    expect(choices(5, 4)).toEqual([])
    expect(windowsFor(4, 3, 14)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(windowsFor(2, 3, 14)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it('counts the agreements that did not fit the next pulse', () => {
    const q = (source: 'focus' | 'agreement' | 'rotating') => ({ source, text: 'A question.', scale: null })
    expect(agreementsWaiting({ agreements: 5, next: [...Array(6)].map(() => q('focus')).concat([...Array(4)].map(() => q('agreement'))) })).toBe(1)
    expect(agreementsWaiting({ agreements: 2, next: [q('agreement'), q('agreement'), q('rotating')] })).toBe(0)
    expect(agreementsWaiting({ agreements: 0, next: [q('rotating'), q('rotating')] })).toBe(0)
  })

  it('sends a group and whole numbers only, and nothing more', () => {
    expect(rhythmSchema.safeParse({ group: UUID, weeks: 4, days: 7 }).success).toBe(true)
    expect(rhythmSchema.safeParse({ group: UUID, weeks: 4.5, days: 7 }).success).toBe(false)
    expect(rhythmSchema.safeParse({ group: UUID, weeks: 4, days: 7, members: [UUID] }).success).toBe(false)
    expect(rhythmSchema.safeParse({ group: 'lumio', weeks: 4, days: 7 }).success).toBe(false)
    expect(stopSchema.safeParse({ group: UUID }).success).toBe(true)
  })

  it("reads the database's replies: ok, or a reason it names", () => {
    expect(pulseReplySchema.safeParse({ ok: true, round: UUID }).success).toBe(true)
    expect(pulseReplySchema.safeParse({ ok: true }).success).toBe(true)
    expect(pulseReplySchema.safeParse({ ok: false, reason: 'too_few', members: 3, k: 4 }).success).toBe(true)
    expect(pulseReplySchema.safeParse({ ok: false, reason: 'not_running' }).success).toBe(true)
    expect(pulseReplySchema.safeParse({ ok: false, reason: 'something_else' }).success).toBe(false)
  })
})

describe("what the pages read", () => {
  const pulses = {
    running: true,
    next_at: '2026-11-11T09:00:00Z',
    weeks: 4,
    days: 7,
    weeks_min: 2,
    weeks_max: 8,
    days_min: 3,
    days_max: 14,
    max_questions: 10,
    max_rotating: 2,
    wording_confirmed: false,
    next: [{ source: 'focus', text: 'We know why this team exists.', scale: 'Clear purpose' }],
    focus: 1,
    agreements: 0,
    leader: true,
    can_manage: true,
  }

  it("reads the next pulse's questions with where each comes from", () => {
    expect(pulsesSchema.safeParse(pulses).success).toBe(true)
    expect(pulsesSchema.safeParse({ ...pulses, next: [{ source: 'wish', text: 'A question.', scale: null }] }).success).toBe(false)
  })

  const result = {
    round: UUID,
    team: UUID,
    number: 2,
    opens_at: '2026-09-14T09:00:00Z',
    closes_at: '2026-09-21T09:00:00Z',
    k: 4,
    invited: 5,
    answered: 5,
    margin: 0.6,
    scales: [
      { key: 'trust', name: 'Trust', layer: 'states', reading_type: 'higher', evidence: 'strong', level: 3.5, agreement: 'high', standing: 'strength', before: 3.0 },
    ],
    agreements: [{ text: 'In the last 4 weeks we kept this agreement: «We start and end on time.»', level: 3.6, before: 3.0 }],
    items: [{ text: 'We rely on each other to deliver.', scale: 'Trust', source: 'focus', level: 3.4 }],
  }

  it('reads a result row with exactly what a result may show, and refuses one with more', () => {
    expect(pulseResultSchema.safeParse(result).success).toBe(true)
    const withSpread = { ...result, scales: [{ ...result.scales[0], sd: 0.8 }] }
    const withNumber = { ...result, scales: [{ ...result.scales[0], agreement_value: 0.71 }] }
    const withCount = { ...result, items: [{ ...result.items[0], n: 5 }] }
    const withLowest = { ...result, agreements: [{ ...result.agreements[0], lowest: 1 }] }
    for (const bad of [withSpread, withNumber, withCount, withLowest]) expect(pulseResultSchema.safeParse(bad).success).toBe(false)
  })
})

describe("the pulses' fixture", () => {
  it('gives each group people and ids of its own, and builds the states through the write paths', () => {
    const groups = [PLAN_FLOW, LIVE_FLOW, SYNC_FLOW, PULSE_FLOW, PULSE_STATES]
    expect(new Set(groups.map((g) => g.group.id)).size).toBe(groups.length)
    expect(new Set(groups.flatMap((g) => g.people.map((p) => p.id))).size).toBe(groups.length * 5)
    const sql = render({ e2e: true })
    expect(sql).toContain(`app.start_pulses('${PULSE_STATES.group.id}', 4, 7)`)
    expect(sql).toContain('app.open_due_pulses()')
    expect(sql).not.toContain(`app.start_pulses('${PULSE_FLOW.group.id}'`)
    for (const scale of PULSE_FLOW.focus) expect(sql).toContain(`app.make_focus_area('${PULSE_FLOW.group.id}', '${PULSE_FLOW.rounds.released}', '${scale}')`)
  })
})
