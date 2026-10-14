import { describe, expect, it } from 'vitest'
import { formSchema, openReplySchema, roundsSchema, submitReplySchema, submitSchema } from '@/lib/rounds/schema'
import { ROUND_DRAFT_DAYS, roundDraftKey } from '@/lib/rounds/draft'
import { DRAFT_DAYS, readDraft, writeDraft } from '@/lib/scan/draft'

/**
 * The diagnostic round (handoff 6.10 and 6.11; milestone 10; D-43): what crosses the boundary when a round is
 * opened, read and answered, and the answers kept on the device until they are submitted. The database
 * checks everything again (supabase/tests/diagnostic_invariants.sql).
 */
const ROUND = '0d000000-0000-4000-8000-000000000501'
const VERSION = '0e000000-0000-4000-8000-000000000001'
const PERSON = '4c0e0000-0000-4000-8000-000000000907'
const ITEMS = ['a', 'b', 'c'].map((x, i) => ({ id: `0f000000-0000-4000-8000-00000000000${i + 1}`, text: `Statement ${x}` }))

describe('submitting answers', () => {
  it('sends the round and its answers, and nothing else: an extra key is dropped', () => {
    const parsed = submitSchema.safeParse({
      round: ROUND,
      person: PERSON,
      answers: [{ item: ITEMS[0]!.id, value: 4, device: 'x' }],
    })
    expect(parsed.success && parsed.data).toEqual({ round: ROUND, answers: [{ item: ITEMS[0]!.id, value: 4 }] })
  })

  it('refuses a value off the five-point scale, no answers, and more than 72', () => {
    expect(submitSchema.safeParse({ round: ROUND, answers: [{ item: ITEMS[0]!.id, value: 6 }] }).success).toBe(false)
    expect(submitSchema.safeParse({ round: ROUND, answers: [] }).success).toBe(false)
    const many = Array.from({ length: 73 }, () => ({ item: ITEMS[0]!.id, value: 3 }))
    expect(submitSchema.safeParse({ round: ROUND, answers: many }).success).toBe(false)
  })

  it('reads the reply as ok or a reason it knows; a reply carrying an id is refused', () => {
    expect(submitReplySchema.safeParse({ ok: true }).success).toBe(true)
    expect(submitReplySchema.safeParse({ ok: false, reason: 'already_answered' }).success).toBe(true)
    expect(submitReplySchema.safeParse({ ok: true, id: ROUND }).success).toBe(false)
    expect(submitReplySchema.safeParse({ ok: false, reason: 'because' }).success).toBe(false)
  })
})

describe('opening a round', () => {
  it('reads the round it opened, or why not, with the members and the threshold when too few', () => {
    expect(openReplySchema.safeParse({ ok: true, round: ROUND, invited: 5 }).success).toBe(true)
    expect(openReplySchema.safeParse({ ok: false, reason: 'too_few', members: 3, k: 4 }).success).toBe(true)
    expect(openReplySchema.safeParse({ ok: false, reason: 'open_round' }).success).toBe(true)
    expect(openReplySchema.safeParse({ ok: true, round: ROUND, invited: 5, people: [PERSON] }).success).toBe(false)
  })
})

describe('what the pages read', () => {
  const round = {
    id: ROUND, kind: 'diagnostic', number: 1, phase: 'answering', opens_at: '2026-10-14T08:00:00Z', closes_at: '2026-10-28T08:00:00Z',
    extended: false, invited: 5, k: 4, answered: 1, me: 'to_answer',
  }
  it('a round carries a count and the reader’s own state, never a person', () => {
    const parsed = roundsSchema.safeParse({ rounds: [{ ...round, people: [PERSON] }], members: 5, k: 4, window_days: 14, questions: 72, leader: true, can_open: false })
    expect(parsed.success).toBe(true)
    expect(parsed.success && Object.keys(parsed.data.rounds[0]!)).not.toContain('people')
  })

  it('a threshold below 4 or above 8 is not a threshold', () => {
    expect(roundsSchema.safeParse({ rounds: [], members: 5, k: 3, window_days: 14, questions: 72, leader: true, can_open: true }).success).toBe(false)
    expect(roundsSchema.safeParse({ rounds: [], members: 5, k: 9, window_days: 14, questions: 72, leader: true, can_open: true }).success).toBe(false)
  })

  it('the form has questions only while open; another state may carry none', () => {
    const form = { round: ROUND, kind: 'diagnostic', team: PERSON, group: 'Group', k: 4, closes_at: null, version: VERSION }
    expect(formSchema.safeParse({ ...form, state: 'open', items: ITEMS }).success).toBe(true)
    expect(formSchema.safeParse({ ...form, state: 'answered', items: null }).success).toBe(true)
    expect(formSchema.safeParse({ ...form, state: 'open', items: [{ id: ITEMS[0]!.id, text: '  ' }] }).success).toBe(false)
  })
})

describe('the answers on the device', () => {
  const store = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
  }
  const form = { versionId: VERSION, items: ITEMS }
  const now = new Date('2026-10-14T12:00:00Z')
  const day = 86_400_000

  it('one record per round and person, apart from the scan, the invitation and the profile', () => {
    expect(roundDraftKey(ROUND, PERSON)).toBe(`leaderpact.round.${ROUND}.${PERSON}`)
    expect(roundDraftKey(ROUND, PERSON)).not.toBe(roundDraftKey(ROUND, '4c0e0000-0000-4000-8000-000000000908'))
  })

  it('lasts as long as a round can be open, where the scan keeps 7 days', () => {
    const s = store()
    const key = roundDraftKey(ROUND, PERSON)
    writeDraft(s, form, { answers: { [ITEMS[0]!.id]: 4 }, position: 1 }, now, key)
    const later = new Date(now.getTime() + 20 * day)
    expect(readDraft(s, form, later, key, ROUND_DRAFT_DAYS)).toEqual({ answers: { [ITEMS[0]!.id]: 4 }, position: 1 })
    expect(DRAFT_DAYS).toBe(7)
    expect(readDraft(s, form, new Date(now.getTime() + (ROUND_DRAFT_DAYS + 1) * day), key, ROUND_DRAFT_DAYS)).toBeNull()
    expect(s.m.size).toBe(0)
  })

  it('a record for another version of the questions is not resumed', () => {
    const s = store()
    const key = roundDraftKey(ROUND, PERSON)
    writeDraft(s, form, { answers: { [ITEMS[0]!.id]: 4 }, position: 0 }, now, key)
    expect(readDraft(s, { ...form, versionId: '0e000000-0000-4000-8000-000000000002' }, now, key, ROUND_DRAFT_DAYS)).toBeNull()
  })
})
