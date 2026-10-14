/**
 * leaderpact-dispatch: empties the outbox and the round reminders (0015, 0022; D-53).
 *
 * Called every five minutes by pg_cron through pg_net, with a secret of its own in `x-dispatch-secret` (Vault
 * holds the URL and the secret on the hosted project; with none, nothing calls it). Not the service key: a
 * caller needs to be able to start a drain, nothing else. `verify_jwt` is off because pg_net sends no JWT.
 *
 * Settings, as the function's secrets:
 *   LEADERPACT_DISPATCH_SECRET   the caller's secret
 *   LEADERPACT_APP_URL           the app's origin, for the links in a mail
 *   LEADERPACT_MAIL_FROM         the sender's address (TODO(owner): the sending domain, D-26)
 *   BREVO_API_KEY                Brevo's key; or MAILPIT_URL, a local stack's mail catcher
 * Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service key reaches only the claim and
 * finish functions granted to service_role (CLAUDE.md invariant 8): the database decides who gets what.
 *
 *   POST   drain until both queues are empty or 40 s have passed: {sent, failed, stopped}
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { brevoSender, mailpitSender } from '../_shared/brevo.ts'
import { drain } from '../_shared/dispatch.ts'
import { MAIL, PRODUCT_NAME } from '../_shared/messages.gen.ts'

function same(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let d = 0
  for (let i = 0; i < x.length; i++) d |= x[i]! ^ y[i]!
  return d === 0
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const secret = Deno.env.get('LEADERPACT_DISPATCH_SECRET') ?? ''
  if (!secret || !same(req.headers.get('x-dispatch-secret') ?? '', secret)) return json({ error: 'unauthorised' }, 403)

  const appUrl = (Deno.env.get('LEADERPACT_APP_URL') ?? '').replace(/\/$/, '')
  const from = Deno.env.get('LEADERPACT_MAIL_FROM') ?? ''
  const brevo = Deno.env.get('BREVO_API_KEY')
  const mailpit = Deno.env.get('MAILPIT_URL')
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!/^https?:\/\/[^/]+$/.test(appUrl) || !from || !url || !key) return json({ error: 'not_configured' }, 503)
  const sender = mailpit ? mailpitSender(mailpit) : brevo ? brevoSender(brevo) : null
  if (!sender) return json({ error: 'no_sender' }, 503)

  const db = createClient(url, key, { db: { schema: 'app' }, auth: { persistSession: false, autoRefreshToken: false } })
  const result = await drain(db, sender, {
    ctx: { messages: MAIL, product: PRODUCT_NAME, appUrl },
    from: { email: from, name: PRODUCT_NAME },
  })
  return json(result, result.stopped === 'claim_failed' ? 500 : result.stopped ? 503 : 200)
})
