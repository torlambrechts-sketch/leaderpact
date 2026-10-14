import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { anonClient } from '@/lib/supabase/anon'

/**
 * The public limits' keys (handoff 8, Rate limits; 0021; D-53). "Per IP" is read as per network, a /24 for IPv4
 * and a /48 for IPv6, since a whole office answers from one address and a phone moves within its carrier's.
 * Neither a network nor an address reaches the database: the key is an HMAC-SHA256 under RATE_LIMIT_SECRET, so
 * no row names anyone and nobody without the secret can spend another network's count. Without the secret (a
 * local stack, CI) the key is a plain SHA-256.
 */

/** The client's address as the platform reports it: the first of x-forwarded-for, then x-real-ip */
export function clientAddress(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || null
}

/** The network an address belongs to: its /24 for IPv4, its /48 for IPv6; null for anything else */
export function networkOf(address: string | null): string | null {
  if (!address) return null
  const v4 = address.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i)
  if (v4) {
    const parts = v4.slice(1, 5).map(Number)
    if (parts.some((p) => p > 255)) return null
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
  }
  if (!/^[0-9a-f:]+$/i.test(address) || !address.includes(':')) return null
  // the first three groups, with :: expanded
  const [head = '', tail = ''] = address.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = address.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left
  if (groups.length !== 8 || groups.some((g) => g.length > 4)) return null
  return `${groups.slice(0, 3).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/48`
}

/** A key the database may hold: 64 hex characters that name nobody */
export function keyed(value: string): string {
  const secret = process.env.RATE_LIMIT_SECRET
  return secret ? createHmac('sha256', secret).update(value).digest('hex') : createHash('sha256').update(`leaderpact:${value}`).digest('hex')
}

/**
 * One request on a public bucket: 0 to go on, or the seconds to wait. A failed count lets the request through
 * (logged by code), since the scan's cap and Auth's own limits still stand behind it.
 */
export async function takePublicRate(bucket: 'scan_submit' | 'sign_in', key: string): Promise<number> {
  const client = anonClient()
  if (!client) return 0
  const { data, error } = await client.schema('app').rpc('take_public_rate', { p_bucket: bucket, p_key: key })
  if (error || typeof data !== 'number') {
    console.error(`[limits] ${bucket}: ${error?.code ?? 'unreadable'}`)
    return 0
  }
  return data
}
