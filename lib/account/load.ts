import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { notificationsRowSchema, type Summary } from '@/lib/account/schema'

export interface MyNotifications {
  email: string | null
  summary: Summary
  timeZone: string | null
}

/** The person's own address, summary frequency and time zone (0022 get_notifications); null when unreadable */
export async function loadNotifications(): Promise<MyNotifications | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').rpc('get_notifications')
  if (callFailed('loadNotifications', error)) return null
  const row = notificationsRowSchema.safeParse(data)
  if (parseFailed('loadNotifications', row)) return null
  return { email: row.data.email, summary: row.data.summary, timeZone: row.data.time_zone }
}

/** The zones a person may choose, as this runtime knows them, UTC first */
export function timeZones(): string[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return ['UTC', ...all.filter((z) => z !== 'UTC')]
}
