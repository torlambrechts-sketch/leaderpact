import 'server-only'
import { headers } from 'next/headers'

/**
 * The address this request was made to, for the email link to come back to (`emailRedirectTo`). Auth
 * accepts it only if it is on the project's list of redirect addresses, so a forged host header gains
 * nothing: Auth falls back to the site address instead.
 */
export async function requestOrigin(): Promise<string | null> {
  const h = await headers()
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0]!.trim()
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return null
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  const proto = (h.get('x-forwarded-proto') ?? (local ? 'http' : 'https')).split(',')[0]!.trim()
  if (proto !== 'https' && !(proto === 'http' && local)) return null
  return `${proto}://${host}`
}
