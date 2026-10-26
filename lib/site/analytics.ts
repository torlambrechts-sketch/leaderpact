import { mayCount, utmFrom } from './beacon'

/**
 * Vercel Web Analytics on the public site (D-69), held to the site's own counting rules (D-39, lib/site/beacon.ts):
 * the same pages are never counted, nothing is sent from a browser that asks not to be tracked, only the
 * production hosts count, and an address keeps no query string but the five campaign tags. No custom events.
 */

/** Analytics runs only on Vercel's production deployment, never on a preview, a test stack or a laptop */
export const analyticsOn = (vercelEnv: string | undefined) => vercelEnv === 'production'

/** The address Vercel may receive for a page view, or null when it must not receive one */
export function analyticsUrl(url: string, optedOut: boolean): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  // no test-stack override here: analytics counts only on the production hosts
  if (!mayCount(u.hostname, u.pathname, optedOut, '')) return null
  const tags = new URLSearchParams(utmFrom(u.search)).toString()
  return `${u.origin}${u.pathname}${tags ? `?${tags}` : ''}`
}
