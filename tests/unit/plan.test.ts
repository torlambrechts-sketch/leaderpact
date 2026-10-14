import { describe, expect, it } from 'vitest'
import { PLAN_FLOW, ROUND_STATES, render } from '../../scripts/seed/fixture.mjs'
import { candidates, focusPlace, myOpenActions } from '@/lib/plan/build'
import { addActionSchema, makeSchema, planSchema, replySchema, updateActionSchema, type Plan } from '@/lib/plan/schema'
import type { ScaleResult } from '@/lib/results/build'

/**
 * Milestone 12 (handoff 6.13; D-46): "A third focus area is refused. An action without an owner is refused."
 * The database refuses both (supabase/tests/plan_invariants.sql); here, the boundary that sends them and the
 * Plan page's own working-out.
 */
const UUID = '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f'
const OTHER = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

describe("the plan's boundary", () => {
  it('sends no action without an owner, a title and a date', () => {
    const action = { group: UUID, focusArea: UUID, title: '  Agree what good looks like ', owner: OTHER, due: '2026-11-30' }
    expect(addActionSchema.parse(action).title).toBe('Agree what good looks like')
    expect(addActionSchema.safeParse({ ...action, owner: undefined }).success).toBe(false)
    expect(addActionSchema.safeParse({ ...action, owner: '' }).success).toBe(false)
    expect(addActionSchema.safeParse({ ...action, title: '   ' }).success).toBe(false)
    expect(addActionSchema.safeParse({ ...action, title: 'x'.repeat(201) }).success).toBe(false)
    expect(addActionSchema.safeParse({ ...action, due: '30/11/2026' }).success).toBe(false)
    expect(updateActionSchema.safeParse({ group: UUID, action: UUID, title: 'T', owner: null, due: '2026-11-30' }).success).toBe(false)
  })

  it('makes a focus area of a scale key and a round only', () => {
    expect(makeSchema.safeParse({ group: UUID, round: UUID, scale: 'psychological_safety' }).success).toBe(true)
    for (const scale of ['', 'Trust', 'trust;', '_trust', 'trust_']) expect(makeSchema.safeParse({ group: UUID, round: UUID, scale }).success).toBe(false)
  })

  it("reads the database's replies: ok, or a reason it names", () => {
    expect(replySchema.safeParse({ ok: true, focus_area: UUID }).success).toBe(true)
    expect(replySchema.safeParse({ ok: false, reason: 'full', max: 2 }).success).toBe(true)
    expect(replySchema.safeParse({ ok: false, reason: 'no_owner' }).success).toBe(true)
    expect(replySchema.safeParse({ ok: false, reason: 'something_else' }).success).toBe(false)
    // an id of the row written is never part of a reply
    expect(replySchema.safeParse({ ok: true, id: UUID }).success).toBe(false)
  })

  it('reads the plan strictly: no count of actions per person can arrive', () => {
    const plan = samplePlan()
    expect(planSchema.safeParse(plan).success).toBe(true)
    expect(planSchema.safeParse({ ...plan, members: [{ ...plan.members[0], open_actions: 2 }] }).success).toBe(false)
    expect(planSchema.safeParse({ ...plan, per_person: {} }).success).toBe(false)
  })
})

const scale = (key: string, level: number, standing: ScaleResult['standing'], extra: Partial<ScaleResult> = {}): ScaleResult => ({
  key,
  name: key,
  layer: 'processes',
  readingType: 'higher',
  evidence: 'moderate',
  ordinal: 1,
  level,
  agreement: 'medium',
  standing,
  n: 4,
  ...extra,
})

describe('the scales to consider', () => {
  it('leaves out the outcomes, the descriptive scales and the active focus areas', () => {
    const rows = [
      scale('viability', 2.0, 'priority', { layer: 'outcomes', evidence: null }),
      scale('size_and_membership', 2.0, 'fact', { layer: 'conditions', readingType: 'descriptive' }),
      scale('trust', 2.4, 'priority'),
      scale('focus', 2.6, 'priority'),
    ]
    expect(candidates(rows, new Set(['trust'])).map((s) => s.key)).toEqual(['focus'])
  })

  it('orders by standing, then by level read the way the scale reads', () => {
    const rows = [
      scale('cohesion', 4.2, 'strength'),
      scale('dialogue', 3.2, 'watch'),
      scale('learning', 3.0, 'views_differ'),
      scale('trust', 2.6, 'priority', { ordinal: 19 }),
      scale('relationship_conflict', 3.4, 'priority', { readingType: 'lower', ordinal: 12 }),
    ]
    // relationship conflict at 3.4 reads as 2.6 turned round: level with trust, then Appendix A's order
    expect(candidates(rows, new Set()).map((s) => s.key)).toEqual(['relationship_conflict', 'trust', 'learning', 'dialogue', 'cohesion'])
    expect(candidates(rows, new Set(), 2)).toHaveLength(2)
  })
})

function samplePlan(active = 1): Plan {
  const area = (n: number, status: 'active' | 'closed') => ({
    id: UUID.replace(/.$/, String(n)),
    scale: ['trust', 'focus', 'learning'][n]!,
    name: 'Trust',
    round: UUID,
    status,
    created_at: '2026-10-01T09:00:00Z',
    closed_at: status === 'closed' ? '2026-10-10T09:00:00Z' : null,
    actions: [
      { id: OTHER, title: 'Mine', owner: UUID, owner_name: 'Plan leader', owner_current: true, due_on: '2026-11-30', status: 'open' as const, done_at: null, mine: true, can_edit: true },
      { id: UUID, title: 'Done', owner: UUID, owner_name: 'Plan leader', owner_current: true, due_on: '2026-11-01', status: 'done' as const, done_at: '2026-10-12T09:00:00Z', mine: true, can_edit: true },
    ],
  })
  return {
    focus_areas: [...Array.from({ length: active }, (_, i) => area(i, 'active')), area(2, 'closed')],
    members: [{ person: UUID, name: 'Plan leader', me: true }],
    max: 2,
    leader: true,
    can_edit: true,
    can_choose: true,
  }
}

describe("a scale's place in the plan", () => {
  it('is open while a place is free, full with two active, and active once chosen', () => {
    expect(focusPlace(samplePlan(1), 'learning', false)).toEqual({ kind: 'open' })
    expect(focusPlace(samplePlan(2), 'learning', false)).toEqual({ kind: 'full' })
    expect(focusPlace(samplePlan(1), 'trust', false)).toEqual({ kind: 'active' })
  })

  it('offers nothing for an outcome, or to someone who may not choose', () => {
    expect(focusPlace(samplePlan(1), 'viability', true)).toEqual({ kind: 'none' })
    expect(focusPlace({ ...samplePlan(1), can_choose: false }, 'learning', false)).toEqual({ kind: 'none' })
    // a member still reads that a scale is a focus area
    expect(focusPlace({ ...samplePlan(1), can_choose: false }, 'trust', false)).toEqual({ kind: 'active' })
  })

  it("counts the person's own open actions, in every focus area, for them alone", () => {
    expect(myOpenActions(samplePlan(2))).toBe(3)
    const others = samplePlan(1)
    others.focus_areas.forEach((f) => f.actions.forEach((a) => (a.mine = false)))
    expect(myOpenActions(others)).toBe(0)
  })
})

describe("the plan flow's group", () => {
  it('has people of its own and one released round, opened and answered through the write paths', () => {
    expect(PLAN_FLOW.people.map((p) => p.id).some((id) => ROUND_STATES.people.some((r) => r.id === id))).toBe(false)
    expect(PLAN_FLOW.leader.role).toBe('leader')
    const sql = render({ e2e: true })
    expect(sql).toContain(`app.close_round('${PLAN_FLOW.rounds.released}')`)
    // the flow makes the focus areas and actions: the fixture writes none
    expect(sql).not.toMatch(/insert into app\.(focus_area|action)\b/)
  })
})
