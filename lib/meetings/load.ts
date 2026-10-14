import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { agendaSchema, meetingsSchema, type Agenda, type Meetings } from '@/lib/meetings/schema'

/**
 * What the Meetings page and Home read (0018), parsed, never cast: null when the read fails, 'none' when the
 * caller may not see it (not a current member, or no such meeting).
 */
async function rpc(where: string, fn: string, args: Record<string, unknown>) {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[read] ${where}: no Supabase configuration`)
    return { failed: true as const }
  }
  const { data, error } = await supabase.schema('app').rpc(fn, args)
  if (callFailed(where, error)) return { failed: true as const }
  return { failed: false as const, data: data as unknown }
}

/** The group's meetings, the next one marked */
export async function loadMeetings(groupId: string): Promise<Meetings | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const r = await rpc('loadMeetings', 'get_meetings', { p_team: groupId })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = meetingsSchema.safeParse(r.data)
  return parseFailed('loadMeetings', parsed) ? null : parsed.data
}

/** A meeting's agenda, with the team tasks in force and, on the next agenda, every open action */
export async function loadAgenda(meetingId: string): Promise<Agenda | 'none' | null> {
  if (!z.uuid().safeParse(meetingId).success) return 'none'
  const r = await rpc('loadAgenda', 'get_agenda', { p_meeting: meetingId })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = agendaSchema.safeParse(r.data)
  return parseFailed('loadAgenda', parsed) ? null : parsed.data
}
