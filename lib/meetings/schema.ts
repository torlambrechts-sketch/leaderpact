import { z } from 'zod'

/**
 * Meetings and agendas as they cross the server boundary (handoff 6.14; 0018): what the Meetings page reads,
 * and what planning a meeting and proposing an item send. The database checks everything again: the owner a
 * current member, the team task one of the charter in force, the limits of the agenda template.
 */
export const ITEM_TYPES = ['information', 'discussion', 'decision', 'follow_up'] as const
export type ItemType = (typeof ITEM_TYPES)[number]
export const TITLE_MAX = 200
export const MEETING_TITLE_MAX = 120
export const OUTCOME_MAX = 300

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const meetingSchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  meets_on: day,
  starts_at: time,
  minutes: z.number().int().min(15).max(480),
  status: z.enum(['planned', 'live', 'held', 'cancelled']),
  next: z.boolean(),
})
export type Meeting = z.infer<typeof meetingSchema>

export const meetingsSchema = z.strictObject({
  meetings: z.array(meetingSchema),
  next: z.uuid().nullable(),
  meeting_minutes: z.number().int().min(15).max(480),
  leader: z.boolean(),
  can_plan: z.boolean(),
})
export type Meetings = z.infer<typeof meetingsSchema>

export const itemSchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  type: z.enum(ITEM_TYPES).nullable(),
  outcome: z.string().nullable(),
  owner: z.uuid().nullable(),
  owner_name: z.string().nullable(),
  owner_current: z.boolean(),
  minutes: z.number().int().min(1).max(240).nullable(),
  task: z.uuid().nullable(),
  task_title: z.string().nullable(),
  confirmed: z.boolean(),
  closing: z.boolean(),
  ready: z.boolean(),
  flagged: z.boolean(),
  can_edit: z.boolean(),
  can_remove: z.boolean(),
})
export type AgendaItem = z.infer<typeof itemSchema>

export const agendaSchema = z.strictObject({
  meeting: meetingSchema,
  items: z.array(itemSchema),
  tasks: z.array(z.strictObject({ id: z.uuid(), title: z.string() })),
  // every open action of the group, on its next agenda only
  open_actions: z
    .array(z.strictObject({ id: z.uuid(), title: z.string(), owner_name: z.string(), due_on: day, focus: z.string().nullable() }))
    .nullable(),
  members: z.array(z.strictObject({ person: z.uuid(), name: z.string(), me: z.boolean() })),
  max_items: z.number().int().positive(),
  leader: z.boolean(),
  can_propose: z.boolean(),
  can_manage: z.boolean(),
})
export type Agenda = z.infer<typeof agendaSchema>

const optional = <T extends z.ZodTypeAny>(s: T) => s.nullable()

export const meetingInputSchema = z.object({
  group: z.uuid(),
  title: z.string().trim().min(1).max(MEETING_TITLE_MAX),
  on: day,
  at: time,
  minutes: z.number().int().min(15).max(480),
})
export const meetingChangeSchema = meetingInputSchema.omit({ group: true }).extend({ meeting: z.uuid() })
export const meetingRefSchema = z.object({ meeting: z.uuid() })

export const itemFieldsSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX),
  type: optional(z.enum(ITEM_TYPES)),
  outcome: optional(z.string().trim().max(OUTCOME_MAX)),
  owner: optional(z.uuid()),
  minutes: optional(z.number().int().min(1).max(240)),
  task: optional(z.uuid()),
})
export type ItemFields = z.infer<typeof itemFieldsSchema>
export const proposeSchema = itemFieldsSchema.extend({ meeting: z.uuid() })
export const itemChangeSchema = itemFieldsSchema.extend({ item: z.uuid() })
export const itemRefSchema = z.object({ item: z.uuid() })

export const REASONS = ['signed_out', 'not_leader', 'not_member', 'not_allowed', 'unavailable', 'invalid', 'no_owner', 'no_task', 'full'] as const
export type MeetingReason = (typeof REASONS)[number] | 'failed'

export const replySchema = z.union([
  z.strictObject({ ok: z.literal(true), meeting: z.uuid().optional() }),
  z.strictObject({ ok: z.literal(false), reason: z.enum(REASONS) }),
])

export type MeetingResult<T extends object = object> = ({ ok: true } & T) | { ok: false; reason: MeetingReason }
