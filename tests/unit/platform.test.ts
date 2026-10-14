import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PRODUCT, drainPlatform, signBody, type PlatformDb } from '../../supabase/functions/_shared/platform.ts'
import { PRODUCT_KEY } from '@/lib/platform/sentral'

/**
 * Milestone 17 (handoff A.3; D-54): events reach Sentral signed the way its product-events checks them
 * (Sentral `_shared/signing.ts` verifyWebhook: `sha256=` and the hex HMAC-SHA256 of "<timestamp>.<body>", at most
 * five minutes old). The database's half (what may be emitted, the claim, the audit) is
 * supabase/tests/platform_invariants.sql.
 */

/** Sentral's check, as its _shared/signing.ts writes it, in Node's crypto */
function sentralVerifies(secret: string, timestamp: string, signature: string, body: string, nowSec: number): boolean {
  if (!/^\d{1,12}$/.test(timestamp) || !signature.startsWith('sha256=')) return false
  if (Math.abs(nowSec - Number(timestamp)) > 300) return false
  return signature.slice(7).toLowerCase() === createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

const SECRET = 'a'.repeat(64)
const URL_ = 'https://sentral.example/functions/v1/product-events'
const event = (id: number) => ({ id, kind: 'usage.daily', org_id: '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f', payload: { members: 5, groups: 1 }, created_at: '2026-10-14T03:35:00+00:00' })

function fakeDb(claims: unknown[]) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const db: PlatformDb = {
    async rpc(fn, args) {
      calls.push({ fn, args })
      if (fn === 'platform_events_claim') return { data: claims.shift() ?? { url: URL_, secret: SECRET, events: [] }, error: null }
      return { data: 1, error: null }
    },
  }
  return { db, calls }
}

describe('the events to Sentral', () => {
  it('are for the product Sentral knows LeaderPact by', () => {
    expect(PRODUCT).toBe('leaderpact')
    expect(PRODUCT).toBe(PRODUCT_KEY)
  })

  it('are signed as Sentral checks, and a changed body or an old time fails its check', async () => {
    const body = JSON.stringify({ product: PRODUCT, events: [event(1)] })
    const sig = await signBody(SECRET, '1760000000', body)
    expect(sentralVerifies(SECRET, '1760000000', sig, body, 1760000100)).toBe(true)
    expect(sentralVerifies(SECRET, '1760000000', sig, body.replace('5', '6'), 1760000100)).toBe(false)
    expect(sentralVerifies(SECRET, '1760000000', sig, body, 1760000400)).toBe(false)
    expect(sentralVerifies('b'.repeat(64), '1760000000', sig, body, 1760000100)).toBe(false)
  })

  it('post each claimed batch once, with the product and a fresh signature, and report it delivered', async () => {
    const posts: Array<{ url: string; init: RequestInit }> = []
    const { db, calls } = fakeDb([{ url: URL_, secret: SECRET, events: [event(7), event(8)] }])
    const result = await drainPlatform(db, async (url, init) => (posts.push({ url, init }), new Response('{"received":2}')), { now: () => 1760000000000, log: () => undefined })
    expect(result).toEqual({ delivered: 2, failed: 0, stopped: null })
    expect(posts).toHaveLength(1)
    const headers = posts[0]!.init.headers as Record<string, string>
    const body = String(posts[0]!.init.body)
    expect(posts[0]!.url).toBe(URL_)
    expect(headers['x-platform-product']).toBe('leaderpact')
    expect(headers['x-platform-timestamp']).toBe('1760000000')
    expect(sentralVerifies(SECRET, headers['x-platform-timestamp']!, headers['x-platform-signature']!, body, 1760000001)).toBe(true)
    expect(JSON.parse(body)).toEqual({ product: 'leaderpact', events: [event(7), event(8)] })
    expect(calls.find((c) => c.fn === 'platform_events_done')?.args).toEqual({ p_ids: [7, 8], p_ok: true, p_error: null })
  })

  it('a refused batch is given back with its status, and the run stops', async () => {
    const { db, calls } = fakeDb([{ url: URL_, secret: SECRET, events: [event(9)] }, { url: URL_, secret: SECRET, events: [event(10)] }])
    const result = await drainPlatform(db, async () => new Response('', { status: 500 }), { log: () => undefined })
    expect(result).toEqual({ delivered: 0, failed: 1, stopped: 'http_500' })
    expect(calls.filter((c) => c.fn === 'platform_events_claim')).toHaveLength(1)
    expect(calls.find((c) => c.fn === 'platform_events_done')?.args).toEqual({ p_ids: [9], p_ok: false, p_error: 'http_500' })
  })

  it('with delivery off nothing is posted; an unreadable claim posts nothing either', async () => {
    let posted = 0
    const off = fakeDb([{ url: null, events: [] }])
    expect(await drainPlatform(off.db, async () => (posted++, new Response('')), { log: () => undefined })).toEqual({ delivered: 0, failed: 0, stopped: null })
    const odd = fakeDb([{ url: URL_, secret: SECRET, events: [{ id: 'x' }] }])
    expect((await drainPlatform(odd.db, async () => (posted++, new Response('')), { log: () => undefined })).stopped).toBe('claim_unreadable')
    const insecure = fakeDb([{ url: 'http://sentral.example/x', secret: SECRET, events: [event(11)] }])
    expect((await drainPlatform(insecure.db, async () => (posted++, new Response('')), { log: () => undefined })).stopped).toBe('not_installed')
    expect(posted).toBe(0)
  })

  it('logs counts and codes, never a payload or the secret', async () => {
    const lines: string[] = []
    const { db } = fakeDb([{ url: URL_, secret: SECRET, events: [event(12)] }])
    await drainPlatform(db, async () => new Response('', { status: 401 }), { log: (l) => lines.push(l) })
    expect(lines).toEqual(['[platform] 1 event(s): http_401'])
  })
})
