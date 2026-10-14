'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { groupSchema, openReplySchema, submitReplySchema, submitSchema, type OpenResult, type SubmitResult } from '@/lib/rounds/schema'

/**
 * The diagnostic round's writes (handoff 6.10 and 6.11), each through its definer function (0015), which
 * checks the caller, the plan and the round again. Nothing here logs an answer (CLAUDE.md invariant 10):
 * a failure is logged by its code alone.
 */
async function client(where: string) {
  try {
    return await createClient()
  } catch {
    console.error(`[rounds] ${where}: no Supabase configuration`)
    return null
  }
}

/** The leader opens the Full diagnostic: every current member is invited at once */
export async function openDiagnostic(input: unknown): Promise<OpenResult> {
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const supabase = await client('openDiagnostic')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { data, error } = await supabase.schema('app').rpc('open_diagnostic', { p_team: parsed.data.group })
  if (callFailed('openDiagnostic', error)) return { ok: false, reason: 'failed' }
  const reply = openReplySchema.safeParse(data)
  if (parseFailed('openDiagnostic', reply)) return { ok: false, reason: 'failed' }
  return reply.data.ok ? { ok: true, round: reply.data.round } : { ok: false, reason: reply.data.reason, members: reply.data.members, k: reply.data.k }
}

/**
 * The round's one write path from the app (CLAUDE.md invariant 4): `app.submit_response`, which finds the
 * caller's participation by their session, checks every answer, marks them as having answered and stores
 * the answers under a random id, never returning it. The payload carries the round and the answers only.
 */
export async function submitDiagnostic(input: unknown): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const supabase = await client('submitDiagnostic')
  if (!supabase) return { ok: false, reason: 'failed' }
  const { data, error } = await supabase.schema('app').rpc('submit_response', { p_round: parsed.data.round, p_answers: parsed.data.answers })
  if (callFailed('submitDiagnostic', error)) return { ok: false, reason: 'failed' }
  const reply = submitReplySchema.safeParse(data)
  if (parseFailed('submitDiagnostic', reply)) return { ok: false, reason: 'failed' }
  return reply.data
}
