/**
 * Where the public site's visit counting goes (D-39, after Orgpuls D-248): Sentral's `web-collect` edge
 * function, in Frankfurt (eu-central-1). It knows the site by the request's origin (leaderpact.com is
 * Sentral's registered site, its 0090), drops bots, turns the address and the browser string into a
 * visitor code with a key that changes every day, and stores neither.
 *
 * Imported by next.config.ts for the CSP's `connect-src`, so it imports nothing.
 * `NEXT_PUBLIC_WEB_COLLECT_URL` replaces it for a test stack; set, it also lets the beacon send from a host
 * that is not a production one.
 */
export const COLLECT_OVERRIDE = process.env.NEXT_PUBLIC_WEB_COLLECT_URL?.trim() || ''

export const COLLECT_URL =
  COLLECT_OVERRIDE || 'https://zuvqbaejoktpekfsiyyr.supabase.co/functions/v1/web-collect?forceFunctionRegion=eu-central-1'

export const COLLECT_ORIGIN = new URL(COLLECT_URL).origin
