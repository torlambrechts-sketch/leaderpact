/**
 * leaderpact-dispatch: empties the outbox, the round reminders and the events to Sentral (0015, 0022, 0025;
 * D-53, D-55).
 *
 * Called every five minutes by pg_cron through pg_net, with the dispatcher's secret in `x-dispatch-secret`. The
 * secret lives in Vault only (0025 makes it) and the function asks the database whether a call carries it
 * (`dispatch_authorised`), so no person holds it. `verify_jwt` is off because pg_net sends no JWT.
 *
 * Mail goes once its settings are here, as the function's secrets:
 *   LEADERPACT_APP_URL           the app's origin, for the links in a mail
 *   LEADERPACT_MAIL_FROM         the sender's address (TODO(owner): the sending domain, D-26)
 *   BREVO_API_KEY                Brevo's key; or MAILPIT_URL, a local stack's mail catcher
 * Events to Sentral need none of them: the claim hands over the address and the webhook secret from the database.
 * Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; the service key reaches only the functions granted
 * to service_role (CLAUDE.md invariant 8).
 *
 *   POST   drain until the queues are empty or the time is up: {mail, platform}
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { brevoSender, mailpitSender } from '../_shared/brevo.ts'
import { drain } from '../_shared/dispatch.ts'
import { MAIL, PRODUCT_NAME } from '../_shared/messages.gen.ts'
import { drainPlatform } from '../_shared/platform.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'not_configured' }, 503)
  const db = createClient(url, key, { db: { schema: 'app' }, auth: { persistSession: false, autoRefreshToken: false } })

  const { data: authorised, error } = await db.rpc('dispatch_authorised', { p_secret: req.headers.get('x-dispatch-secret') ?? '' })
  if (error) {
    console.error(`[dispatch] authorise: ${error.code ?? 'unknown'}`)
    return json({ error: 'unavailable' }, 503)
  }
  if (authorised !== true) return json({ error: 'unauthorised' }, 403)

  // events to Sentral first: they need nothing but the database
  const platform = await drainPlatform(db, fetch)

  const appUrl = (Deno.env.get('LEADERPACT_APP_URL') ?? '').replace(/\/$/, '')
  const from = Deno.env.get('LEADERPACT_MAIL_FROM') ?? ''
  const brevo = Deno.env.get('BREVO_API_KEY')
  const mailpit = Deno.env.get('MAILPIT_URL')
  const sender = mailpit ? mailpitSender(mailpit) : brevo ? brevoSender(brevo) : null
  const mail =
    /^https?:\/\/[^/]+$/.test(appUrl) && from && sender
      ? await drain(db, sender, { ctx: { messages: MAIL, product: PRODUCT_NAME, appUrl }, from: { email: from, name: PRODUCT_NAME } })
      : { sent: 0, failed: 0, stopped: 'not_configured' }

  const broken = platform.stopped === 'claim_failed' || mail.stopped === 'claim_failed'
  return json({ mail, platform }, broken ? 500 : 200)
})
