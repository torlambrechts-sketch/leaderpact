import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseFailed, readFailed } from '@/lib/supabase/read'
import { RIGHTS } from '@/lib/group/schema'

/**
 * What the Group page and the invitation page read (0014), parsed, never cast. Each loader answers null when
 * the read fails and 'none' when the caller may not see it (not a current member, or an unknown token).
 */
const task = z.object({ title: z.string(), right: z.enum(RIGHTS) })
const agreed = z.object({
  version: z.number().int().positive(),
  agreed_at: z.string(),
  purpose: z.string(),
  tasks: z.array(task.extend({ id: z.uuid() })),
  agreements: z.array(z.string()),
})
const charterRow = z.object({
  in_force: agreed.nullable(),
  draft: z
    .object({ purpose: z.string(), tasks: z.array(task), agreements: z.array(z.string()), based_on: z.number().int().nullable(), updated_at: z.string() })
    .nullable(),
  versions: z.array(z.object({ version: z.number().int().positive(), agreed_at: z.string() })),
  template: z.object({
    version: z.number().int(),
    max_tasks: z.number().int().positive(),
    max_agreements: z.number().int().positive(),
    purpose_length: z.number().int().positive(),
    item_length: z.number().int().positive(),
  }),
  can_edit: z.boolean(),
})

export type AgreedVersion = z.infer<typeof agreed>
export type Charter = z.infer<typeof charterRow>

async function rpc(where: string, fn: string, args: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').rpc(fn, args)
  if (error) {
    readFailed(where, error, data)
    return { failed: true as const }
  }
  return { failed: false as const, data: data as unknown }
}

/** The group's charter: the version in force, the draft, the agreed versions, the template's limits */
export async function loadCharter(groupId: string): Promise<Charter | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const r = await rpc('loadCharter', 'get_charter', { p_team: groupId })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = charterRow.safeParse(r.data)
  return parseFailed('loadCharter', parsed) ? null : parsed.data
}

/** An agreed version of the group's charter (handoff 6.8: earlier versions stay readable) */
export async function loadCharterVersion(groupId: string, version: number): Promise<AgreedVersion | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success || !Number.isInteger(version) || version < 1) return 'none'
  const r = await rpc('loadCharterVersion', 'get_charter_version', { p_team: groupId, p_version: version })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = agreed.safeParse(r.data)
  return parseFailed('loadCharterVersion', parsed) ? null : parsed.data
}

const membersRow = z.object({
  members: z.array(z.object({ person: z.uuid(), name: z.string(), role: z.enum(['leader', 'member']), since: z.string(), me: z.boolean() })),
  invitations: z
    .array(z.object({ id: z.uuid(), name: z.string(), email: z.string(), invited_at: z.string(), expires_at: z.string(), expired: z.boolean() }))
    .nullable(),
  max: z.number().int().positive(),
  invitation_days: z.number().int().positive(),
  can_invite: z.boolean(),
  can_manage: z.boolean(),
})
export type Members = z.infer<typeof membersRow>

/** The group's current members, and its open invitations for the leader alone */
export async function loadMembers(groupId: string): Promise<Members | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const r = await rpc('loadMembers', 'get_group_members', { p_team: groupId })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = membersRow.safeParse(r.data)
  return parseFailed('loadMembers', parsed) ? null : parsed.data
}

const invitationRow = z.object({
  group: z.string(),
  name: z.string(),
  leader: z.string().nullable(),
  state: z.enum(['open', 'expired', 'used', 'revoked']),
  team: z.uuid().nullable(),
})
export type Invitation = z.infer<typeof invitationRow>

/** The invitation link's page: which group asks, whom, and whether the link still stands. Never the address. */
export async function loadInvitation(token: string): Promise<Invitation | 'none' | null> {
  const r = await rpc('loadInvitation', 'get_invitation', { p_token: token })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = invitationRow.safeParse(r.data)
  return parseFailed('loadInvitation', parsed) ? null : parsed.data
}
