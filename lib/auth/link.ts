import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requestOrigin } from '@/lib/auth/origin'
import { keyed, takePublicRate } from '@/lib/limits/key'
import type { LinkResult } from '@/lib/auth/schema'
import { CONFIRM_PATH } from '@/lib/routes'

/**
 * Sends a sign-in link by email (handoff section 8, Authentication; REUSE 4.15), for the server actions
 * that decide whether it may make an account: the sign-in page's (lib/auth/actions.ts) and the invitation
 * page's (lib/group/actions.ts). It is not a server action itself, so no client can ask it to make one.
 *
 * Nothing here logs an address. A failure is logged by Auth's error code alone (CLAUDE.md invariant 10).
 * An address gets at most 5 links an hour (handoff 8; 0021), counted by the app's keyed hash of the address,
 * before Auth is asked: past that, the same answer as Auth's own limit.
 */

/** Auth's codes that mean "too many": its own limits on mail and on requests */
const RATE_LIMITED = new Set(['over_email_send_rate_limit', 'over_request_rate_limit'])
/**
 * Auth's answers for an address without an account when no account may be made. The page says the same
 * thing whether or not the address has an account, so nobody can learn who has one.
 */
const NO_ACCOUNT = new Set(['otp_disabled', 'signup_disabled', 'user_not_found'])

export async function sendSignInLink(where: string, email: string, createUser: boolean): Promise<LinkResult> {
  const origin = await requestOrigin()
  if (!origin) return { ok: false, reason: 'failed' }
  if ((await takePublicRate('sign_in', keyed(`address:${email.trim().toLowerCase()}`))) > 0) return { ok: false, reason: 'rate_limited' }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[auth] ${where}: no Supabase configuration`)
    return { ok: false, reason: 'failed' }
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: createUser, emailRedirectTo: `${origin}${CONFIRM_PATH}` },
  })
  if (!error) return { ok: true }

  const code = error.code ?? (error.status === 429 ? 'over_request_rate_limit' : 'unknown')
  if (RATE_LIMITED.has(code) || error.status === 429) return { ok: false, reason: 'rate_limited' }
  if (!createUser && NO_ACCOUNT.has(code)) return { ok: true }
  if (code === 'email_address_invalid' || code === 'validation_failed') return { ok: false, reason: 'invalid' }
  console.error(`[auth] ${where}: ${code} (${error.status ?? 'no status'})`)
  return { ok: false, reason: 'failed' }
}
