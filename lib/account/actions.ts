'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { deleteAccountSchema, deleteReplySchema, notificationsSchema, setReplySchema, type DeleteResult, type SettingsResult } from '@/lib/account/schema'
import { LANDING_PATH } from '@/lib/routes'

/**
 * The person's own settings (handoff 6.18): how often their summary arrives and their time zone (0022),
 * signing out on every device, and deleting their account (0023). Each write goes to its definer function,
 * which checks the caller again. Only codes are logged (CLAUDE.md invariant 10).
 */
async function client(where: string) {
  try {
    return await createClient()
  } catch {
    console.error(`[account] ${where}: no Supabase configuration`)
    return null
  }
}

export async function saveNotifications(input: unknown): Promise<SettingsResult> {
  const parsed = notificationsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const supabase = await client('saveNotifications')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { data, error } = await supabase.schema('app').rpc('set_notifications', { p_summary: parsed.data.summary, p_time_zone: parsed.data.timeZone })
  if (callFailed('saveNotifications', error)) return { ok: false, reason: 'failed' }
  const reply = setReplySchema.safeParse(data)
  if (parseFailed('saveNotifications', reply)) return { ok: false, reason: 'failed' }
  return reply.data
}

/** Ends every session the person has, this one included (Auth's global sign-out), then the landing page */
export async function signOutEverywhere(): Promise<SettingsResult> {
  const supabase = await client('signOutEverywhere')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) {
    console.error(`[account] signOutEverywhere: ${error.code ?? 'unknown'}`)
    return { ok: false, reason: 'failed' }
  }
  redirect(LANDING_PATH)
}

/**
 * Deletes the person's account and everything that names them (0023 delete_account), then clears this
 * device's session and goes to the landing page. The only leader of a group with others is told which.
 */
export async function deleteAccount(input: unknown): Promise<DeleteResult> {
  if (!deleteAccountSchema.safeParse(input).success) return { ok: false, reason: 'invalid' }
  const supabase = await client('deleteAccount')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { data, error } = await supabase.schema('app').rpc('delete_account')
  if (callFailed('deleteAccount', error)) return { ok: false, reason: 'failed' }
  const reply = deleteReplySchema.safeParse(data)
  if (parseFailed('deleteAccount', reply)) return { ok: false, reason: 'failed' }
  if (!reply.data.ok) return reply.data
  // the person is gone; this only clears the device's cookies
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  redirect(LANDING_PATH)
}
