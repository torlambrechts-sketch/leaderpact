import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed, readFailed } from '@/lib/supabase/read'
import { codeSchema } from '@/lib/scan/link'
import { buildTeamView, teamViewRowSchema, type TeamView } from '@/lib/scan/team-view'
import { groupSettingsSchema, type GroupSettings } from '@/lib/groups/schema'

/**
 * What a signed-in person reads of their groups, through row-level security (0002, 0006): only groups
 * they are a current member of. Parsed, never cast. A failed read is null, which the page shows as a
 * failure, never as "no groups" (lib/supabase/read.ts).
 */

export interface MyGroup {
  id: string
  name: string
  role: 'leader' | 'member'
}

const membershipRow = z.object({
  role: z.enum(['leader', 'member']),
  valid_from: z.string(),
  team: z.object({ id: z.uuid(), name: z.string().min(1) }),
})

/** The person's current groups, oldest membership first; null when they cannot be read */
export async function loadMyGroups(personId: string): Promise<MyGroup[] | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .schema('app')
    .from('membership')
    .select('role, valid_from, team:team(id, name)')
    .eq('person_id', personId)
    .lte('valid_from', now)
    .or(`valid_to.is.null,valid_to.gt.${now}`)
    .order('valid_from')
  if (readFailed('loadMyGroups', error, data)) return null
  const rows = z.array(membershipRow).safeParse(data)
  if (parseFailed('loadMyGroups', rows)) return null
  const seen = new Set<string>()
  return rows.data
    .filter((r) => (seen.has(r.team.id) ? false : (seen.add(r.team.id), true)))
    .map((r) => ({ id: r.team.id, name: r.team.name, role: r.role }))
}

export interface GroupScan {
  id: string
  phase: 'open' | 'closed' | 'released'
  answered: number
  memberCount: number
  closesAt: string
  extended: boolean
}

export interface InviteView {
  group: { id: string; name: string }
  role: 'leader' | 'member'
  scan: GroupScan | null
  /** the link's code, read through get_scan_link; null when there is no scan */
  code: string | null
}

const scanRow = z.object({
  id: z.uuid(),
  phase: z.enum(['open', 'closed', 'released']),
  answered: z.number().int().min(0),
  member_count: z.number().int().min(4).max(15),
  closes_at: z.string().min(1),
  extended: z.boolean(),
})

/**
 * The group's scan status (handoff 6.4): its name, the caller's role, the latest scan's count and closing
 * date, and the link. 'none' when the caller is not a current member, or the group does not exist; null
 * when a read failed.
 */
export async function loadInvite(groupId: string, personId: string): Promise<InviteView | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const groups = await loadMyGroups(personId)
  if (groups === null) return null
  const mine = groups.find((g) => g.id === groupId)
  if (!mine) return 'none'

  const supabase = await createClient()
  const db = supabase.schema('app')
  const scans = await db
    .from('scan_session')
    .select('id, phase, answered, member_count, closes_at, extended')
    .eq('team_id', groupId)
    .order('opens_at', { ascending: false })
    .limit(1)
  if (readFailed('loadInvite.scan', scans.error, scans.data)) return null
  const rows = z.array(scanRow).safeParse(scans.data)
  if (parseFailed('loadInvite.scan', rows)) return null
  const row = rows.data[0]
  if (!row) return { group: { id: mine.id, name: mine.name }, role: mine.role, scan: null, code: null }

  const link = await db.rpc('get_scan_link', { p_scan: row.id })
  if (callFailed('loadInvite.link', link.error)) return null
  const code = codeSchema.safeParse(link.data)
  if (parseFailed('loadInvite.link', code)) return null

  return {
    group: { id: mine.id, name: mine.name },
    role: mine.role,
    scan: { id: row.id, phase: row.phase, answered: row.answered, memberCount: row.member_count, closesAt: row.closes_at, extended: row.extended },
    code: code.data,
  }
}

/**
 * The group's team view for a current member (0006, get_team_view, which checks the membership again), with
 * the invite page's view of the group and its latest scan. `view` is null while the scan is open or when it
 * closed without one.
 */
export async function loadGroupTeamView(groupId: string, personId: string): Promise<(InviteView & { view: TeamView | null }) | 'none' | null> {
  const invite = await loadInvite(groupId, personId)
  if (invite === null || invite === 'none') return invite
  if (!invite.scan || invite.scan.phase !== 'released') return { ...invite, view: null }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').rpc('get_team_view', { p_scan: invite.scan.id })
  if (readFailed('loadGroupTeamView', error, data)) return null
  const rows = z.array(teamViewRowSchema).safeParse(data)
  if (parseFailed('loadGroupTeamView', rows)) return null
  return { ...invite, view: buildTeamView(rows.data) }
}

export interface Shell {
  groups: MyGroup[]
  current: MyGroup
  person: { id: string; name: string }
}

/**
 * What the app shell needs (handoff section 5): the person's current groups for the switcher, the group
 * open now with the person's role in it, and the person's name for the avatar. 'none' when the person is
 * not a current member of the group; null when a read failed. Read once per request: the layout and the
 * page below it both ask.
 */
export const loadShell = cache(async (groupId: string, personId: string): Promise<Shell | 'none' | null> => {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const groups = await loadMyGroups(personId)
  if (groups === null) return null
  const current = groups.find((g) => g.id === groupId)
  if (!current) return 'none'
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').from('person').select('display_name').eq('id', personId).maybeSingle()
  if (error) {
    callFailed('loadShell.person', error)
    return null
  }
  const name = z.object({ display_name: z.string().min(1) }).safeParse(data)
  if (parseFailed('loadShell.person', name)) return null
  return { groups, current, person: { id: personId, name: name.data.display_name } }
})

/** The Settings Group tab (0026 get_group_settings): null when it cannot be read, 'none' when the reader is no member */
export async function loadGroupSettings(groupId: string): Promise<GroupSettings | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').rpc('get_group_settings', { p_team: groupId })
  if (callFailed('loadGroupSettings', error)) return null
  if (data === null) return 'none'
  const settings = groupSettingsSchema.safeParse(data)
  if (parseFailed('loadGroupSettings', settings)) return null
  return settings.data
}
