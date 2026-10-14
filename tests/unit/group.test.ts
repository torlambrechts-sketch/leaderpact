import { describe, expect, it } from 'vitest'
import { draftSchema, inviteSchema, joinRequestSchema, replySchema, tokenSchema } from '@/lib/group/schema'
import { JOIN_KEY, forgetPendingJoin, readPendingJoin, writePendingJoin } from '@/lib/group/device'

/**
 * The group (handoff 6.8; milestone 9; D-42): what crosses the boundary for the charter and the members, and
 * the invitation waiting for its sign-in on the device. The database checks everything again
 * (supabase/tests/charter_members_invariants.sql).
 */
const GROUP = '0b000000-0000-4000-8000-000000000401'
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv'

describe('the charter draft', () => {
  it('takes a purpose, tasks with a decision right, and agreements, trimmed', () => {
    const parsed = draftSchema.safeParse({ group: GROUP, purpose: ' Why ', tasks: [{ title: ' Decide budgets ', right: 'decide' }], agreements: [' Pre-reads '] })
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ group: GROUP, purpose: 'Why', tasks: [{ title: 'Decide budgets', right: 'decide' }], agreements: ['Pre-reads'] })
  })

  it('refuses a right that is not decide, advise or inform, a blank task and a blank agreement', () => {
    expect(draftSchema.safeParse({ group: GROUP, purpose: '', tasks: [{ title: 'Task', right: 'veto' }], agreements: [] }).success).toBe(false)
    expect(draftSchema.safeParse({ group: GROUP, purpose: '', tasks: [{ title: '  ', right: 'decide' }], agreements: [] }).success).toBe(false)
    expect(draftSchema.safeParse({ group: GROUP, purpose: '', tasks: [], agreements: ['  '] }).success).toBe(false)
  })
})

describe('invitations', () => {
  it('take a name and an address, lower-cased', () => {
    const parsed = inviteSchema.safeParse({ group: GROUP, name: ' Charter invitee ', email: ' Charter.Invitee@Lumio.example ' })
    expect(parsed.success && parsed.data).toEqual({ group: GROUP, name: 'Charter invitee', email: 'charter.invitee@lumio.example' })
    expect(inviteSchema.safeParse({ group: GROUP, name: '', email: 'a@b.example' }).success).toBe(false)
    expect(inviteSchema.safeParse({ group: GROUP, name: 'A', email: 'not-an-address' }).success).toBe(false)
  })

  it('carry a token of base64url, 16 to 64 characters, and nothing else', () => {
    expect(tokenSchema.safeParse(TOKEN).success).toBe(true)
    for (const bad of ['short', `${TOKEN}/../x`, 'a'.repeat(65), 'AbCdEfGh IjKlMnOpQr']) expect(tokenSchema.safeParse(bad).success).toBe(false)
    expect(joinRequestSchema.safeParse({ token: TOKEN, email: 'x' }).success).toBe(false)
  })

  it('read a reply as ok with its fields, or a reason it knows', () => {
    expect(replySchema.safeParse({ ok: true, token: TOKEN, invitation: GROUP }).success).toBe(true)
    expect(replySchema.safeParse({ ok: false, reason: 'other_address' }).success).toBe(true)
    expect(replySchema.safeParse({ ok: false, reason: 'because' }).success).toBe(false)
  })
})

describe('the invitation waiting for its sign-in', () => {
  const store = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
  }
  const now = new Date('2026-10-14T12:00:00Z')

  it('keeps the token under a key of its own, apart from the scan and the profile', () => {
    expect(JOIN_KEY).toBe('leaderpact.invitation.pending')
    const s = store()
    expect(writePendingJoin(s, TOKEN, now)).toBe(true)
    expect(readPendingJoin(s, now)).toBe(TOKEN)
    expect([...s.m.keys()]).toEqual([JOIN_KEY])
    forgetPendingJoin(s)
    expect(readPendingJoin(s, now)).toBeNull()
  })

  it('drops a token after a day, and refuses to keep a malformed one', () => {
    const s = store()
    writePendingJoin(s, TOKEN, now)
    expect(readPendingJoin(s, new Date(now.getTime() + 25 * 3_600_000))).toBeNull()
    expect(s.m.size).toBe(0)
    expect(writePendingJoin(s, 'bad token', now)).toBe(false)
  })
})
