import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { liveSchema, type Live } from '@/lib/live/schema'

/**
 * A live or held meeting, as its page reads it first (0019): null when the read fails, 'none' when the caller
 * is not a current member or the meeting is neither live nor held.
 */
export async function loadLive(meetingId: string): Promise<Live | 'none' | null> {
  if (!z.uuid().safeParse(meetingId).success) return 'none'
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[read] loadLive: no Supabase configuration')
    return null
  }
  const { data, error } = await supabase.schema('app').rpc('get_live', { p_meeting: meetingId })
  if (callFailed('loadLive', error)) return null
  if (data === null) return 'none'
  const parsed = liveSchema.safeParse(data)
  return parseFailed('loadLive', parsed) ? null : parsed.data
}
