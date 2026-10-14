import { describe, expect, it } from 'vitest'
import { LIVE_FLOW, SYNC_FLOW, render } from '../../scripts/seed/fixture.mjs'
import { clock, connection, dayWords, mmss, writable } from '@/lib/live/build'
import { commentSchema, controlSchema, liveSchema, replySchema, signalSchema } from '@/lib/live/schema'

/**
 * Milestone 14 (handoff 6.15; D-51): "Two browsers stay in sync within 1 second. Comments carry no sender." The
 * database proves both (supabase/tests/live_invariants.sql); here, the clock, when the page may write, and the
 * boundary a process comment crosses.
 */
const UUID = '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f'

describe('the clock', () => {
  const item = { minutes: 10, extra: 5, elapsed: 90 }
  const t0 = Date.parse('2026-10-14T09:00:00Z')

  it('counts the time box, plus the minutes added, against the time run', () => {
    expect(clock(item, null, t0)).toEqual({ box: 900, spent: 90, left: 810, over: false, running: false })
    expect(clock(item, '2026-10-14T08:59:00Z', t0)).toEqual({ box: 900, spent: 150, left: 750, over: false, running: true })
    expect(clock({ minutes: 1, extra: 0, elapsed: 70 }, null, t0).over).toBe(true)
    expect(clock({ minutes: null, extra: 0, elapsed: 0 }, null, t0).box).toBe(0)
  })

  it('reads as a clock', () => {
    expect(mmss(0)).toBe('0:00')
    expect(mmss(65)).toBe('1:05')
    expect(mmss(-125)).toBe('2:05')
    expect(dayWords('2026-11-13')).toBe('13 November 2026')
  })
})

describe('when the page may change anything', () => {
  it('is read-only until Realtime has joined, and whenever it drops; with sync off it writes', () => {
    expect(connection(true, null)).toBe('joining')
    expect(connection(true, 'SUBSCRIBED')).toBe('joined')
    for (const s of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) expect(connection(true, s)).toBe('lost')
    expect(connection(false, null)).toBe('off')
    expect(writable('joined')).toBe(true)
    expect(writable('off')).toBe(true)
    expect(writable('joining')).toBe(false)
    expect(writable('lost')).toBe(false)
  })
})

describe('the boundary', () => {
  it('sends a process comment as the meeting and a kind, nothing else', () => {
    expect(commentSchema.parse({ meeting: UUID, kind: 'off_track', sender: 'someone' })).toEqual({ meeting: UUID, kind: 'off_track' })
    expect(commentSchema.safeParse({ meeting: UUID, kind: 'gossip' }).success).toBe(false)
  })

  it('reads the signal as a version and the last kind: a sender in it changes nothing it keeps', () => {
    const signal = signalSchema.parse({ meeting_id: UUID, version: 3, comment_kind: 'purpose', comment_item: UUID, comment_seq: 1, sent_by: UUID })
    expect(Object.keys(signal).sort()).toEqual(['comment_item', 'comment_kind', 'comment_seq', 'meeting_id', 'version'])
  })

  it('reads the live meeting strictly: comment counts, never who', () => {
    const item = {
      id: UUID, title: 'T', type: null, outcome: null, owner_name: null, minutes: 10, extra: 0, elapsed: 0, task_title: null, closing: false,
      closed_as: null, carried: false, decision: null, actions: [], comments: { purpose: 1, off_track: 0 },
    }
    const live = {
      meeting: { id: UUID, title: 'M', status: 'live', meets_on: '2026-10-14', starts_at: '09:00', minutes: 60 },
      now: '2026-10-14T09:00:00Z', current: UUID, timer_started_at: null, items: [item], parking: [], open_actions: [], members: [],
      online: 1, k: 4, comments_open: false, sync: true, leader: true, can_run: true, can_add: true,
    }
    expect(liveSchema.safeParse(live).success).toBe(true)
    expect(liveSchema.safeParse({ ...live, items: [{ ...item, comments: { purpose: 1, off_track: 0, by: [UUID] } }] }).success).toBe(false)
  })

  it('takes the leader\'s controls by name, and replies ok or a reason', () => {
    expect(controlSchema.safeParse({ meeting: UUID, do: 'extend' }).success).toBe(true)
    expect(controlSchema.safeParse({ meeting: UUID, do: 'rewind' }).success).toBe(false)
    expect(replySchema.safeParse({ ok: false, reason: 'too_few' }).success).toBe(true)
    expect(replySchema.safeParse({ ok: true, online: 4 }).success).toBe(true)
  })
})

describe("the live meeting's groups", () => {
  it('have people of their own and a meeting planned through the write paths; --live-off turns sync off', () => {
    expect(new Set([...LIVE_FLOW.people, ...SYNC_FLOW.people].map((p) => p.id)).size).toBe(10)
    const on = render({ e2e: true })
    expect(on).toContain(`app.plan_meeting('${LIVE_FLOW.group.id}'`)
    expect(on).not.toMatch(/insert into app\.(meeting|agenda_item)\b/)
    expect(on).not.toContain('feature_flag')
    expect(render({ e2e: true, liveOff: true })).toContain(`update app.feature_flag set "on" = false where key = 'live_meeting'`)
  })
})
