'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requestOrigin } from '@/lib/auth/origin'
import { confirmSchema, linkRequestSchema, type ConfirmState, type LinkResult } from '@/lib/auth/schema'
import { CONFIRM_PATH, LANDING_PATH, NEW_GROUP_PATH } from '@/lib/routes'

/**
 * Sign-in by email link (handoff section 8, Authentication; REUSE 4.15). The link is valid for 15
 * minutes and works once: both are Auth's own rules (supabase/config.toml), not this file's.
 *
 * Nothing here logs an address. A failure is logged by Auth's error code alone (CLAUDE.md invariant 10).
 */

/** Auth's codes that mean "too many": its own limits on mail and on requests */
const RATE_LIMITED = new Set(['over_email_send_rate_limit', 'over_request_rate_limit'])
/**
 * Auth's answers for an address without an account when no account may be made. The page says the same
 * thing whether or not the address has an account, so nobody can learn who has one.
 */
const NO_ACCOUNT = new Set(['otp_disabled', 'signup_disabled', 'user_not_found'])

export async function requestSignInLink(input: unknown): Promise<LinkResult> {
  const parsed = linkRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const origin = await requestOrigin()
  if (!origin) return { ok: false, reason: 'failed' }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[auth] requestSignInLink: no Supabase configuration')
    return { ok: false, reason: 'failed' }
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: parsed.data.intent !== 'sign_in', emailRedirectTo: `${origin}${CONFIRM_PATH}` },
  })
  if (!error) return { ok: true }

  const code = error.code ?? (error.status === 429 ? 'over_request_rate_limit' : 'unknown')
  if (RATE_LIMITED.has(code) || error.status === 429) return { ok: false, reason: 'rate_limited' }
  if (parsed.data.intent === 'sign_in' && NO_ACCOUNT.has(code)) return { ok: true }
  if (code === 'email_address_invalid' || code === 'validation_failed') return { ok: false, reason: 'invalid' }
  console.error(`[auth] requestSignInLink: ${code} (${error.status ?? 'no status'})`)
  return { ok: false, reason: 'failed' }
}

/**
 * The confirmation page's button. Signing in on a POST, not on the link's GET, means a mail scanner that
 * opens every link first does not use up a link that works once (REUSE 4.15).
 */
export async function confirmSignIn(_previous: ConfirmState, form: FormData): Promise<ConfirmState> {
  const parsed = confirmSchema.safeParse({ token_hash: form.get('token_hash'), type: form.get('type') })
  if (!parsed.success) return { problem: 'expired' }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[auth] confirmSignIn: no Supabase configuration')
    return { problem: 'failed' }
  }
  const { error } = await supabase.auth.verifyOtp({ token_hash: parsed.data.token_hash, type: parsed.data.type })
  if (error) {
    const code = error.code ?? 'unknown'
    if (code === 'otp_expired' || error.status === 403 || error.status === 401) return { problem: 'expired' }
    console.error(`[auth] confirmSignIn: ${code} (${error.status ?? 'no status'})`)
    return { problem: 'failed' }
  }
  redirect(NEW_GROUP_PATH)
}

/** Signs out on this device (handoff 6.18's "sign out everywhere" is Settings, milestone 16) */
export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) console.error(`[auth] signOut: ${error.code ?? 'unknown'}`)
  } catch {
    console.error('[auth] signOut: no Supabase configuration')
  }
  redirect(LANDING_PATH)
}
