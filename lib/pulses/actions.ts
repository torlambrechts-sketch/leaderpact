'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { pulseReplySchema, rhythmSchema, stopSchema, type PulseActionResult } from '@/lib/pulses/schema'

/**
 * The pulse rhythm's writes (handoff 6.16), each through its definer function (0020), which checks the
 * caller, the plan and the group again. Only codes are logged.
 */
async function call(where: string, fn: string, args: Record<string, unknown>): Promise<PulseActionResult> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[pulses] ${where}: no Supabase configuration`)
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await supabase.schema('app').rpc(fn, args)
  if (callFailed(where, error)) return { ok: false, reason: 'failed' }
  const reply = pulseReplySchema.safeParse(data)
  if (parseFailed(where, reply)) return { ok: false, reason: 'failed' }
  return reply.data.ok ? { ok: true } : { ok: false, reason: reply.data.reason, members: reply.data.members, k: reply.data.k }
}

/** The leader starts the rhythm: the first pulse opens now for every current member */
export async function startPulses(input: unknown): Promise<PulseActionResult> {
  const parsed = rhythmSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('startPulses', 'start_pulses', { p_team: parsed.data.group, p_weeks: parsed.data.weeks, p_days: parsed.data.days })
}

/** The leader changes the rhythm and the window for the pulses to come */
export async function setPulseRhythm(input: unknown): Promise<PulseActionResult> {
  const parsed = rhythmSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('setPulseRhythm', 'set_pulse_rhythm', { p_team: parsed.data.group, p_weeks: parsed.data.weeks, p_days: parsed.data.days })
}

/** The leader stops the rhythm; a pulse that is open runs to its close */
export async function stopPulses(input: unknown): Promise<PulseActionResult> {
  const parsed = stopSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('stopPulses', 'stop_pulses', { p_team: parsed.data.group })
}
