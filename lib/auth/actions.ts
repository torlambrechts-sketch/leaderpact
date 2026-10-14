'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendSignInLink } from '@/lib/auth/link'
import { confirmSchema, linkRequestSchema, type ConfirmState, type LinkResult } from '@/lib/auth/schema'
import { LANDING_PATH, NEW_GROUP_PATH } from '@/lib/routes'

/**
 * Sign-in by email link (handoff section 8, Authentication; REUSE 4.15). The link is valid for 15
 * minutes and works once: both are Auth's own rules (supabase/config.toml), not this file's.
 *
 * Nothing here logs an address. A failure is logged by Auth's error code alone (CLAUDE.md invariant 10).
 */

export async function requestSignInLink(input: unknown): Promise<LinkResult> {
  const parsed = linkRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return sendSignInLink('requestSignInLink', parsed.data.email, parsed.data.intent !== 'sign_in')
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
