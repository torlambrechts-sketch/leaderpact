import 'server-only'
import { createTranslator } from 'next-intl'
import { z } from 'zod'
import messages from '@/messages/en.json'
import { PRODUCT_NAME } from '@/lib/brand'

/**
 * A copy for the owner of each new account and each template download (owner, 16 October 2026; D-59), beside what
 * Sentral receives. One mail per event, through Brevo's transactional API, to the address in OWNER_NOTICE_TO.
 *
 * - **Only what Sentral is told, or less.** Each kind lists the fields it may carry, as the event builder does
 *   (lib/platform/sentral.ts), and the builder refuses any other. Nothing about a scan, an answer, a group or a
 *   round is a field of either kind (CLAUDE.md invariants 2 and 12).
 * - **Never in the way.** The callers send it after the response (`after()`), so a slow or failing mail never
 *   holds up a sign-up or a download. A failure is logged by kind and HTTP status, never with a name or an
 *   address (invariant 10), and is not retried: the record stays in Auth and in Sentral.
 * - **Off until set.** Without BREVO_API_KEY, OWNER_NOTICE_TO and LEADERPACT_MAIL_FROM nothing is sent, and the
 *   log says which variable is missing. No address is written in the code: the repository is public.
 */
const KINDS = {
  /** a new account, the first time it reaches /app/new (0029): any way in */
  sign_up: ['name', 'email', 'company', 'method'],
  /** a free template asked for (D-37): the fields of Sentral's template.requested */
  template: ['template', 'name', 'email', 'organisation', 'role', 'consent'],
} as const

export type NoticeKind = keyof typeof KINDS
export type NoticeFields = Record<string, string | boolean | null | undefined>
export const SIGN_IN_METHODS = ['email', 'google', 'azure'] as const

const Env = z.object({
  BREVO_API_KEY: z.string().min(20),
  OWNER_NOTICE_TO: z.string().trim().toLowerCase().pipe(z.email()),
  LEADERPACT_MAIL_FROM: z.string().trim().toLowerCase().pipe(z.email()),
})

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** The mail for one event: refuses a field its kind does not list; an empty value reads "Not given" */
export function buildNotice(kind: NoticeKind, fields: NoticeFields) {
  const allowed: readonly string[] = KINDS[kind]
  if (!allowed) throw new Error(`owner notice kind not registered: ${kind}`)
  for (const field of Object.keys(fields)) {
    if (!allowed.includes(field)) throw new Error(`field not listed for ${kind}: ${field}`)
  }
  const t = createTranslator({ locale: 'en', messages, namespace: 'ownerNotice' })
  const text = (field: string) => {
    const v = fields[field]
    if (typeof v === 'boolean') return v ? t('yes') : t('no')
    if (field === 'method') return (SIGN_IN_METHODS as readonly string[]).includes(v ?? '') ? t(`method_${v as (typeof SIGN_IN_METHODS)[number]}`) : t('notGiven')
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : t('notGiven')
  }
  const rows = allowed.map((field) => [t(`field_${field as 'name'}`), text(field)] as const)
  const who = text('name') === t('notGiven') ? text('email') : text('name')
  const subject = kind === 'sign_up' ? t('signUpSubject', { product: PRODUCT_NAME, who }) : t('templateSubject', { template: text('template'), who })
  const lead = kind === 'sign_up' ? t('signUpLead', { product: PRODUCT_NAME }) : t('templateLead')
  const foot = kind === 'sign_up' ? t('signUpFoot') : t('templateFoot')
  return {
    subject,
    text: [lead, '', ...rows.map(([label, value]) => `${label}: ${value}`), '', foot].join('\n'),
    html:
      `<p>${escape(lead)}</p><table cellpadding="4" style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;font-size:14px;">` +
      rows.map(([label, value]) => `<tr><td style="color:#55524a;">${escape(label)}</td><td>${escape(value)}</td></tr>`).join('') +
      `</table><p style="color:#55524a;font-size:13px;">${escape(foot)}</p>`,
  }
}

export type NoticeResult = 'sent' | 'unconfigured' | 'failed'

export async function notifyOwner(kind: NoticeKind, fields: NoticeFields, fetcher: typeof fetch = fetch): Promise<NoticeResult> {
  const env = Env.safeParse({
    BREVO_API_KEY: process.env.BREVO_API_KEY?.trim(),
    OWNER_NOTICE_TO: process.env.OWNER_NOTICE_TO,
    LEADERPACT_MAIL_FROM: process.env.LEADERPACT_MAIL_FROM,
  })
  if (!env.success) {
    const missing = env.error.issues.map((i) => i.path.join('.')).join(', ')
    console.info(`[owner-notice] ${kind} not sent: ${missing} not set`)
    return 'unconfigured'
  }
  let mail: ReturnType<typeof buildNotice>
  try {
    mail = buildNotice(kind, fields)
  } catch (error) {
    console.error(`[owner-notice] ${kind}: ${error instanceof Error ? error.message : 'build failed'}`)
    return 'failed'
  }
  try {
    const res = await fetcher('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.data.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: env.data.LEADERPACT_MAIL_FROM, name: PRODUCT_NAME },
        to: [{ email: env.data.OWNER_NOTICE_TO }],
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
        tags: [`owner_${kind}`],
      }),
      signal: AbortSignal.timeout(8000),
    })
    // the status only: Brevo's error text can quote an address
    await res.body?.cancel()
    if (!res.ok) console.error(`[owner-notice] ${kind}: HTTP ${res.status}`)
    return res.ok ? 'sent' : 'failed'
  } catch (error) {
    console.error(`[owner-notice] ${kind}: ${error instanceof Error ? error.name : 'error'}`)
    return 'failed'
  }
}
