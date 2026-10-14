/**
 * The mails LeaderPact sends, rendered from the `mail` messages (handoff 6.18 and 8; 0022; D-53).
 *
 * Pure on purpose: no imports, no Deno or Node globals. The dispatcher imports it, and
 * tests/unit/mail.test.ts runs it under Vitest against messages/en.json, so what the tests prove is what is sent.
 *
 * What a mail may carry is narrow: it goes to one person, names nobody else, and never says who has or has not
 * answered (CLAUDE.md invariants 2 and 12). No answer, score or count. Every value from the database is
 * HTML-escaped before it is placed in markup.
 */

export interface Recipient {
  email: string
  name: string | null
}

export interface Rendered {
  subject: string
  text: string
  html: string
}

/** The `mail` subtree of messages/en.json */
export type MailMessages = Record<string, string>

export type RoundKind = 'diagnostic' | 'pulse'

export interface RoundInviteFacts {
  group: string
  team: string
  round: string
  round_kind: RoundKind
  number: number
  closes_at: string
}

export interface MemberInviteFacts {
  group: string
  leader: string | null
  expires_at: string
  path: string
}

export interface ExportFacts {
  path: string
  expires_at: string
}

export interface SummaryGroup {
  group: string
  team: string
  to_answer: Array<{ round: string; kind: RoundKind; closes_at: string }>
  actions: Array<{ title: string; due_on: string | null }>
  meeting: { title: string; meets_on: string; starts_at: string | null } | null
}

/** What a reminder needs (0022 claim_reminders) */
export interface ReminderFacts {
  group: string
  team: string
  round: string
  round_kind: RoundKind
  number: number
  closes_at: string
}

export interface MailContext {
  messages: MailMessages
  product: string
  /** the app's origin, no trailing slash: "https://app.example" */
  appUrl: string
}

// ---------------------------------------------------------------- the app's paths (the same as lib/routes.ts)
export const paths = {
  home: (team: string) => `/app/${team}/home`,
  round: (team: string, round: string) => `/app/${team}/assess/${round}`,
  notifications: (team: string) => `/app/${team}/settings/notifications`,
  app: '/app',
}

// ---------------------------------------------------------------- helpers
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** A message with its {arguments} filled in; a missing message throws, so a renamed key fails the tests */
export function say(m: MailMessages, key: string, args: Record<string, string | number> = {}): string {
  const text = m[key]
  if (typeof text !== 'string') throw new Error(`mail message missing: ${key}`)
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in args ? String(args[name]) : whole))
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const DAY_TIME = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })

/** A day as the product writes it: "14 October 2026" (a date column, or a time read on UTC's day) */
export function day(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso)
  return DAY.format(d)
}

/** A day and a time, on UTC: "14 October 2026 at 15:30 UTC" */
export function dayTime(iso: string): string {
  return `${DAY_TIME.format(new Date(iso))} UTC`
}

function link(ctx: MailContext, path: string): string {
  return `${ctx.appUrl}${path}`
}

interface Block {
  /** a paragraph, or a list of lines under a heading */
  p?: string
  heading?: string
  lines?: string[]
}

/** One mail in text and HTML from its parts: greeting, blocks, one button, a footer */
function compose(ctx: MailContext, to: Recipient | null, subject: string, blocks: Block[], action: { label: string; url: string }, footer: string[]): Rendered {
  const hello = to?.name ? say(ctx.messages, 'hello', { name: to.name }) : say(ctx.messages, 'helloPlain')
  const text = [
    hello,
    ...blocks.map((b) => (b.p ? b.p : [b.heading, ...(b.lines ?? []).map((l) => `- ${l}`)].filter(Boolean).join('\n'))),
    `${action.label}: ${action.url}`,
    ...footer,
    ctx.product,
  ].join('\n\n')
  const html = [
    `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>`,
    '<body style="margin:0;padding:24px;background:#f1ece5;font-family:Figtree,Arial,sans-serif;color:#111111">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px">',
    `<p style="margin:0 0 16px;font-size:16px">${escapeHtml(hello)}</p>`,
    ...blocks.map((b) =>
      b.p
        ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.55">${escapeHtml(b.p)}</p>`
        : `<p style="margin:0 0 6px;font-size:15px;font-weight:700">${escapeHtml(b.heading ?? '')}</p>` +
          `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.55">${(b.lines ?? []).map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`,
    ),
    `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:12px">${escapeHtml(action.label)}</a></p>`,
    ...footer.map((f) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5f5a52">${escapeHtml(f)}</p>`),
    `<p style="margin:16px 0 0;font-size:13px;color:#5f5a52">${escapeHtml(ctx.product)}</p>`,
    '</div></body></html>',
  ].join('')
  return { subject, text, html }
}

const what = (ctx: MailContext, kind: RoundKind, number: number) =>
  kind === 'pulse' ? say(ctx.messages, 'kind_pulse', { number }) : say(ctx.messages, 'kind_diagnostic')

// ---------------------------------------------------------------- the five mails
/** To every invited member at once, so it greets nobody by name */
export function renderRoundInvite(ctx: MailContext, f: RoundInviteFacts): Rendered {
  const m = ctx.messages
  const w = what(ctx, f.round_kind, f.number)
  return compose(
    ctx,
    null,
    say(m, 'roundSubject', { group: f.group, what: w }),
    [{ p: say(m, 'roundBody', { what: w, date: day(f.closes_at) }) }, { p: say(m, 'roundAnon') }],
    { label: say(m, 'roundAction'), url: link(ctx, paths.round(f.team, f.round)) },
    [say(m, 'footer', { product: ctx.product })],
  )
}

/** To every member who has not answered at once, so it greets nobody by name */
export function renderReminder(ctx: MailContext, f: ReminderFacts): Rendered {
  const m = ctx.messages
  const w = what(ctx, f.round_kind, f.number)
  return compose(
    ctx,
    null,
    say(m, 'reminderSubject', { group: f.group }),
    [{ p: say(m, 'reminderBody', { what: w, date: day(f.closes_at) }) }, { p: say(m, 'reminderNote') }],
    { label: say(m, 'roundAction'), url: link(ctx, paths.round(f.team, f.round)) },
    [say(m, 'footer', { product: ctx.product })],
  )
}

export function renderMemberInvite(ctx: MailContext, to: Recipient, f: MemberInviteFacts): Rendered {
  const m = ctx.messages
  const args = { leader: f.leader ?? '', group: f.group, product: ctx.product }
  return compose(
    ctx,
    to,
    f.leader ? say(m, 'inviteSubject', args) : say(m, 'inviteSubjectPlain', args),
    [
      { p: f.leader ? say(m, 'inviteBody', args) : say(m, 'inviteBodyPlain', args) },
      { p: say(m, 'inviteAbout', { product: ctx.product }) },
      { p: say(m, 'inviteUntil', { date: day(f.expires_at) }) },
    ],
    { label: say(m, 'inviteAction', { group: f.group }), url: link(ctx, f.path) },
    [say(m, 'footerInvite', { product: ctx.product })],
  )
}

export function renderExport(ctx: MailContext, to: Recipient, f: ExportFacts): Rendered {
  const m = ctx.messages
  return compose(
    ctx,
    to,
    say(m, 'exportSubject', { product: ctx.product }),
    [{ p: say(m, 'exportBody', { product: ctx.product, date: dayTime(f.expires_at) }) }, { p: say(m, 'exportNote') }],
    { label: say(m, 'exportAction'), url: link(ctx, f.path) },
    [say(m, 'footer', { product: ctx.product })],
  )
}

export function renderSummary(ctx: MailContext, to: Recipient, groups: SummaryGroup[]): Rendered {
  const m = ctx.messages
  const blocks: Block[] = [{ p: say(m, 'summaryLead') }]
  for (const g of groups) {
    const lines = [
      ...g.to_answer.map((r) => say(m, 'summaryAnswer', { what: r.kind === 'pulse' ? say(m, 'kind_pulseAny') : say(m, 'kind_diagnostic'), date: day(r.closes_at) })),
      ...g.actions.map((a) => (a.due_on ? say(m, 'summaryAction', { title: a.title, date: day(a.due_on) }) : say(m, 'summaryActionNoDate', { title: a.title }))),
      ...(g.meeting ? [say(m, 'summaryMeeting', { title: g.meeting.title, date: day(g.meeting.meets_on) })] : []),
    ]
    if (lines.length > 0) blocks.push({ heading: g.group, lines })
  }
  const first = groups[0]
  return compose(
    ctx,
    to,
    say(m, 'summarySubject', { product: ctx.product }),
    blocks,
    { label: say(m, 'summaryOpen', { product: ctx.product }), url: link(ctx, first ? paths.home(first.team) : paths.app) },
    [say(m, 'summaryFooter'), say(m, 'footer', { product: ctx.product })],
  )
}
