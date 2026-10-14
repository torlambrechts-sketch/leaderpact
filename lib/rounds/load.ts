import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { formSchema, roundsSchema, type RoundForm, type Rounds } from '@/lib/rounds/schema'

/**
 * What the Assess page and the questionnaire read (0015), parsed, never cast. Each loader answers null when
 * the read fails and 'none' when the caller may not see it (not a current member, or no such round).
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

/** The group's rounds with phase, dates and the count of answers, and the caller's own state */
export async function loadRounds(groupId: string): Promise<Rounds | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const r = await rpc('loadRounds', 'get_rounds', { p_team: groupId })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = roundsSchema.safeParse(r.data)
  return parseFailed('loadRounds', parsed) ? null : parsed.data
}

/** A round's questions in its mixed order, while the caller has yet to answer, and the caller's own state */
export async function loadRoundForm(roundId: string): Promise<RoundForm | 'none' | null> {
  if (!z.uuid().safeParse(roundId).success) return 'none'
  const r = await rpc('loadRoundForm', 'get_round_form', { p_round: roundId })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = formSchema.safeParse(r.data)
  return parseFailed('loadRoundForm', parsed) ? null : parsed.data
}
