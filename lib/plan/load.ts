import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { meetingActionSchema, planSchema, type MeetingAction, type Plan } from '@/lib/plan/schema'

/**
 * What the Plan page and Home read (0017), parsed, never cast: null when the read fails, 'none' when the
 * caller is not a current member of the group.
 */
export async function loadPlan(groupId: string): Promise<Plan | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[read] loadPlan: no Supabase configuration')
    return null
  }
  const { data, error } = await supabase.schema('app').rpc('get_plan', { p_team: groupId })
  if (callFailed('loadPlan', error)) return null
  if (data === null) return 'none'
  const parsed = planSchema.safeParse(data)
  return parseFailed('loadPlan', parsed) ? null : parsed.data
}

/** The actions made in the group's meetings (0019): null when the read fails, 'none' for a non-member */
export async function loadMeetingActions(groupId: string): Promise<MeetingAction[] | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[read] loadMeetingActions: no Supabase configuration')
    return null
  }
  const { data, error } = await supabase.schema('app').rpc('get_meeting_actions', { p_team: groupId })
  if (callFailed('loadMeetingActions', error)) return null
  if (data === null) return 'none'
  const parsed = z.array(meetingActionSchema).safeParse(data)
  return parseFailed('loadMeetingActions', parsed) ? null : parsed.data
}
