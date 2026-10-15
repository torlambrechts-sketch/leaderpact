import { describe, expect, it } from 'vitest'
import { confirmSchema, emailSchema, linkRequestSchema } from '@/lib/auth/schema'
import { startGroupSchema, startReplySchema } from '@/lib/groups/schema'
import { inviteRowSchema, submitReplySchema, submitSchema } from '@/lib/scan/link'
import { SESSION_MAX_AGE, capSessionCookie } from '@/lib/supabase/cookies'

/**
 * Milestone 4's server boundaries (CLAUDE.md: Zod at every server boundary): what the sign-in, the group
 * start and the scan's write path accept, and what they accept back from the database.
 */
const UUID = '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f'
const CODE = 'lumioLeadershipScan00001'

describe('sign-in', () => {
  it('trims and lower-cases an address, and refuses what is not one', () => {
    expect(emailSchema.parse('  Kari.Nordmann@Lumio.Example ')).toBe('kari.nordmann@lumio.example')
    for (const bad of ['', 'kari', 'kari@', '@lumio.example', `${'a'.repeat(250)}@lumio.example`]) expect(emailSchema.safeParse(bad).success).toBe(false)
  })

  it('knows four intents only: the scan, the profile, signing in, and an account without the scan (D-44)', () => {
    for (const intent of ['save', 'profile', 'sign_in', 'sign_up']) expect(linkRequestSchema.safeParse({ email: 'a@b.example', intent }).success).toBe(true)
    expect(linkRequestSchema.safeParse({ email: 'a@b.example', intent: 'register' }).success).toBe(false)
  })

  it('passes on a link token of the right shape and type only', () => {
    expect(confirmSchema.safeParse({ token_hash: 'a'.repeat(56), type: 'email' }).success).toBe(true)
    // a reset and a sign-up's confirmation come back to the same page (D-57); any other type does not
    expect(confirmSchema.safeParse({ token_hash: 'a'.repeat(56), type: 'recovery' }).success).toBe(true)
    expect(confirmSchema.safeParse({ token_hash: 'a'.repeat(56), type: 'invite' }).success).toBe(false)
    expect(confirmSchema.safeParse({ token_hash: 'short', type: 'email' }).success).toBe(false)
    expect(confirmSchema.safeParse({ token_hash: '<script>alert(1)</script>xxxxxx', type: 'email' }).success).toBe(false)
  })

  it('caps a session cookie at 30 days and lets a removal through', () => {
    expect(capSessionCookie({ maxAge: 400 * 86_400, path: '/' })).toEqual({ maxAge: SESSION_MAX_AGE, path: '/' })
    expect(capSessionCookie({ maxAge: 60 })).toEqual({ maxAge: 60 })
    expect(capSessionCookie({ maxAge: 0 })).toEqual({ maxAge: 0 })
    expect(capSessionCookie(undefined)).toEqual({ maxAge: SESSION_MAX_AGE })
    expect(SESSION_MAX_AGE).toBe(30 * 24 * 60 * 60)
  })
})

describe('starting a group', () => {
  it('takes a name, a size of 4 to 15 and a request id', () => {
    expect(startGroupSchema.parse({ name: '  Lumio leadership group ', size: 8, request: UUID }).name).toBe('Lumio leadership group')
    for (const size of [3, 16, 7.5]) expect(startGroupSchema.safeParse({ name: 'G', size, request: UUID }).success).toBe(false)
    expect(startGroupSchema.safeParse({ name: '   ', size: 8, request: UUID }).success).toBe(false)
    expect(startGroupSchema.safeParse({ name: 'G', size: 8 }).success).toBe(false)
  })

  it("reads start_group's reply: the group and the link's code, or a reason", () => {
    expect(startReplySchema.safeParse({ ok: true, team: UUID, code: CODE }).success).toBe(true)
    expect(startReplySchema.safeParse({ ok: false, reason: 'signed_out' }).success).toBe(true)
    expect(startReplySchema.safeParse({ ok: true, team: UUID }).success).toBe(false)
  })
})

describe("the scan's write path", () => {
  const answers = Array.from({ length: 12 }, (_, i) => ({ item: UUID.replace(/.$/, String(i % 10)), value: (i % 5) + 1 }))

  it('takes the code, every answer from 1 to 5 and the replace key', () => {
    expect(submitSchema.safeParse({ code: CODE, answers, replaceKey: null }).success).toBe(true)
    expect(submitSchema.safeParse({ code: CODE, answers, replaceKey: 'K'.repeat(43) }).success).toBe(true)
    expect(submitSchema.safeParse({ code: CODE, answers: [{ item: UUID, value: 6 }], replaceKey: null }).success).toBe(false)
    expect(submitSchema.safeParse({ code: CODE, answers: [{ item: UUID, value: 0 }], replaceKey: null }).success).toBe(false)
    expect(submitSchema.safeParse({ code: 'short', answers, replaceKey: null }).success).toBe(false)
    expect(submitSchema.safeParse({ code: CODE, answers: [], replaceKey: null }).success).toBe(false)
  })

  it('sends no person: the payload has the code, the answers and the key, and Zod strips anything else', () => {
    const parsed = submitSchema.parse({ code: CODE, answers, replaceKey: null, person: UUID, email: 'a@b.example' })
    expect(Object.keys(parsed).sort()).toEqual(['answers', 'code', 'replaceKey'])
  })

  it('refuses a reply that carries an id (CLAUDE.md invariant 4)', () => {
    expect(submitReplySchema.safeParse({ ok: true, replace_key: 'K'.repeat(43) }).success).toBe(true)
    expect(submitReplySchema.safeParse({ ok: true, replace_key: null }).success).toBe(true)
    expect(submitReplySchema.safeParse({ ok: true, replace_key: null, id: UUID }).success).toBe(false)
    expect(submitReplySchema.safeParse({ ok: false, reason: 'full' }).success).toBe(true)
  })

  it("reads the link page's row: a count and a date, and no score", () => {
    const row = { group_name: 'G', phase: 'open', answered: 1, member_count: 8, closes_at: '2026-10-19T10:00:00Z', instrument_version_id: UUID }
    expect(inviteRowSchema.safeParse(row).success).toBe(true)
    expect(Object.keys(inviteRowSchema.shape).some((k) => /level|score|agreement|mean/.test(k))).toBe(false)
  })
})
