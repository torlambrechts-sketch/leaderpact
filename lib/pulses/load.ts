import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { pulseResultSchema, pulsesSchema, type PulseResult, type Pulses } from '@/lib/pulses/schema'

/**
 * What the pages read about pulses (0020), parsed, never cast. Each loader answers null when the read fails
 * and 'none' when the caller may not see it (not a current member, no such pulse, or not yet released).
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

/** The group's pulse rhythm and what its next pulse would ask, in order */
export async function loadPulses(groupId: string): Promise<Pulses | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const r = await rpc('loadPulses', 'get_pulses', { p_team: groupId })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = pulsesSchema.safeParse(r.data)
  return parseFailed('loadPulses', parsed) ? null : parsed.data
}

/** A released pulse's result, with the level each question had when a pulse last asked it */
export async function loadPulseResult(roundId: string): Promise<PulseResult | 'none' | null> {
  if (!z.uuid().safeParse(roundId).success) return 'none'
  const r = await rpc('loadPulseResult', 'get_pulse_result', { p_round: roundId })
  if (r.failed) return null
  if (r.data === null) return 'none'
  const parsed = pulseResultSchema.safeParse(r.data)
  return parseFailed('loadPulseResult', parsed) ? null : parsed.data
}
