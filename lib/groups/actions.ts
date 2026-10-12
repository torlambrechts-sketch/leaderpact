'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { startGroupSchema, startReplySchema, type StartGroupResult } from '@/lib/groups/schema'

/**
 * The signed-in leader starts their group and its scan (handoff 6.3), through `app.start_group` (0009):
 * the database checks the caller, the name and the size again and makes everything in one transaction.
 * The name is not logged (CLAUDE.md invariant 10).
 */
export async function startGroup(input: unknown): Promise<StartGroupResult> {
  const parsed = startGroupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error('[groups] startGroup: no Supabase configuration')
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await supabase
    .schema('app')
    .rpc('start_group', { p_name: parsed.data.name, p_member_count: parsed.data.size, p_request: parsed.data.request })
  if (callFailed('startGroup', error)) return { ok: false, reason: 'failed' }
  const reply = startReplySchema.safeParse(data)
  if (parseFailed('startGroup', reply)) return { ok: false, reason: 'failed' }
  return reply.data.ok ? { ok: true, team: reply.data.team, code: reply.data.code } : { ok: false, reason: reply.data.reason }
}
