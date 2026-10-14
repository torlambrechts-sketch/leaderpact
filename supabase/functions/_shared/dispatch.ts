/**
 * The dispatcher's loop (0022; D-53): claim a batch, render, send, report each row, until the queue is empty
 * or the time is up. Pure on purpose: the database and the sender are passed in, so tests/unit/dispatch.test.ts
 * drives it under Vitest with fakes.
 *
 * Two queues: the outbox (invitations, round invitations, the export's link, summaries) and the round
 * reminders' ledger (0015). A mail to several people goes as one message per person, with the same words
 * for each, so it greets nobody by name and nobody sees another address. A row that cannot be read or
 * rendered is reported not sent with a code, and given up after five tries by the database. A refused key
 * stops the run. Log lines carry row ids and codes, never an address, a name or a link.
 */
import type { Outgoing, Sender } from './brevo.ts'
import {
  renderExport,
  renderMemberInvite,
  renderReminder,
  renderRoundInvite,
  renderSummary,
  type MailContext,
  type Recipient,
  type Rendered,
  type RoundKind,
  type SummaryGroup,
} from './mail.ts'

export interface Db {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>
}

export interface DrainOptions {
  ctx: MailContext
  from: { email: string; name: string }
  batch?: number
  budgetMs?: number
  now?: () => number
  log?: (line: string) => void
}

export interface DrainResult {
  sent: number
  failed: number
  stopped: string | null
}

// ---------------------------------------------------------------- reading a claimed row, without trusting it
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isKind = (v: unknown): v is RoundKind => v === 'diagnostic' || v === 'pulse'
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

function recipients(v: unknown): Recipient[] | null {
  if (!Array.isArray(v) || v.length === 0) return null
  const out: Recipient[] = []
  for (const r of v) {
    if (!isObj(r) || !isStr(r.email) || !(r.name === null || r.name === undefined || typeof r.name === 'string')) return null
    out.push({ email: r.email, name: typeof r.name === 'string' && r.name ? r.name : null })
  }
  return out
}

function summaryGroups(v: unknown): SummaryGroup[] | null {
  if (!Array.isArray(v)) return null
  const out: SummaryGroup[] = []
  for (const g of v) {
    if (!isObj(g) || !isStr(g.group) || !isStr(g.team) || !Array.isArray(g.to_answer) || !Array.isArray(g.actions)) return null
    const toAnswer = g.to_answer.map((r) => (isObj(r) && isStr(r.round) && isKind(r.kind) && isStr(r.closes_at) ? { round: r.round, kind: r.kind, closes_at: r.closes_at } : null))
    const actions = g.actions.map((a) => (isObj(a) && isStr(a.title) && (a.due_on === null || isStr(a.due_on)) ? { title: a.title, due_on: a.due_on as string | null } : null))
    const mt = g.meeting
    const meeting = mt === null || mt === undefined ? null : isObj(mt) && isStr(mt.title) && isStr(mt.meets_on) ? { title: mt.title, meets_on: mt.meets_on, starts_at: isStr(mt.starts_at) ? mt.starts_at : null } : undefined
    if (toAnswer.includes(null) || actions.includes(null) || meeting === undefined) return null
    out.push({ group: g.group, team: g.team, to_answer: toAnswer as SummaryGroup['to_answer'], actions: actions as SummaryGroup['actions'], meeting })
  }
  return out
}

/** One outbox row's mail, or null when its facts do not read */
export function renderOutbox(ctx: MailContext, row: unknown): { to: Recipient[]; mail: Rendered; tag: string } | null {
  if (!isObj(row) || !isStr(row.id)) return null
  const to = recipients(row.to)
  const f = row.facts
  if (!to) return null
  if (row.kind === 'round_invite') {
    if (!isObj(f) || !isStr(f.group) || !isStr(f.team) || !isStr(f.round) || !isKind(f.round_kind) || !isInt(f.number) || !isStr(f.closes_at)) return null
    return { to, tag: 'round_invite', mail: renderRoundInvite(ctx, { group: f.group, team: f.team, round: f.round, round_kind: f.round_kind, number: f.number, closes_at: f.closes_at }) }
  }
  // a person's mail goes to one address
  if (to.length !== 1) return null
  const one = to[0]!
  if (row.kind === 'member_invite') {
    if (!isObj(f) || !isStr(f.group) || !(f.leader === null || isStr(f.leader)) || !isStr(f.expires_at) || !isStr(f.path) || !f.path.startsWith('/join/')) return null
    return { to, tag: 'member_invite', mail: renderMemberInvite(ctx, one, { group: f.group, leader: (f.leader as string | null) ?? null, expires_at: f.expires_at, path: f.path }) }
  }
  if (row.kind === 'export_ready') {
    if (!isObj(f) || !isStr(f.path) || !f.path.startsWith('/export/') || !isStr(f.expires_at)) return null
    return { to, tag: 'export_ready', mail: renderExport(ctx, one, { path: f.path, expires_at: f.expires_at }) }
  }
  if (row.kind === 'summary') {
    const groups = summaryGroups(f)
    if (!groups) return null
    return { to, tag: 'summary', mail: renderSummary(ctx, one, groups) }
  }
  return null
}

/** One reminder's mail, or null when it does not read */
export function renderReminderRow(ctx: MailContext, row: unknown): { to: Recipient[]; mail: Rendered; tag: string } | null {
  if (!isObj(row) || !isStr(row.round) || !isInt(row.day)) return null
  const to = recipients(row.recipients)
  if (!to || !isStr(row.group) || !isStr(row.team) || !isKind(row.round_kind) || !isInt(row.number) || !isStr(row.closes_at)) return null
  return {
    to,
    tag: 'round_reminder',
    mail: renderReminder(ctx, { group: row.group, team: row.team, round: row.round, round_kind: row.round_kind, number: row.number, closes_at: row.closes_at }),
  }
}

// ---------------------------------------------------------------- the loop
export async function drain(db: Db, sender: Sender, opts: DrainOptions): Promise<DrainResult> {
  const now = opts.now ?? Date.now
  const deadline = now() + (opts.budgetMs ?? 40_000)
  const batch = opts.batch ?? 25
  const log = opts.log ?? ((line: string) => console.log(line))
  const result: DrainResult = { sent: 0, failed: 0, stopped: null }

  const ready = await sender.ready()
  if (!ready.ok) {
    log(`[dispatch] sender not ready: ${ready.code}`)
    return { ...result, stopped: ready.auth ? 'sender_auth' : ready.code }
  }

  const out = (r: { to: Recipient[]; mail: Rendered; tag: string }): Outgoing => ({ from: opts.from, to: r.to, subject: r.mail.subject, html: r.mail.html, text: r.mail.text, tag: r.tag })

  // each queue in turn until both are empty, the time is up or the key is refused
  let more = true
  while (more && now() < deadline && !result.stopped) {
    more = false

    const claimed = await db.rpc('claim_mail', { p_limit: batch })
    if (claimed.error) {
      log(`[dispatch] claim_mail: ${claimed.error.code ?? 'unknown'}`)
      return { ...result, stopped: 'claim_failed' }
    }
    const rows = Array.isArray(claimed.data) ? claimed.data : []
    if (rows.length > 0) more = true
    for (const row of rows) {
      const id = isObj(row) && isStr(row.id) ? row.id : null
      if (!id) continue
      if (result.stopped) {
        await db.rpc('finish_mail', { p_id: id, p_sent: false, p_error: result.stopped })
        continue
      }
      const r = renderOutbox(opts.ctx, row)
      if (!r) {
        log(`[dispatch] ${id}: unreadable`)
        await db.rpc('finish_mail', { p_id: id, p_sent: false, p_error: 'unreadable' })
        result.failed++
        continue
      }
      const sent = await sender.send(out(r))
      if (!sent.ok && sent.auth) result.stopped = 'sender_auth'
      if (!sent.ok) log(`[dispatch] ${id}: ${sent.code}`)
      const fin = await db.rpc('finish_mail', { p_id: id, p_sent: sent.ok, p_error: sent.ok ? null : sent.code })
      if (fin.error) log(`[dispatch] finish_mail ${id}: ${fin.error.code ?? 'unknown'}`)
      if (sent.ok) result.sent++
      else result.failed++
    }

    if (result.stopped || now() >= deadline) break
    const reminders = await db.rpc('claim_reminders', { p_limit: batch })
    if (reminders.error) {
      log(`[dispatch] claim_reminders: ${reminders.error.code ?? 'unknown'}`)
      return { ...result, stopped: 'claim_failed' }
    }
    const due = Array.isArray(reminders.data) ? reminders.data : []
    if (due.length > 0) more = true
    for (const row of due) {
      const key = isObj(row) && isStr(row.round) && isInt(row.day) ? { p_round: row.round, p_day: row.day } : null
      if (!key) continue
      const r = result.stopped ? null : renderReminderRow(opts.ctx, row)
      if (!r) {
        if (!result.stopped) log(`[dispatch] reminder ${key.p_round}/${key.p_day}: unreadable`)
        await db.rpc('finish_reminder', { ...key, p_sent: false })
        if (!result.stopped) result.failed++
        continue
      }
      const sent = await sender.send(out(r))
      if (!sent.ok && sent.auth) result.stopped = 'sender_auth'
      if (!sent.ok) log(`[dispatch] reminder ${key.p_round}/${key.p_day}: ${sent.code}`)
      await db.rpc('finish_reminder', { ...key, p_sent: sent.ok })
      if (sent.ok) result.sent++
      else result.failed++
    }
  }
  return result
}
