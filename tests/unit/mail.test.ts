import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import { PRODUCT_NAME } from '@/lib/brand'
import { notificationsPath, roundPath, homePath, APP_PATH } from '@/lib/routes'
import { MAIL, PRODUCT_NAME as GEN_PRODUCT } from '../../supabase/functions/_shared/messages.gen.ts'
import {
  day,
  dayTime,
  escapeHtml,
  paths,
  renderExport,
  renderMemberInvite,
  renderReminder,
  renderRoundInvite,
  renderSummary,
  say,
  type MailContext,
} from '../../supabase/functions/_shared/mail.ts'

/**
 * Milestone 16 (handoff 6.18 and 8; D-53): the mails the dispatcher sends, rendered from messages/en.json as
 * deployed. A mail goes to one person, names nobody else and never says who has or has not answered.
 */
const ctx: MailContext = { messages: en.mail, product: PRODUCT_NAME, appUrl: 'https://app.example' }
const TEAM = '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f'
const ROUND = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

describe('the generated messages', () => {
  it('are the mail messages and the product name as committed', () => {
    expect(MAIL).toEqual(en.mail)
    expect(GEN_PRODUCT).toBe(PRODUCT_NAME)
    expect(() => execFileSync('node', ['scripts/functions/build.mjs', '--check'], { stdio: 'pipe' })).not.toThrow()
  })

  it('use simple arguments only, which say() fills', () => {
    for (const text of Object.values(en.mail)) expect(text).not.toMatch(/\{\w+,/)
    expect(say(en.mail, 'hello', { name: 'Kari' })).toBe('Hello Kari,')
    expect(() => say(en.mail, 'no_such_key')).toThrow()
  })

  it('link to the same paths as the app', () => {
    expect(paths.home(TEAM)).toBe(homePath(TEAM))
    expect(paths.round(TEAM, ROUND)).toBe(roundPath(TEAM, ROUND))
    expect(paths.notifications(TEAM)).toBe(notificationsPath(TEAM))
    expect(paths.app).toBe(APP_PATH)
  })
})

describe('the mails', () => {
  it('a round invitation greets nobody, links to the round and says answers carry no name', () => {
    const m = renderRoundInvite(ctx, { group: 'Lumio <b>', team: TEAM, round: ROUND, round_kind: 'pulse', number: 2, closes_at: '2026-10-21T08:00:00Z' })
    expect(m.subject).toBe('Lumio <b>: pulse 2 is open')
    expect(m.text).toContain('Hello,')
    expect(m.text).toContain('21 October 2026')
    expect(m.text).toContain(`https://app.example/app/${TEAM}/assess/${ROUND}`)
    expect(m.text).toContain('never who')
    // the group's name is escaped in markup
    expect(m.html).toContain('Lumio &lt;b&gt;')
    expect(m.html).not.toContain('Lumio <b>')
  })

  it('a reminder names nobody and says nobody sees who has not answered', () => {
    const m = renderReminder(ctx, { group: 'Lumio', team: TEAM, round: ROUND, round_kind: 'diagnostic', number: 1, closes_at: '2026-10-21T08:00:00Z' })
    expect(m.subject).toBe('Lumio: a reminder to answer')
    expect(m.text).toContain('the Full diagnostic')
    expect(m.text).toContain('Nobody sees who has or has not answered')
    expect(m.text.startsWith('Hello,')).toBe(true)
  })

  it('an invitation carries its own link and the leader, or none', () => {
    const m = renderMemberInvite(ctx, { email: 'a@example.com', name: 'Ola' }, { group: 'Lumio', leader: 'Kari Nordmann', expires_at: '2026-10-28T00:00:00Z', path: '/join/abc' })
    expect(m.subject).toBe('Kari Nordmann invites you to Lumio')
    expect(m.text).toContain('Hello Ola,')
    expect(m.text).toContain('https://app.example/join/abc')
    const plain = renderMemberInvite(ctx, { email: 'a@example.com', name: null }, { group: 'Lumio', leader: null, expires_at: '2026-10-28T00:00:00Z', path: '/join/abc' })
    expect(plain.subject).toBe('You are invited to Lumio')
    expect(plain.text).not.toContain('null')
  })

  it("the export's mail carries the one-time link and when it lapses", () => {
    const m = renderExport(ctx, { email: 'a@example.com', name: 'Kari' }, { path: '/export/tok', expires_at: '2026-10-15T15:30:00Z' })
    expect(m.text).toContain('https://app.example/export/tok')
    expect(m.text).toContain('15 October 2026 at 15:30 UTC')
  })

  it('a summary lists what waits, per group, and never a count of answers', () => {
    const m = renderSummary(ctx, { email: 'a@example.com', name: 'Kari' }, [
      {
        group: 'Lumio',
        team: TEAM,
        to_answer: [{ round: ROUND, kind: 'pulse', closes_at: '2026-10-21T08:00:00Z' }],
        actions: [{ title: 'Write the brief', due_on: '2026-10-20' }, { title: 'Book the room', due_on: null }],
        meeting: { title: 'Monthly', meets_on: '2026-10-22', starts_at: null },
      },
    ])
    expect(m.text).toContain('Answer the pulse, open until 21 October 2026')
    expect(m.text).toContain('Write the brief, due 20 October 2026')
    expect(m.text).toContain('- Book the room')
    expect(m.text).toContain('Next meeting: Monthly, 22 October 2026')
    expect(m.text).toContain(`https://app.example/app/${TEAM}/home`)
    expect(m.text).not.toMatch(/answered\b(?! the)/)
  })

  it('formats days and times in British English on UTC, and escapes markup', () => {
    expect(day('2026-10-02')).toBe('2 October 2026')
    expect(dayTime('2026-10-02T09:05:00Z')).toBe('2 October 2026 at 09:05 UTC')
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })

  it('the dispatcher reads no setting it does not document', () => {
    const src = readFileSync('supabase/functions/leaderpact-dispatch/index.ts', 'utf8')
    const read = [...src.matchAll(/Deno\.env\.get\('([A-Z_]+)'\)/g)].map((x) => x[1]).sort()
    expect(read).toEqual(['BREVO_API_KEY', 'LEADERPACT_APP_URL', 'LEADERPACT_DISPATCH_SECRET', 'LEADERPACT_MAIL_FROM', 'MAILPIT_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL'])
  })
})
