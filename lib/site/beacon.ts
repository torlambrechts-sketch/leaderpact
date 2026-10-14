// Origin: Orgpuls lib/marketing/beacon.ts @ d9b1c52 (adapted: LeaderPact's paths and hosts, no signup form).
import { COLLECT_OVERRIDE, COLLECT_URL } from './collect'

/**
 * The public site's own visit counting (D-39): a page view, a press on "Start the scan", and a template
 * asked for. They go to Sentral's `web-collect` (lib/site/collect.ts). Nothing is stored on the device.
 *
 * The body says which page, which campaign brought the visit (the five utm_ keys), and the host that referred
 * it, once per page load; a press says which, as a code. Never who: no name, no address, no answer, no query
 * string (CLAUDE.md invariant 10).
 *
 * **Never on a page that answers or carries a capability:** the scan and its result, a member's invite link
 * (/j), the Leader Profile's tests, sign-in and its confirmation, the app, a template's file. Nothing about an
 * answer leaves for Sentral (invariant 12), not even that someone was answering. Nothing is sent from a
 * browser that asks not to be tracked (Global Privacy Control, Do Not Track), or from a host that is not a
 * production one unless a test stack names its own collector.
 */
export type BeaconBody =
  | { k: 'view'; p: string; r?: string; u?: Record<string, string> }
  | { k: 'cta'; p: string; l: string; u?: Record<string, string> }

/** The paths never counted: questionnaires, results, capabilities, sign-in, the app and files */
export const NEVER = /^\/(scan|j|app|auth|sign-in|specimens|api)(\/|$)|^\/leader-profile\/.|^\/templates\/file\//

/** The hosts a visit is counted on */
export const PUBLIC_HOSTS = ['www.leaderpact.com', 'leaderpact.com']

/** A press's code, as Sentral takes it */
export type Press = 'start-scan' | 'template'

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

/** The campaign tags of an address: the five standard keys only, each at most 80 characters */
export function utmFrom(search: string): Record<string, string> {
  const params = new URLSearchParams(search)
  const out: Record<string, string> = {}
  for (const k of UTM_KEYS) {
    const v = params.get(k)?.trim()
    if (v) out[k] = v.slice(0, 80)
  }
  return out
}

export function referrerHost(referrer: string, self: string): string | undefined {
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    return host && host !== self.toLowerCase() ? host : undefined
  } catch {
    return undefined
  }
}

export function mayCount(host: string, path: string, optedOut: boolean, override = COLLECT_OVERRIDE): boolean {
  if (optedOut || NEVER.test(path)) return false
  return !!override || PUBLIC_HOSTS.includes(host.toLowerCase())
}

export function beaconBody(kind: { k: 'view' } | { k: 'cta'; l: Press }, path: string, utm: Record<string, string>, referrer?: string): BeaconBody {
  const p = path.slice(0, 160)
  const u = Object.keys(utm).length ? { u: utm } : {}
  if (kind.k === 'cta') return { k: 'cta', p, l: kind.l, ...u }
  return { k: 'view', p, ...(referrer ? { r: referrer } : {}), ...u }
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

// the referring host is the page load's, not every client-side navigation's after it
let referrerSent = false

export function sendBeacon(kind: { k: 'view' } | { k: 'cta'; l: Press }): void {
  try {
    const { hostname, pathname, search } = window.location
    if (!mayCount(hostname, pathname, optedOut())) return
    const referrer = kind.k === 'view' && !referrerSent ? referrerHost(document.referrer, hostname) : undefined
    if (kind.k === 'view') referrerSent = true
    const body = JSON.stringify(beaconBody(kind, pathname, utmFrom(search), referrer))
    // a keepalive fetch in cors mode: navigator.sendBeacon posts in no-cors mode, and under this site's
    // no-referrer policy such a request says `Origin: null`, which web-collect cannot place; text/plain
    // needs no preflight
    void fetch(COLLECT_URL, {
      method: 'POST',
      body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'content-type': 'text/plain' },
    }).catch(() => {})
  } catch {
    // counting never breaks a page
  }
}
