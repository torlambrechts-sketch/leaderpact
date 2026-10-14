'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import {
  itemChangeSchema,
  itemRefSchema,
  meetingChangeSchema,
  meetingInputSchema,
  meetingRefSchema,
  proposeSchema,
  replySchema,
  type MeetingResult,
} from '@/lib/meetings/schema'

/**
 * The agenda's writes (handoff 6.14), each through its definer function (0018), which checks the caller, the
 * plan and the meeting again. Nothing here logs a title, an outcome or a name (CLAUDE.md invariant 10).
 */
async function call(where: string, rpc: string, args: Record<string, unknown>): Promise<MeetingResult<{ meeting?: string }>> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[meetings] ${where}: no Supabase configuration`)
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await supabase.schema('app').rpc(rpc, args)
  if (callFailed(where, error)) return { ok: false, reason: 'failed' }
  const reply = replySchema.safeParse(data)
  if (parseFailed(where, reply)) return { ok: false, reason: 'failed' }
  return reply.data
}

/** The leader plans a meeting; its agenda starts with the template's closing item */
export async function planMeeting(input: unknown): Promise<MeetingResult<{ meeting?: string }>> {
  const parsed = meetingInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const d = parsed.data
  return call('planMeeting', 'plan_meeting', { p_team: d.group, p_title: d.title, p_on: d.on, p_at: d.at, p_minutes: d.minutes })
}

export async function updateMeeting(input: unknown): Promise<MeetingResult> {
  const parsed = meetingChangeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const d = parsed.data
  return call('updateMeeting', 'update_meeting', { p_meeting: d.meeting, p_title: d.title, p_on: d.on, p_at: d.at, p_minutes: d.minutes })
}

export async function cancelMeeting(input: unknown): Promise<MeetingResult> {
  const parsed = meetingRefSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('cancelMeeting', 'cancel_meeting', { p_meeting: parsed.data.meeting })
}

const fields = (d: { title: string; type: string | null; outcome: string | null; owner: string | null; minutes: number | null; task: string | null }) => ({
  p_title: d.title,
  p_type: d.type,
  p_outcome: d.outcome || null,
  p_owner: d.owner,
  p_minutes: d.minutes,
  p_task: d.task,
})

/** Any member proposes an item; without a team task it is flagged until the leader confirms it */
export async function proposeItem(input: unknown): Promise<MeetingResult> {
  const parsed = proposeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('proposeItem', 'propose_item', { p_meeting: parsed.data.meeting, ...fields(parsed.data) })
}

export async function updateItem(input: unknown): Promise<MeetingResult> {
  const parsed = itemChangeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('updateItem', 'update_item', { p_item: parsed.data.item, ...fields(parsed.data) })
}

/** The leader keeps a flagged item: it stays, no longer flagged */
export async function confirmItem(input: unknown): Promise<MeetingResult> {
  const parsed = itemRefSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('confirmItem', 'confirm_item', { p_item: parsed.data.item })
}

export async function removeItem(input: unknown): Promise<MeetingResult> {
  const parsed = itemRefSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('removeItem', 'remove_item', { p_item: parsed.data.item })
}
