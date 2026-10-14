// Origin: Orgpuls lib/supabase/middleware.ts @ 6f5d441 (adapted: deny by default; no host gate; 30-day session cookies).
import { NextResponse, type NextRequest } from 'next/server'
import { capSessionCookie } from '@/lib/supabase/cookies'
import { readSupabaseEnv } from '@/lib/supabase/env'

/**
 * Refreshes the auth session on every request and sends a visitor without one to sign-in.
 * getUser() is used rather than getSession() because it revalidates the token with the auth
 * server: getSession() trusts whatever is in the cookie, which is no basis for an access decision.
 *
 * **Deny by default.** Orgpuls made every unknown kebab-case address public, because its public
 * site has many pages. LeaderPact's public surface is short and named below; every other route
 * needs a session. A new public page is added here on purpose, never by accident. An address under
 * no route at all is neither: it is answered 404 (D-50).
 *
 * The four rules about failure carry over from Orgpuls unchanged, because each was learned from an
 * outage that returned 500 on every URL:
 *
 * 1. **A public path is decided before anything else happens.** The scan and the invite link must
 *    never require a session or depend on configuration they do not use.
 * 2. **Nothing else here may throw.** A missing or malformed Supabase URL is a redirect to sign-in
 *    and a log line, because refusing a request is a decision and a 500 is not.
 * 3. **The auth call is bounded,** at five seconds, then the request is treated as unauthenticated.
 * 4. **Nothing is imported at module scope that could fail to load.** `@supabase/ssr` is loaded
 *    with a dynamic `import()` inside the try. (In Orgpuls the outage this rule was written for was
 *    in fact Vercel running the uncompiled source; `vercel.json` declaring `"framework": "nextjs"`
 *    fixed that, D-43. The rule stays because it is still true and cheap.)
 *
 * All fail closed: no session, no protected page.
 */
export const PUBLIC_PATHS = [
  '/',
  // the landing page and the scan, answered with no account (handoff 6.1-6.3)
  '/leadership-team-assessment',
  '/scan',
  // the group's invite link: a capability in the path, opened by people with no account (6.5)
  '/j',
  // the scan's answers from that link, counted per network (handoff 8, milestone 16)
  '/api/scan',
  // the data export's one-time link: a capability in the path, opened from the mail (6.18, owner D6)
  '/export',
  // an invitation to join a group: a capability in the path, opened before the invitee has signed in (6.8)
  '/join',
  '/leader-profile',
  '/sign-in',
  // an account without the scan (D-44)
  '/sign-up',
  // the email link's confirmation and the OAuth callback
  '/auth',
  '/privacy',
  '/data-processing',
  // the public site's reading pages (D-34 to D-38): articles, free templates and the product pages
  '/articles',
  '/templates',
  '/platform',
  '/research',
  '/anonymity',
  '/leadership-team-assessment-tools',
  // what search engines and answer engines read
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  // the component specimens (milestone 1), for the side-by-side check; app/specimens refuses production
  '/specimens',
] as const

export const SIGN_IN_PATH = '/sign-in'

/**
 * The addresses that need a session: the signed-in app, and API routes if any are added. Every route the app has
 * sits under PUBLIC_PATHS or here; tests/unit/middleware.test.ts reads `app/` to hold that, so a new route is
 * named on purpose, public or not.
 */
export const SESSION_PATHS = ['/app', '/api'] as const

export const isPublic = (path: string) => PUBLIC_PATHS.some((p) => path === p || (p !== '/' && path.startsWith(`${p}/`)))

/**
 * Whether an address is under none of the app's routes (D-50): a link from the domain's earlier site, or a typo.
 * There is nothing there to protect, so it goes on to Next, which answers 404 with the site's not-found page,
 * where it used to go to sign-in and tell search engines that every old address was a sign-in page. The address
 * is read the way a router could read it: decoded, repeated slashes as one, and without case, so no spelling of a
 * session path counts as unknown. An address that cannot be decoded is not called unknown: it fails closed.
 */
export function isUnknown(path: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return false
  }
  const first = (decoded.replace(/\/{2,}/g, '/').split('/')[1] ?? '').toLowerCase()
  if (first === '') return false
  return ![...PUBLIC_PATHS, ...SESSION_PATHS].some((p) => p === `/${first}`)
}

/** Long enough for a healthy round trip, short enough that the platform never gets there. */
const AUTH_TIMEOUT_MS = 5000

function deadline(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname
  // no session needed here, so nothing here may depend on one being obtainable
  if (isPublic(path)) return NextResponse.next({ request })
  // no route here at all: Next answers 404, with nothing behind it to guard (D-50)
  if (isUnknown(path)) return NextResponse.next({ request })

  try {
    return await guard(request)
  } catch (error) {
    console.error('[middleware] refusing the request: the access check failed', error)
    return toSignIn(request)
  }
}

/**
 * The last resort. If even the sign-in redirect cannot be built, the request goes on to a page
 * that decides for itself: a page with no session renders its own refusal, a 500 renders nothing.
 */
export async function safeUpdateSession(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (error) {
    console.error('[middleware] the middleware itself failed; passing the request on', error)
    return NextResponse.next()
  }
}

function toSignIn(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = SIGN_IN_PATH
  url.search = ''
  return NextResponse.redirect(url)
}

async function guard(request: NextRequest) {
  // inside the try, on purpose: rule 4
  const { createServerClient } = await import('@supabase/ssr')

  const env = readSupabaseEnv()
  if ('problem' in env) {
    console.error(`[middleware] refusing the request: ${env.problem}`)
    return toSignIn(request)
  }
  for (const warning of env.warnings) console.warn(`[middleware] ${warning}`)

  const pass = () => NextResponse.next({ request })
  let response = pass()

  const supabase = createServerClient(env.url, env.key, {
    global: {
      // an unbounded call here is an outage waiting for a slow day
      fetch: (input, init) => fetch(input, { ...init, signal: deadline(AUTH_TIMEOUT_MS) }),
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = pass()
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, capSessionCookie(options)))
      },
    },
  })

  const { data, error } = await supabase.auth.getUser()

  // "no session" is the ordinary case for an anonymous visitor; logging it would bury real errors
  if (error && error.name !== 'AuthSessionMissingError') {
    console.error('[middleware] refusing the request: the auth check failed', error.message)
    return toSignIn(request)
  }
  if (!data.user) return toSignIn(request)

  return response
}
