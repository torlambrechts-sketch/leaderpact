import 'server-only'
import { createHmac, randomInt } from 'node:crypto'
import { z } from 'zod'

/**
 * LeaderPact's events to Sentral, the company's platform (handoff A.3; REUSE_EVALUATION 2.0, E2).
 *
 * Sentral receives every product on one function, `product-events`, signed per product: the body is
 * `{"product": "leaderpact", "events": [...]}`, and the headers carry the product, the time and
 * `sha256=HMAC(leaderpact_webhook_secret, "<ts>.<body>")`. Sentral refuses anything older than five minutes
 * and treats an event it has seen (by id) as a duplicate. LeaderPact holds no key to Sentral's database,
 * and Sentral none to LeaderPact's: the shared webhook secret is the whole of the connection (D-35).
 *
 * **Nothing about an answer leaves** (CLAUDE.md invariant 12). The builder refuses any field its kind does
 * not list, and the kinds here are a reader's request for a template and the public site's own pages. The
 * lifecycle events of milestone 17 join this list there, with the outbox and dispatcher the handoff
 * describes; these two are sent at once, because neither is product data.
 *
 * The secret is read from the server's environment only. In development and tests, with no secret set,
 * nothing is sent and the call says so (`unconfigured`); in production that is a failure.
 */
export const PRODUCT_KEY = 'leaderpact'

const KINDS = {
  /** a free template asked for (lib/site/templates.ts): Sentral makes a Sales ticket and a lead of it */
  'template.requested': ['template', 'name', 'email', 'organisation', 'role', 'consent', 'lang'],
  /** the public site's pages and the searches they answer (D-36): Sentral's content plan and tracked keywords */
  'content.inventory': ['site', 'items', 'keywords'],
} as const

export type EventKind = keyof typeof KINDS
export type EventPayload = Record<string, unknown>

const Env = z.object({
  PLATFORM_EVENTS_URL: z.string().url().startsWith('https://'),
  PLATFORM_WEBHOOK_SECRET: z.string().min(32),
})

export type SendResult = 'sent' | 'unconfigured' | 'refused' | 'failed'

/** An event with only the fields its kind lists; throws on an unknown kind or an unlisted field */
export function buildEvent(kind: EventKind, payload: EventPayload) {
  const allowed: readonly string[] = KINDS[kind]
  if (!allowed) throw new Error(`event kind not registered: ${kind}`)
  for (const field of Object.keys(payload)) {
    if (!allowed.includes(field)) throw new Error(`field not listed for ${kind}: ${field}`)
  }
  const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  // Sentral keys a duplicate on (product, id): milliseconds and three random digits, at most 18 digits
  const id = `${Date.now()}${String(randomInt(0, 1000)).padStart(3, '0')}`
  return { id, kind, org_id: null, payload: clean, created_at: new Date().toISOString() }
}

/** The signature Sentral checks: hex HMAC-SHA256 over "<timestamp>.<body>" */
export const sign = (secret: string, timestamp: string, body: string) => `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`

export async function sendEvents(events: ReturnType<typeof buildEvent>[]): Promise<SendResult> {
  const env = Env.safeParse({ PLATFORM_EVENTS_URL: process.env.PLATFORM_EVENTS_URL?.trim(), PLATFORM_WEBHOOK_SECRET: process.env.PLATFORM_WEBHOOK_SECRET?.trim() })
  if (!env.success) {
    if (process.env.VERCEL_ENV === 'production') {
      console.error('[sentral] not configured in production: PLATFORM_EVENTS_URL or PLATFORM_WEBHOOK_SECRET is missing')
      return 'failed'
    }
    console.info(`[sentral] not configured; ${events.length} event(s) not sent (development)`)
    return 'unconfigured'
  }
  const body = JSON.stringify({ product: PRODUCT_KEY, events })
  const timestamp = Math.floor(Date.now() / 1000).toString()
  try {
    const res = await fetch(env.data.PLATFORM_EVENTS_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-product': PRODUCT_KEY,
        'x-platform-timestamp': timestamp,
        'x-platform-signature': sign(env.data.PLATFORM_WEBHOOK_SECRET, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(8000),
    })
    // the status only: a payload can carry what a person wrote (invariant 10)
    if (res.status === 429) return 'refused'
    if (!res.ok) console.error(`[sentral] ${events.map((e) => e.kind).join(',')}: HTTP ${res.status}`)
    return res.ok ? 'sent' : 'failed'
  } catch (error) {
    console.error(`[sentral] ${events.map((e) => e.kind).join(',')}: ${error instanceof Error ? error.name : 'error'}`)
    return 'failed'
  }
}
