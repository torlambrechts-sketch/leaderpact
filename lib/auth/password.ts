'use server'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requestOrigin } from '@/lib/auth/origin'
import { keyed, takePublicRate } from '@/lib/limits/key'
import {
  newPasswordSchema,
  passwordSignInSchema,
  providerSchema,
  resetRequestSchema,
  signUpSchema,
  type LinkResult,
  type NewPasswordResult,
  type PasswordSignInResult,
  type SignUpResult,
} from '@/lib/auth/schema'
import { CONFIRM_PATH, NEW_GROUP_PATH, OAUTH_CALLBACK_PATH } from '@/lib/routes'

/**
 * Signing up and in with a password, Google or Microsoft (owner, 15 October 2026; D-57). The email link of
 * lib/auth/actions.ts stays beside them.
 *
 * - **Nobody learns who has an account.** Signing up with an address that has one, and asking to reset the
 *   password of one that has none, answer as the others do: "check your email". A wrong password and an
 *   unknown address read the same.
 * - **An address is confirmed once** by Auth's mail, which comes back to the confirmation page (the same
 *   button as the sign-in link, so a mail scanner uses nothing up). The name and company go into the account's
 *   metadata, which 0028 reads for the person and the organisation.
 * - **Mail is counted** like the sign-in link (5 an hour per address, handoff 8; 0021) before Auth is asked.
 *   Password attempts are Auth's own to limit (supabase/config.toml, `sign_in_sign_ups`).
 * - Nothing here logs an address, a name or a password: Auth's error code alone (CLAUDE.md invariant 10).
 */

const RATE_LIMITED = new Set(['over_email_send_rate_limit', 'over_request_rate_limit'])

async function client(where: string) {
  try {
    return await createClient()
  } catch {
    console.error(`[auth] ${where}: no Supabase configuration`)
    return null
  }
}

function limited(error: { code?: string; status?: number }) {
  return RATE_LIMITED.has(error.code ?? '') || error.status === 429
}

export async function signUpWithPassword(input: unknown): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const { name, email, company, password } = parsed.data
  const origin = await requestOrigin()
  if (!origin) return { ok: false, reason: 'failed' }
  if ((await takePublicRate('sign_in', keyed(`address:${email}`))) > 0) return { ok: false, reason: 'rate_limited' }
  const supabase = await client('signUpWithPassword')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}${CONFIRM_PATH}`, data: { full_name: name, company } },
  })
  if (error) {
    if (limited(error)) return { ok: false, reason: 'rate_limited' }
    if (error.code === 'weak_password') return { ok: false, reason: 'weak_password' }
    if (error.code === 'email_address_invalid' || error.code === 'validation_failed') return { ok: false, reason: 'invalid' }
    // an address that has an account answers as a new one does, so nobody learns which has one
    if (error.code === 'user_already_exists' || error.code === 'email_exists') return { ok: true }
    console.error(`[auth] signUpWithPassword: ${error.code ?? 'unknown'} (${error.status ?? 'no status'})`)
    return { ok: false, reason: 'failed' }
  }
  // a project that confirms no address signs the person in at once
  if (data.session) redirect(NEW_GROUP_PATH)
  return { ok: true }
}

export async function signInWithPassword(input: unknown): Promise<PasswordSignInResult> {
  const parsed = passwordSignInSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const supabase = await client('signInWithPassword')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    if (limited(error)) return { ok: false, reason: 'rate_limited' }
    if (error.code === 'email_not_confirmed') return { ok: false, reason: 'unconfirmed' }
    if (error.code === 'invalid_credentials' || error.status === 400) return { ok: false, reason: 'wrong' }
    console.error(`[auth] signInWithPassword: ${error.code ?? 'unknown'} (${error.status ?? 'no status'})`)
    return { ok: false, reason: 'failed' }
  }
  redirect(NEW_GROUP_PATH)
}

/** The confirmation mail again, for an address that has not been confirmed; answers the same whatever happens */
export async function resendConfirmation(input: unknown): Promise<LinkResult> {
  const parsed = resetRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const origin = await requestOrigin()
  if (!origin) return { ok: false, reason: 'failed' }
  if ((await takePublicRate('sign_in', keyed(`address:${parsed.data.email}`))) > 0) return { ok: false, reason: 'rate_limited' }
  const supabase = await client('resendConfirmation')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { error } = await supabase.auth.resend({ type: 'signup', email: parsed.data.email, options: { emailRedirectTo: `${origin}${CONFIRM_PATH}` } })
  if (error && limited(error)) return { ok: false, reason: 'rate_limited' }
  if (error) console.error(`[auth] resendConfirmation: ${error.code ?? 'unknown'} (${error.status ?? 'no status'})`)
  return { ok: true }
}

/** "Forgot your password?": a link to set a new one, which reads the same whether or not the address has an account */
export async function requestPasswordReset(input: unknown): Promise<LinkResult> {
  const parsed = resetRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const origin = await requestOrigin()
  if (!origin) return { ok: false, reason: 'failed' }
  if ((await takePublicRate('sign_in', keyed(`address:${parsed.data.email}`))) > 0) return { ok: false, reason: 'rate_limited' }
  const supabase = await client('requestPasswordReset')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}${CONFIRM_PATH}` })
  if (error && limited(error)) return { ok: false, reason: 'rate_limited' }
  if (error) console.error(`[auth] requestPasswordReset: ${error.code ?? 'unknown'} (${error.status ?? 'no status'})`)
  return { ok: true }
}

/** A new password, for the person the reset link signed in (or any signed-in person) */
export async function setNewPassword(input: unknown): Promise<NewPasswordResult> {
  const parsed = newPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const supabase = await client('setNewPassword')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { data: who } = await supabase.auth.getUser()
  if (!who.user) return { ok: false, reason: 'signed_out' }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    if (error.code === 'weak_password') return { ok: false, reason: 'weak_password' }
    if (error.code === 'same_password') return { ok: false, reason: 'same_password' }
    console.error(`[auth] setNewPassword: ${error.code ?? 'unknown'} (${error.status ?? 'no status'})`)
    return { ok: false, reason: 'failed' }
  }
  redirect(NEW_GROUP_PATH)
}

/**
 * Google or Microsoft: Auth's address for the provider, which comes back to /auth/callback with a code (PKCE,
 * its verifier in this device's cookie). A form posts here, so the button works before any script runs.
 */
export async function startProviderSignIn(form: FormData): Promise<void> {
  const provider = providerSchema.safeParse(form.get('provider'))
  const origin = await requestOrigin()
  const supabase = provider.success && origin ? await client('startProviderSignIn') : null
  if (!provider.success || !origin || !supabase) redirect(`/sign-in?problem=provider`)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.data,
    options: { redirectTo: `${origin}${OAUTH_CALLBACK_PATH}`, skipBrowserRedirect: true, ...(provider.data === 'azure' ? { scopes: 'email' } : {}) },
  })
  if (error || !data.url) {
    console.error(`[auth] startProviderSignIn: ${error?.code ?? 'no address'} (${error?.status ?? 'no status'})`)
    redirect(`/sign-in?problem=provider`)
  }
  // the provider's own address, outside this site's routes
  redirect(data.url as Route)
}
