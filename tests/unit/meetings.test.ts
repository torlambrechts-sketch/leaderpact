import { describe, expect, it } from 'vitest'
import { PLAN_FLOW, render } from '../../scripts/seed/fixture.mjs'
import { chosenMeeting, missing, readiness, timeCheck } from '@/lib/meetings/build'
import { agendaSchema, itemFieldsSchema, meetingInputSchema, meetingsSchema, proposeSchema, replySchema } from '@/lib/meetings/schema'

/**
 * Milestone 13 (handoff 6.14; D-49): "An unmatched item is flagged and can be confirmed. Open actions appear on
 * the agenda." The database flags and confirms (supabase/tests/agenda_invariants.sql); here, the time check,
 * what an item needs to be ready, and the boundary that sends an item or a meeting.
 */
const UUID = '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f'

describe('the time check', () => {
  it("adds the items' minutes against the meeting's length; an item without a time box adds none", () => {
    expect(timeCheck([{ minutes: 10 }, { minutes: null }, { minutes: 5 }], 60)).toEqual({ planned: 15, length: 60, state: 'left', difference: 45 })
    expect(timeCheck([{ minutes: 50 }, { minutes: 20 }], 60)).toEqual({ planned: 70, length: 60, state: 'over', difference: 10 })
    expect(timeCheck([{ minutes: 60 }], 60).state).toBe('fits')
    expect(timeCheck([], 90).planned).toBe(0)
  })
})

describe('ready', () => {
  const item = { type: 'decision' as const, outcome: 'A yes or no.', owner: UUID, owner_current: true, minutes: 20 }

  it('needs a type, a desired outcome, an owner who is a member, and a time box', () => {
    expect(missing(item)).toEqual([])
    expect(missing({ ...item, type: null, minutes: null })).toEqual(['type', 'minutes'])
    expect(missing({ ...item, outcome: null, owner: null })).toEqual(['outcome', 'owner'])
    // an owner who has left the group is no owner
    expect(missing({ ...item, owner_current: false })).toEqual(['owner'])
  })

  it('counts ready items out of total', () => {
    expect(readiness([{ ready: true }, { ready: false }, { ready: true }])).toEqual({ ready: 2, total: 3 })
  })

  it('opens the meeting asked for, else the next, else the most recent', () => {
    const list = [
      { id: 'a', next: false },
      { id: 'b', next: true },
      { id: 'c', next: false },
    ]
    expect(chosenMeeting(list, 'c')?.id).toBe('c')
    expect(chosenMeeting(list, 'unknown')?.id).toBe('b')
    expect(chosenMeeting([{ id: 'a', next: false }], undefined)?.id).toBe('a')
    expect(chosenMeeting([], undefined)).toBeNull()
  })
})

describe("the agenda's boundary", () => {
  it('sends an item whose type, outcome, owner, time box and task may each wait, never be wrong', () => {
    const empty = { title: 'Office move', type: null, outcome: null, owner: null, minutes: null, task: null }
    expect(itemFieldsSchema.safeParse(empty).success).toBe(true)
    expect(proposeSchema.safeParse({ ...empty, meeting: UUID }).success).toBe(true)
    for (const bad of [{ title: '  ' }, { type: 'chat' }, { minutes: 0 }, { minutes: 241 }, { owner: 'someone' }, { outcome: 'x'.repeat(301) }])
      expect(itemFieldsSchema.safeParse({ ...empty, ...bad }).success).toBe(false)
  })

  it('plans a meeting with a title, a day, a start and 15 to 480 minutes', () => {
    const m = { group: UUID, title: ' Leadership meeting ', on: '2026-10-22', at: '09:00', minutes: 90 }
    expect(meetingInputSchema.parse(m).title).toBe('Leadership meeting')
    for (const bad of [{ minutes: 10 }, { minutes: 500 }, { at: '9am' }, { at: '24:00' }, { on: '22/10/2026' }])
      expect(meetingInputSchema.safeParse({ ...m, ...bad }).success).toBe(false)
  })

  it("reads replies: ok with the new meeting, or a reason; never the id of an item it wrote", () => {
    expect(replySchema.safeParse({ ok: true, meeting: UUID }).success).toBe(true)
    expect(replySchema.safeParse({ ok: false, reason: 'no_task' }).success).toBe(true)
    expect(replySchema.safeParse({ ok: true, item: UUID }).success).toBe(false)
  })

  it('reads a meeting as not the next one when the group has no next meeting at all', () => {
    const m = { id: UUID, title: 'Leadership meeting', meets_on: '2026-10-01', starts_at: '09:00', minutes: 60, status: 'planned', next: null }
    const read = meetingsSchema.parse({ meetings: [m], next: null, meeting_minutes: 90, leader: true, can_plan: true })
    expect(read.meetings[0]!.next).toBe(false)
    expect(meetingsSchema.safeParse({ meetings: [{ ...m, next: 'yes' }], next: null, meeting_minutes: 90, leader: true, can_plan: true }).success).toBe(false)
  })

  it('reads open actions as a list on the next agenda and as nothing on any other', () => {
    const agenda = {
      meeting: { id: UUID, title: 'Leadership meeting', meets_on: '2026-10-22', starts_at: '09:00', minutes: 60, status: 'planned', next: false },
      items: [],
      tasks: [],
      open_actions: null,
      members: [],
      max_items: 30,
      leader: true,
      can_propose: true,
      can_manage: true,
    }
    expect(agendaSchema.safeParse(agenda).success).toBe(true)
    expect(agendaSchema.safeParse({ ...agenda, open_actions: [{ id: UUID, title: 'T', owner_name: 'N', due_on: '2026-11-01', focus: null }] }).success).toBe(true)
    expect(agendaSchema.safeParse({ ...agenda, per_person: {} }).success).toBe(false)
  })
})

describe("the plan flow's charter", () => {
  it('is drafted and agreed through the write paths, with two team tasks', () => {
    const sql = render({ e2e: true })
    expect(PLAN_FLOW.tasks).toHaveLength(2)
    expect(sql).toContain(`app.agree_charter('${PLAN_FLOW.group.id}')`)
    expect(sql).not.toMatch(/insert into app\.(team_task|charter_version|meeting|agenda_item)\b/)
  })
})
