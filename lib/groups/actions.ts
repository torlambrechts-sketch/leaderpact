'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import {
  raiseReplySchema,
  raiseThresholdSchema,
  renameGroupSchema,
  renameReplySchema,
  startGroupSchema,
  startReplySchema,
  type GroupSettingResult,
  type StartGroupResult,
} from '@/lib/groups/schema'

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
  // the company names the organisation (0028): kept with the account, where a sign-up with a password put it
  if (parsed.data.company) {
    const { error: kept } = await supabase.auth.updateUser({ data: { company: parsed.data.company } })
    if (kept) console.error(`[groups] startGroup company: ${kept.code ?? 'unknown'}`)
  }
  const { data, error } = await supabase
    .schema('app')
    .rpc('start_group', { p_name: parsed.data.name, p_member_count: parsed.data.size, p_request: parsed.data.request })
  if (callFailed('startGroup', error)) return { ok: false, reason: 'failed' }
  const reply = startReplySchema.safeParse(data)
  if (parseFailed('startGroup', reply)) return { ok: false, reason: 'failed' }
  return reply.data.ok ? { ok: true, team: reply.data.team, code: reply.data.code } : { ok: false, reason: reply.data.reason }
}

async function client(where: string) {
  try {
    return await createClient()
  } catch {
    console.error(`[groups] ${where}: no Supabase configuration`)
    return null
  }
}

/** The leader renames the group (handoff 6.18; 0026 rename_group). The name is not logged */
export async function renameGroup(input: unknown): Promise<GroupSettingResult> {
  const parsed = renameGroupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const supabase = await client('renameGroup')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { data, error } = await supabase.schema('app').rpc('rename_group', { p_team: parsed.data.team, p_name: parsed.data.name })
  if (callFailed('renameGroup', error)) return { ok: false, reason: 'failed' }
  const reply = renameReplySchema.safeParse(data)
  if (parseFailed('renameGroup', reply)) return { ok: false, reason: 'failed' }
  return reply.data
}

/** The leader raises the organisation's threshold, never lower (handoff 6.18; 0026 raise_threshold) */
export async function raiseThreshold(input: unknown): Promise<GroupSettingResult> {
  const parsed = raiseThresholdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const supabase = await client('raiseThreshold')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { data, error } = await supabase.schema('app').rpc('raise_threshold', { p_team: parsed.data.team, p_threshold: parsed.data.threshold })
  if (callFailed('raiseThreshold', error)) return { ok: false, reason: 'failed' }
  const reply = raiseReplySchema.safeParse(data)
  if (parseFailed('raiseThreshold', reply)) return { ok: false, reason: 'failed' }
  return reply.data.ok ? { ok: true } : { ok: false, reason: reply.data.reason }
}
