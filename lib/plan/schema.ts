import { z } from 'zod'

/**
 * The plan as it crosses the server boundary (handoff 6.13; 0017): what the Plan page reads, and what making
 * a focus area and saving an action send. The database checks everything again: the owner a current member,
 * the date from yesterday to two years on, at most two active focus areas.
 */
export const SCALE_KEY = /^[a-z][a-z_]*[a-z]$/
export const TITLE_MAX = 200

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const actionSchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  owner: z.uuid(),
  owner_name: z.string(),
  // false once the owner's membership has ended: the leader gives the action to someone else
  owner_current: z.boolean(),
  due_on: day,
  status: z.enum(['open', 'done']),
  done_at: z.string().nullable(),
  mine: z.boolean(),
  can_edit: z.boolean(),
})
export type PlanAction = z.infer<typeof actionSchema>

/** An action made in a meeting (0019): no focus area, the meeting and the item it came from */
export const meetingActionSchema = actionSchema.extend({ meeting: z.string().nullable(), item: z.string().nullable() })
export type MeetingAction = z.infer<typeof meetingActionSchema>

export const focusAreaSchema = z.strictObject({
  id: z.uuid(),
  scale: z.string().regex(SCALE_KEY),
  name: z.string(),
  round: z.uuid(),
  status: z.enum(['active', 'closed']),
  created_at: z.string(),
  closed_at: z.string().nullable(),
  actions: z.array(actionSchema),
})
export type FocusArea = z.infer<typeof focusAreaSchema>

export const planSchema = z.strictObject({
  focus_areas: z.array(focusAreaSchema),
  members: z.array(z.strictObject({ person: z.uuid(), name: z.string(), me: z.boolean() })),
  max: z.number().int().positive(),
  leader: z.boolean(),
  can_edit: z.boolean(),
  can_choose: z.boolean(),
})
export type Plan = z.infer<typeof planSchema>

const text = z.string().trim().min(1).max(TITLE_MAX)

export const makeSchema = z.object({ group: z.uuid(), round: z.uuid(), scale: z.string().regex(SCALE_KEY) })
export const closeSchema = z.object({ group: z.uuid(), focusArea: z.uuid() })
export const addActionSchema = z.object({ group: z.uuid(), focusArea: z.uuid(), title: text, owner: z.uuid(), due: day })
export const updateActionSchema = z.object({ group: z.uuid(), action: z.uuid(), title: text, owner: z.uuid(), due: day })
export const doneSchema = z.object({ group: z.uuid(), action: z.uuid(), done: z.boolean() })

export const REASONS = ['signed_out', 'not_leader', 'not_member', 'not_owner', 'unavailable', 'invalid', 'already', 'full', 'no_owner'] as const
export type PlanReason = (typeof REASONS)[number] | 'failed'

export const replySchema = z.union([
  z.strictObject({ ok: z.literal(true), focus_area: z.uuid().optional() }),
  z.strictObject({ ok: z.literal(false), reason: z.enum(REASONS), max: z.number().int().positive().optional() }),
])

export type PlanResult<T extends object = object> = ({ ok: true } & T) | { ok: false; reason: PlanReason }
