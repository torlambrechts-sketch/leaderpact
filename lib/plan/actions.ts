'use server'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { addActionSchema, closeSchema, doneSchema, makeSchema, replySchema, updateActionSchema, type PlanResult } from '@/lib/plan/schema'

/**
 * The plan's writes (handoff 6.13), each through its definer function (0017), which checks the caller, the
 * plan and the group again. Nothing here logs a title or a name (CLAUDE.md invariant 10): only codes.
 */
async function call(where: string, rpc: string, args: Record<string, unknown>): Promise<PlanResult<{ focusArea?: string; max?: number }>> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[plan] ${where}: no Supabase configuration`)
    return { ok: false, reason: 'failed' }
  }
  const { data, error } = await supabase.schema('app').rpc(rpc, args)
  if (callFailed(where, error)) return { ok: false, reason: 'failed' }
  const reply = replySchema.safeParse(data)
  if (parseFailed(where, reply)) return { ok: false, reason: 'failed' }
  return reply.data.ok ? { ok: true, focusArea: reply.data.focus_area } : { ok: false, reason: reply.data.reason }
}

/** The leader makes a scale of a released round a focus area; a third active one is refused */
export async function makeFocusArea(input: unknown): Promise<PlanResult<{ focusArea?: string }>> {
  const parsed = makeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('makeFocusArea', 'make_focus_area', { p_team: parsed.data.group, p_round: parsed.data.round, p_scale: parsed.data.scale })
}

/** The leader closes an active focus area; its actions stay */
export async function closeFocusArea(input: unknown): Promise<PlanResult> {
  const parsed = closeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('closeFocusArea', 'close_focus_area', { p_team: parsed.data.group, p_focus_area: parsed.data.focusArea })
}

/** A member adds an action to an active focus area: a title, an owner and a due date. No owner, no action */
export async function addAction(input: unknown): Promise<PlanResult> {
  const parsed = addActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const d = parsed.data
  return call('addAction', 'add_action', { p_team: d.group, p_focus_area: d.focusArea, p_title: d.title, p_owner: d.owner, p_due: d.due })
}

/** Its owner or the leader changes an open action's title, owner and due date */
export async function updateAction(input: unknown): Promise<PlanResult> {
  const parsed = updateActionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const d = parsed.data
  return call('updateAction', 'update_action', { p_team: d.group, p_action: d.action, p_title: d.title, p_owner: d.owner, p_due: d.due })
}

/** Its owner or the leader marks an action done, or open again */
export async function setActionDone(input: unknown): Promise<PlanResult> {
  const parsed = doneSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return call('setActionDone', 'set_action_done', { p_team: parsed.data.group, p_action: parsed.data.action, p_done: parsed.data.done })
}
