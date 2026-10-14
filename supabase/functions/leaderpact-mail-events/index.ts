/**
 * leaderpact-mail-events: Brevo's delivery events, for the addresses that get no more mail (0022; D-53).
 *
 * Brevo posts one event, or a list of them. A hard bounce, a spam report or an unsubscription goes to
 * `suppress_address`, which keeps only the address's SHA-256; every other event is dropped. The webhook is
 * registered with a secret in its address (`?key=`), compared in constant time; `verify_jwt` is off because
 * Brevo sends no JWT. The address is never logged or kept in clear.
 *
 * Settings: LEADERPACT_MAIL_EVENTS_SECRET; Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const KINDS: Record<string, 'hard_bounce' | 'spam' | 'unsubscribed'> = {
  hard_bounce: 'hard_bounce',
  hardBounce: 'hard_bounce',
  spam: 'spam',
  complaint: 'spam',
  unsubscribed: 'unsubscribed',
}

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
  const secret = Deno.env.get('LEADERPACT_MAIL_EVENTS_SECRET') ?? ''
  if (!secret || !same(new URL(req.url).searchParams.get('key') ?? '', secret)) return json({ error: 'unauthorised' }, 403)
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json({ error: 'not_configured' }, 503)

  const body = await req.json().catch(() => null)
  const events: unknown[] = Array.isArray(body) ? body : body ? [body] : []
  const db = createClient(url, key, { db: { schema: 'app' }, auth: { persistSession: false, autoRefreshToken: false } })
  let kept = 0
  for (const e of events.slice(0, 500)) {
    if (typeof e !== 'object' || e === null) continue
    const { event, email } = e as { event?: unknown; email?: unknown }
    const kind = typeof event === 'string' ? KINDS[event] : undefined
    if (!kind || typeof email !== 'string' || !email.includes('@')) continue
    const { error } = await db.rpc('suppress_address', { p_email: email, p_reason: kind })
    if (error) console.error(`[mail-events] suppress_address: ${error.code ?? 'unknown'}`)
    else kept++
  }
  return json({ kept })
})
