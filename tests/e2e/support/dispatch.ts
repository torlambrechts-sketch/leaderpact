import { execFileSync } from 'node:child_process'
import en from '../../../messages/en.json'
import { PRODUCT_NAME } from '../../../lib/brand'
import { mailpitSender, type Outgoing, type Sender } from '../../../supabase/functions/_shared/brevo.ts'
import { drain, type Db } from '../../../supabase/functions/_shared/dispatch.ts'

/**
 * The dispatcher's own loop (supabase/functions/_shared/dispatch.ts), run from a flow against the local
 * database: the claim, the render and the report are the edge function's, only the transport differs. In CI
 * the mail goes to the stack's Mailpit (MAILPIT_URL); in a cloud session it is kept here. A local database
 * only: the URL must name 127.0.0.1 or localhost.
 */
const DB = process.env.DB_URL ?? process.env.DATABASE_URL ?? ''
export const canDispatch = () => /^postgres(ql)?:\/\/[^@]+@(127\.0\.0\.1|localhost)(:\d+)?\//.test(DB)

const FUNCTIONS = new Set(['claim_mail', 'finish_mail', 'claim_reminders', 'finish_reminder'])
const literal = (v: unknown) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)

const psqlDb: Db = {
  async rpc(fn, args) {
    if (!FUNCTIONS.has(fn)) throw new Error(`not a dispatcher function: ${fn}`)
    const list = Object.entries(args).map(([k, v]) => `${k} => ${literal(v)}`).join(', ')
    const out = execFileSync('psql', [DB, '-At', '-v', 'ON_ERROR_STOP=1', '-c', `select to_jsonb(app.${fn}(${list}))`], { encoding: 'utf8' })
    return { data: JSON.parse(out.trim() || 'null'), error: null }
  },
}

/** Drains the outbox and the reminders once; the mails, as sent */
export async function dispatchOnce(appUrl: string): Promise<Outgoing[]> {
  const kept: Outgoing[] = []
  const mailpit = process.env.MAILPIT_URL ? mailpitSender(process.env.MAILPIT_URL) : null
  const sender: Sender = {
    ready: async () => ({ ok: true }),
    send: async (m) => {
      kept.push(m)
      return mailpit ? mailpit.send(m) : { ok: true }
    },
  }
  const result = await drain(psqlDb, sender, { ctx: { messages: en.mail, product: PRODUCT_NAME, appUrl: appUrl.replace(/\/$/, '') }, from: { email: 'noreply@leaderpact.local', name: PRODUCT_NAME }, log: () => undefined })
  if (result.stopped) throw new Error(`the dispatcher stopped: ${result.stopped}`)
  return kept
}
