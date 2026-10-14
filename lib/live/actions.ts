'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import {
  commentSchema,
  controlSchema,
  decisionSchema,
  itemActionSchema,
  liveSchema,
  meetingRefSchema,
  parkSchema,
  replySchema,
  type Live,
  type LiveResult,
} from '@/lib/live/schema'

/**
 * The live meeting's writes (handoff 6.15), each through its definer function (0019), which checks the
 * caller, the plan and the meeting again. Nothing here logs a decision, a topic or a title, and nothing
 * here sends who wrote a process comment: the function takes the meeting and the kind (CLAUDE.md
 * invariant 10).
 */
async function call(where: string, rpc: string, args: Record<string, unknown>): Promise<LiveResult<{ online?: number }>> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[live] ${where}: no Supabase configuration`)
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await supabase.schema('app').rpc(rpc, args)
  if (callFailed(where, error)) return { ok: false, reason: 'failed' }
  const reply = replySchema.safeParse(data)
  if (parseFailed(where, reply)) return { ok: false, reason: 'failed' }
  return reply.data
}

/** The leader starts a planned meeting: it goes live at its first item */
export async function startMeeting(input: unknown): Promise<LiveResult> {
  const parsed = meetingRefSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('startMeeting', 'start_meeting', { p_meeting: parsed.data.meeting })
}

/** The leader's controls: start, pause, plus 5 minutes, take up an item, close the current one */
export async function runMeeting(input: unknown): Promise<LiveResult> {
  const parsed = controlSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('runMeeting', 'run_meeting', { p_meeting: parsed.data.meeting, p_do: parsed.data.do, p_item: parsed.data.item ?? null })
}

export async function endMeeting(input: unknown): Promise<LiveResult> {
  const parsed = meetingRefSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('endMeeting', 'end_meeting', { p_meeting: parsed.data.meeting })
}

export async function saveDecision(input: unknown): Promise<LiveResult> {
  const parsed = decisionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('saveDecision', 'save_decision', { p_item: parsed.data.item, p_text: parsed.data.text })
}

export async function addItemAction(input: unknown): Promise<LiveResult> {
  const parsed = itemActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const d = parsed.data
  return call('addItemAction', 'add_item_action', { p_item: d.item, p_title: d.title, p_owner: d.owner, p_due: d.due })
}

export async function parkTopic(input: unknown): Promise<LiveResult> {
  const parsed = parkSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('parkTopic', 'park_topic', { p_meeting: parsed.data.meeting, p_text: parsed.data.text })
}

/** A process comment: the meeting and the kind, nothing else */
export async function sendComment(input: unknown): Promise<LiveResult> {
  const parsed = commentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('sendComment', 'send_process_comment', { p_meeting: parsed.data.meeting, p_kind: parsed.data.kind })
}

/** The heartbeat: the caller is online; answers how many are */
export async function here(input: unknown): Promise<LiveResult<{ online?: number }>> {
  const parsed = meetingRefSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('here', 'meeting_here', { p_meeting: parsed.data.meeting })
}

/** The meeting read again after a signal, or when the connection returns; null when it cannot be read */
export async function readLive(input: unknown): Promise<Live | null> {
  const parsed = meetingRefSchema.safeParse(input)
  if (!parsed.success) return null
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return null
  }
  const { data, error } = await supabase.schema('app').rpc('get_live', { p_meeting: parsed.data.meeting })
  if (callFailed('readLive', error) || data === null) return null
  const live = liveSchema.safeParse(data)
  return parseFailed('readLive', live) ? null : live.data
}
