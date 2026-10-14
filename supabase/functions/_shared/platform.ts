/**
 * Events to Sentral, from the outbox 0025 fills (handoff A.3; D-55). Pure on purpose: the database and the
 * network are passed in, so tests/unit/platform.test.ts drives it under Vitest against Sentral's own check.
 *
 * Sentral receives every product on one function, product-events: the body is `{"product": "leaderpact",
 * "events": [...]}` and the headers carry the product, the time and `sha256=<hex HMAC-SHA256 of "<ts>.<body>">`
 * under the product's webhook secret, which the claim hands over from Vault (Sentral `_shared/signing.ts`,
 * verifyWebhook; it refuses anything older than five minutes). An event id is the outbox's, at most 18 digits;
 * Sentral keeps one row per (product, id), so a resend is a duplicate, not a second event.
 *
 * A batch that fails is reported with its HTTP status and claimed again later, at most 20 times. Log lines
 * carry counts and codes only, never a payload.
 */

export const PRODUCT = 'leaderpact'

export interface PlatformDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>
}

type Fetch = (input: string, init: RequestInit) => Promise<Response>

export interface PlatformResult {
  delivered: number
  failed: number
  stopped: string | null
}

const enc = new TextEncoder()
const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

/** The signature Sentral checks: `sha256=` and the hex HMAC-SHA256 of "<timestamp>.<body>" */
export async function signBody(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return `sha256=${toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${body}`))))}`
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

interface Claim {
  url: string | null
  secret: string | null
  events: Array<{ id: number; kind: string; org_id: string | null; payload: Record<string, unknown>; created_at: string }>
}

function readClaim(data: unknown): Claim | null {
  if (!isObj(data) || !Array.isArray(data.events)) return null
  const events: Claim['events'] = []
  for (const e of data.events) {
    if (!isObj(e) || typeof e.id !== 'number' || !Number.isInteger(e.id) || typeof e.kind !== 'string' || !isObj(e.payload) || typeof e.created_at !== 'string') return null
    if (!(e.org_id === null || typeof e.org_id === 'string')) return null
    events.push({ id: e.id, kind: e.kind, org_id: e.org_id, payload: e.payload, created_at: e.created_at })
  }
  const url = typeof data.url === 'string' && /^https:\/\/[^\s/]+(\/\S*)?$/.test(data.url) ? data.url : null
  const secret = typeof data.secret === 'string' && data.secret.length >= 32 ? data.secret : null
  return { url, secret, events }
}

export async function drainPlatform(
  db: PlatformDb,
  fetcher: Fetch,
  opts: { batch?: number; budgetMs?: number; now?: () => number; log?: (line: string) => void } = {},
): Promise<PlatformResult> {
  const now = opts.now ?? Date.now
  const deadline = now() + (opts.budgetMs ?? 20_000)
  const log = opts.log ?? ((line: string) => console.log(line))
  const result: PlatformResult = { delivered: 0, failed: 0, stopped: null }

  while (now() < deadline) {
    const claimed = await db.rpc('platform_events_claim', { p_batch: opts.batch ?? 50 })
    if (claimed.error) {
      log(`[platform] claim: ${claimed.error.code ?? 'unknown'}`)
      return { ...result, stopped: 'claim_failed' }
    }
    const claim = readClaim(claimed.data)
    if (!claim) {
      log('[platform] claim: unreadable')
      return { ...result, stopped: 'claim_unreadable' }
    }
    if (claim.events.length === 0) return result
    const ids = claim.events.map((e) => e.id)
    if (!claim.url || !claim.secret) {
      // delivery switched off between the claim's check and now: give them back
      await db.rpc('platform_events_done', { p_ids: ids, p_ok: false, p_error: 'not_installed' })
      return { ...result, stopped: 'not_installed' }
    }
    const body = JSON.stringify({ product: PRODUCT, events: claim.events })
    const timestamp = Math.floor(now() / 1000).toString()
    let code: string | null = null
    try {
      const res = await fetcher(claim.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-platform-product': PRODUCT,
          'x-platform-timestamp': timestamp,
          'x-platform-signature': await signBody(claim.secret, timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(15_000),
      })
      await res.body?.cancel()
      if (!res.ok) code = `http_${res.status}`
    } catch {
      code = 'network'
    }
    const done = await db.rpc('platform_events_done', { p_ids: ids, p_ok: code === null, p_error: code })
    if (done.error) log(`[platform] done: ${done.error.code ?? 'unknown'}`)
    if (code !== null) {
      log(`[platform] ${ids.length} event(s): ${code}`)
      result.failed += ids.length
      return { ...result, stopped: code }
    }
    result.delivered += ids.length
  }
  return result
}
