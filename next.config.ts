import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts')

/**
 * Security headers. Origin: Orgpuls next.config.ts @ 6f5d441 (its S2 review), kept as they are and
 * without its redirects, its analytics origin or its template tracing.
 *
 * - `frame-ancestors 'none'` and `X-Frame-Options: DENY`: a questionnaire cannot be framed by a page
 *   that watches how someone answers. The anonymity promise owes nothing to the database there.
 * - `Referrer-Policy: no-referrer`: the invite link `/j/[code]` carries a capability in its path, and
 *   no subresource may receive it in `Referer`.
 * - The CSP allows the Supabase origin for PostgREST and Auth, and its `wss:` twin for Realtime,
 *   which the live meeting uses (milestone 14). `'unsafe-inline'` in `script-src` is Next's inlined
 *   bootstrap; a per-request nonce is its own piece of work.
 */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const realtime = supabase.replace(/^http/, 'ws')

function csp() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src 'self' ${supabase} ${realtime}`.replace(/\s+/g, ' ').trim(),
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ')
}

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Content-Security-Policy', value: csp() },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // a QA or verification build goes to its own directory, so it never overwrites the dev build
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typedRoutes: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  devIndicators: false,
}

export default withNextIntl(nextConfig)
