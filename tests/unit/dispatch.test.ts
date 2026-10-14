import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import { brevoSender, mailpitSender, type Outgoing, type Sender, type SendResult } from '../../supabase/functions/_shared/brevo.ts'
import { drain, renderOutbox, renderReminderRow, type Db } from '../../supabase/functions/_shared/dispatch.ts'

/**
 * Milestone 16 (D-53): the dispatcher's loop, with a fake database and a fake sender. Each claimed row is
 * reported once, a mail to several goes to each as the same words, a refused key stops the run, and nothing
 * the loop logs carries an address, a name or a link.
 */
const ctx = { messages: en.mail, product: 'LeaderPact', appUrl: 'https://app.example' }
const from = { email: 'noreply@example.com', name: 'LeaderPact' }
const TEAM = '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f'
const ROUND = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

const roundRow = (id: string) => ({
  id,
  kind: 'round_invite',
  to: [{ email: 'ola@example.com', name: 'Ola' }, { email: 'kari@example.com', name: 'Kari' }],
  facts: { group: 'Lumio', team: TEAM, round: ROUND, round_kind: 'diagnostic', number: 1, closes_at: '2026-10-21T08:00:00Z' },
})
const exportRow = (id: string) => ({ id, kind: 'export_ready', to: [{ email: 'kari@example.com', name: 'Kari' }], facts: { path: '/export/tok', expires_at: '2026-10-15T15:30:00Z' } })
const reminder = { round: ROUND, day: 3, team: TEAM, group: 'Lumio', round_kind: 'pulse', number: 2, closes_at: '2026-10-21T08:00:00Z', recipients: [{ email: 'ola@example.com', name: 'Ola' }] }

function fakeDb(batches: { mail: unknown[][]; reminders: unknown[][] }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const db: Db = {
    async rpc(fn, args) {
      calls.push({ fn, args })
      if (fn === 'claim_mail') return { data: batches.mail.shift() ?? [], error: null }
      if (fn === 'claim_reminders') return { data: batches.reminders.shift() ?? [], error: null }
      return { data: 'sent', error: null }
    },
  }
  return { db, calls }
}

function fakeSender(results: SendResult[] = [], ready: SendResult = { ok: true }) {
  const sent: Outgoing[] = []
  const sender: Sender = {
    ready: async () => ready,
    send: async (m) => (sent.push(m), results.shift() ?? { ok: true }),
  }
  return { sender, sent }
}

describe('reading a claimed row', () => {
  it('renders each kind it knows, and refuses one that does not read', () => {
    expect(renderOutbox(ctx, roundRow('a'))?.to).toHaveLength(2)
    expect(renderOutbox(ctx, exportRow('b'))?.tag).toBe('export_ready')
    expect(renderOutbox(ctx, { ...exportRow('c'), facts: { path: 'https://elsewhere.example/x', expires_at: '2026-10-15T15:30:00Z' } })).toBeNull()
    // a person's mail to two addresses is refused
    expect(renderOutbox(ctx, { ...exportRow('d'), to: roundRow('x').to })).toBeNull()
    expect(renderOutbox(ctx, { id: 'e', kind: 'unknown', to: [{ email: 'a@example.com', name: null }], facts: {} })).toBeNull()
    expect(renderOutbox(ctx, { ...roundRow('f'), facts: { ...roundRow('f').facts, round_kind: 'scan' } })).toBeNull()
    expect(renderReminderRow(ctx, reminder)?.mail.subject).toBe('Lumio: a reminder to answer')
    expect(renderReminderRow(ctx, { ...reminder, recipients: [] })).toBeNull()
  })
})

describe('the loop', () => {
  it('sends each row once and reports it, then the reminders, until both queues are empty', async () => {
    const { db, calls } = fakeDb({ mail: [[roundRow('a'), exportRow('b')]], reminders: [[reminder]] })
    const { sender, sent } = fakeSender()
    const result = await drain(db, sender, { ctx, from, log: () => undefined })
    expect(result).toEqual({ sent: 3, failed: 0, stopped: null })
    expect(sent.map((m) => m.tag)).toEqual(['round_invite', 'export_ready', 'round_reminder'])
    // the round's mail goes to both as the same words, greeting nobody by name
    expect(sent[0]!.to.map((r) => r.email)).toEqual(['ola@example.com', 'kari@example.com'])
    expect(sent[0]!.text).not.toContain('Ola')
    expect(calls.filter((c) => c.fn === 'finish_mail').map((c) => [c.args.p_id, c.args.p_sent])).toEqual([['a', true], ['b', true]])
    expect(calls.filter((c) => c.fn === 'finish_reminder').map((c) => c.args)).toEqual([{ p_round: ROUND, p_day: 3, p_sent: true }])
    // it asked once more of each queue and found them empty
    expect(calls.filter((c) => c.fn === 'claim_mail')).toHaveLength(2)
  })

  it('reports a failed send with its code, and an unreadable row as unreadable', async () => {
    const { db, calls } = fakeDb({ mail: [[exportRow('a'), { id: 'b', kind: 'summary', to: [{ email: 'x@example.com', name: null }], facts: 'nonsense' }]], reminders: [] })
    const { sender } = fakeSender([{ ok: false, retryable: true, auth: false, code: 'http_500' }])
    const result = await drain(db, sender, { ctx, from, log: () => undefined })
    expect(result).toEqual({ sent: 0, failed: 2, stopped: null })
    expect(calls.filter((c) => c.fn === 'finish_mail').map((c) => c.args)).toEqual([
      { p_id: 'a', p_sent: false, p_error: 'http_500' },
      { p_id: 'b', p_sent: false, p_error: 'unreadable' },
    ])
  })

  it('a refused key stops the run: the rest of the batch goes back unsent, and no reminder is claimed', async () => {
    const { db, calls } = fakeDb({ mail: [[exportRow('a'), exportRow('b')]], reminders: [[reminder]] })
    const { sender, sent } = fakeSender([{ ok: false, retryable: true, auth: true, code: 'http_401' }])
    const result = await drain(db, sender, { ctx, from, log: () => undefined })
    expect(result.stopped).toBe('sender_auth')
    expect(sent).toHaveLength(1)
    expect(calls.filter((c) => c.fn === 'finish_mail').map((c) => c.args)).toEqual([
      { p_id: 'a', p_sent: false, p_error: 'http_401' },
      { p_id: 'b', p_sent: false, p_error: 'sender_auth' },
    ])
    expect(calls.some((c) => c.fn === 'claim_reminders')).toBe(false)
  })

  it('claims nothing when the sender is not ready', async () => {
    const { db, calls } = fakeDb({ mail: [[exportRow('a')]], reminders: [] })
    const { sender } = fakeSender([], { ok: false, retryable: true, auth: true, code: 'http_401' })
    const result = await drain(db, sender, { ctx, from, log: () => undefined })
    expect(result).toEqual({ sent: 0, failed: 0, stopped: 'sender_auth' })
    expect(calls).toHaveLength(0)
  })

  it('stops claiming when its time is up', async () => {
    let t = 0
    const { db, calls } = fakeDb({ mail: [[exportRow('a')], [exportRow('b')], [exportRow('c')]], reminders: [] })
    const { sender } = fakeSender()
    const result = await drain(db, sender, { ctx, from, budgetMs: 10, now: () => (t += 4), log: () => undefined })
    expect(result.sent).toBeLessThan(3)
    expect(calls.filter((c) => c.fn === 'claim_mail').length).toBeLessThan(3)
  })

  it('logs ids and codes, never an address, a name or a link', async () => {
    const lines: string[] = []
    const { db } = fakeDb({ mail: [[exportRow('a'), { id: 'b', kind: 'summary', to: [{ email: 'x@example.com', name: 'Ola' }], facts: 1 }]], reminders: [[{ ...reminder, group: 7 }]] })
    const { sender } = fakeSender([{ ok: false, retryable: true, auth: false, code: 'http_502' }])
    await drain(db, sender, { ctx, from, log: (l) => lines.push(l) })
    expect(lines.length).toBeGreaterThan(0)
    for (const l of lines) expect(l).not.toMatch(/@|Ola|Kari|https?:|\/export\//)
  })
})

describe('the senders', () => {
  it('Brevo sends one version per person and passes no response text on', async () => {
    const bodies: Array<Record<string, unknown>> = []
    const fetcher = async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)))
      return new Response('{"message":"invalid address ola@example.com"}', { status: 400 })
    }
    const result = await brevoSender('key', fetcher).send({ from, to: [{ email: 'ola@example.com', name: 'Ola' }, { email: 'kari@example.com', name: null }], subject: 's', html: 'h', text: 't', tag: 'round_invite' })
    expect(result).toEqual({ ok: false, retryable: false, auth: false, code: 'http_400' })
    expect(bodies[0]!.messageVersions).toEqual([{ to: [{ email: 'ola@example.com', name: 'Ola' }] }, { to: [{ email: 'kari@example.com' }] }])
    expect(bodies[0]!.to).toBeUndefined()
  })

  it('Brevo reads a refused key as auth, and Mailpit sends one message per person', async () => {
    const refused = await brevoSender('key', async () => new Response('', { status: 401 })).ready()
    expect(refused).toMatchObject({ ok: false, auth: true })
    const urls: string[] = []
    const ok = await mailpitSender('http://127.0.0.1:54324/', async (url) => (urls.push(url), new Response('{}'))).send({ from, to: [{ email: 'a@example.com', name: null }, { email: 'b@example.com', name: null }], subject: 's', html: 'h', text: 't', tag: 'x' })
    expect(ok).toEqual({ ok: true })
    expect(urls).toEqual(['http://127.0.0.1:54324/api/v1/send', 'http://127.0.0.1:54324/api/v1/send'])
  })
})
