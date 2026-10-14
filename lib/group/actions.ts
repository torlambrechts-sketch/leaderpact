'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { sendSignInLink } from '@/lib/auth/link'
import {
  draftSchema,
  groupSchema,
  invitationSchema,
  inviteSchema,
  joinRequestSchema,
  memberSchema,
  replySchema,
  tokenSchema,
  type GroupResult,
} from '@/lib/group/schema'

/**
 * The group's writes (handoff 6.8), each through its definer function (0014), which checks the caller and
 * the plan again. Nothing here logs a purpose, a name or an address (CLAUDE.md invariant 10): only codes.
 */
async function call(where: string, rpc: string, args: Record<string, unknown>): Promise<GroupResult<{ version?: number; token?: string; team?: string }>> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[group] ${where}: no Supabase configuration`)
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await supabase.schema('app').rpc(rpc, args)
  if (callFailed(where, error)) return { ok: false, reason: 'failed' }
  const reply = replySchema.safeParse(data)
  if (parseFailed(where, reply)) return { ok: false, reason: 'failed' }
  return reply.data
}

/** The leader saves the group's one draft; the version in force does not change */
export async function saveDraft(input: unknown): Promise<GroupResult> {
  const parsed = draftSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const d = parsed.data
  return call('saveDraft', 'save_charter_draft', { p_team: d.group, p_purpose: d.purpose, p_tasks: d.tasks, p_agreements: d.agreements })
}

export async function discardDraft(input: unknown): Promise<GroupResult> {
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('discardDraft', 'discard_charter_draft', { p_team: parsed.data.group })
}

/** "The group agrees · put in force": the saved draft becomes the version in force */
export async function agreeDraft(input: unknown): Promise<GroupResult<{ version?: number }>> {
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('agreeDraft', 'agree_charter', { p_team: parsed.data.group })
}

/** The leader invites a person by name and address; the link's token comes back once */
export async function inviteMember(input: unknown): Promise<GroupResult<{ token?: string }>> {
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const reply = await call('inviteMember', 'invite_member', { p_team: parsed.data.group, p_email: parsed.data.email, p_name: parsed.data.name })
  if (reply.ok && !reply.token) return { ok: false, reason: 'failed' }
  return reply
}

export async function revokeInvitation(input: unknown): Promise<GroupResult> {
  const parsed = invitationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('revokeInvitation', 'revoke_invitation', { p_team: parsed.data.group, p_invitation: parsed.data.invitation })
}

export async function removeMember(input: unknown): Promise<GroupResult> {
  const parsed = memberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('removeMember', 'remove_member', { p_team: parsed.data.group, p_person: parsed.data.person })
}

export async function setLeader(input: unknown): Promise<GroupResult> {
  const parsed = memberSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('setLeader', 'set_group_leader', { p_team: parsed.data.group, p_person: parsed.data.person })
}

/** The signed-in invitee joins the group the invitation names */
export async function acceptInvitation(input: unknown): Promise<GroupResult<{ team?: string }>> {
  const parsed = tokenSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'unknown' }
  const reply = await call('acceptInvitation', 'accept_invitation', { p_token: parsed.data })
  if (reply.ok && !reply.team) return { ok: false, reason: 'failed' }
  return reply
}

/**
 * The invitation page's sign-in. A link that may make an account goes only to the address an open
 * invitation with this token names (`invitation_matches`); any other address is told so, and nothing is sent.
 */
export async function requestJoinLink(input: unknown): Promise<GroupResult> {
  const parsed = joinRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[group] requestJoinLink: no Supabase configuration')
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await supabase.schema('app').rpc('invitation_matches', { p_token: parsed.data.token, p_email: parsed.data.email })
  if (callFailed('requestJoinLink', error)) return { ok: false, reason: 'failed' }
  if (data !== true) return { ok: false, reason: 'other_address' }
  const sent = await sendSignInLink('requestJoinLink', parsed.data.email, true)
  return sent.ok ? { ok: true } : { ok: false, reason: sent.reason }
}
