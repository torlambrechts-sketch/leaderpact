'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { replySchema, saveProfileSchema, shareSchema, type ProfileResult } from '@/lib/profile/schema-io'

/**
 * The Leader Profile's three writes (handoff 6.17), each through its definer function (0011), which checks
 * the caller again: save a finished test (a retake replaces the profile and resets sharing), set what one
 * group sees, and delete. No answer and no score is logged (CLAUDE.md invariant 10): only codes.
 */
async function call(where: string, rpc: string, args: Record<string, unknown>): Promise<ProfileResult> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[profile] ${where}: no Supabase configuration`)
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await supabase.schema('app').rpc(rpc, args)
  if (callFailed(where, error)) return { ok: false, reason: 'failed' }
  const reply = replySchema.safeParse(data)
  if (parseFailed(where, reply)) return { ok: false, reason: 'failed' }
  return reply.data
}

export async function saveProfile(input: unknown): Promise<ProfileResult> {
  const parsed = saveProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('saveProfile', 'save_profile', { p_test: parsed.data.test, p_answers: parsed.data.answers })
}

export async function setProfileShare(input: unknown): Promise<ProfileResult> {
  const parsed = shareSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('setProfileShare', 'set_profile_share', { p_team: parsed.data.group, p_level: parsed.data.level })
}

export async function deleteProfile(): Promise<ProfileResult> {
  return call('deleteProfile', 'delete_profile', {})
}
