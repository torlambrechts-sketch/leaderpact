import { createHmac } from 'node:crypto'
import type { BrowserContext } from '@playwright/test'

/**
 * A signed-in session where there is no Auth to send a link: a cloud session's local Data API, whose
 * proxy answers Auth's user lookup for tokens signed with the run's secret (scripts/qa/local-api.sh, D-27).
 * The cookie is the one @supabase/ssr writes. In CI, LOCAL_API_JWT_SECRET is unset and the flows sign in
 * through the real email link instead (support/mail.ts).
 */
export const canMintSession = () => !!process.env.LOCAL_API_JWT_SECRET && !!process.env.NEXT_PUBLIC_SUPABASE_URL

export async function signInAs(context: BrowserContext, user: { id: string; email: string }, baseURL: string) {
  const secret = process.env.LOCAL_API_JWT_SECRET
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!secret || !api) throw new Error('no local Auth: run scripts/qa/local-api.sh')
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}`
  const token = `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
  const session = {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'local-only',
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() },
  }
  const name = `sb-${new URL(api).hostname.split('.')[0]}-auth-token`
  await context.addCookies([{ name, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`, url: baseURL, sameSite: 'Lax' }])
}
