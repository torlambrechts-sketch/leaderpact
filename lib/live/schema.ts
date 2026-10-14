import { z } from 'zod'
import { ITEM_TYPES } from '@/lib/meetings/schema'

/**
 * The live meeting as it crosses the boundary (handoff 6.15; 0019): what the live page reads, and what its
 * controls and contributions send. The database checks everything again. A process comment is a kind and
 * nothing else: no reply here carries who sent one.
 */
export const COMMENT_KINDS = ['purpose', 'off_track'] as const
export type CommentKind = (typeof COMMENT_KINDS)[number]
export const CLOSES = ['reached', 'carried_over', 'parked'] as const
export type Close = (typeof CLOSES)[number]
export const CONTROLS = ['start', 'pause', 'extend', 'take', ...CLOSES] as const
export type Control = (typeof CONTROLS)[number]

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const liveItemSchema = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  type: z.enum(ITEM_TYPES).nullable(),
  outcome: z.string().nullable(),
  owner_name: z.string().nullable(),
  minutes: z.number().int().nullable(),
  extra: z.number().int().min(0),
  elapsed: z.number().int().min(0),
  task_title: z.string().nullable(),
  closing: z.boolean(),
  closed_as: z.enum(CLOSES).nullable(),
  carried: z.boolean(),
  decision: z.string().nullable(),
  actions: z.array(z.strictObject({ id: z.uuid(), title: z.string(), owner_name: z.string(), due_on: day, status: z.enum(['open', 'done']) })),
  // counts only, never who
  comments: z.strictObject({ purpose: z.number().int().min(0), off_track: z.number().int().min(0) }),
})
export type LiveItem = z.infer<typeof liveItemSchema>

export const liveSchema = z.strictObject({
  meeting: z.strictObject({
    id: z.uuid(),
    title: z.string(),
    status: z.enum(['live', 'held']),
    meets_on: day,
    starts_at: z.string(),
    minutes: z.number().int(),
  }),
  now: z.string(),
  current: z.uuid().nullable(),
  timer_started_at: z.string().nullable(),
  items: z.array(liveItemSchema),
  parking: z.array(z.strictObject({ id: z.uuid(), text: z.string() })),
  open_actions: z.array(z.strictObject({ id: z.uuid(), title: z.string(), owner_name: z.string(), due_on: day })).nullable(),
  members: z.array(z.strictObject({ person: z.uuid(), name: z.string(), me: z.boolean() })),
  online: z.number().int().min(0),
  k: z.number().int().min(4).max(8),
  comments_open: z.boolean(),
  sync: z.boolean(),
  leader: z.boolean(),
  can_run: z.boolean(),
  can_add: z.boolean(),
})
export type Live = z.infer<typeof liveSchema>

/** The signal row Realtime sends: a version and the last comment's kind, never who */
export const signalSchema = z.object({
  meeting_id: z.uuid(),
  version: z.number(),
  comment_kind: z.enum(COMMENT_KINDS).nullable(),
  comment_item: z.uuid().nullable(),
  comment_seq: z.number(),
})

export const meetingRefSchema = z.object({ meeting: z.uuid() })
export const controlSchema = z.object({ meeting: z.uuid(), do: z.enum(CONTROLS), item: z.uuid().nullable().optional() })
export const decisionSchema = z.object({ item: z.uuid(), text: z.string().trim().min(1).max(1000) })
export const itemActionSchema = z.object({ item: z.uuid(), title: z.string().trim().min(1).max(200), owner: z.uuid(), due: day })
export const parkSchema = z.object({ meeting: z.uuid(), text: z.string().trim().min(1).max(200) })
export const commentSchema = z.object({ meeting: z.uuid(), kind: z.enum(COMMENT_KINDS) })

export const REASONS = ['signed_out', 'not_leader', 'not_member', 'unavailable', 'invalid', 'no_owner', 'too_few', 'full'] as const
/** 'rate_limited': more than 10 events a second (handoff 8; 0021): the event is dropped and the room read again */
export type LiveReason = (typeof REASONS)[number] | 'failed' | 'rate_limited'

export const replySchema = z.union([
  z.strictObject({ ok: z.literal(true), online: z.number().int().min(0).optional() }),
  z.strictObject({ ok: z.literal(false), reason: z.enum(REASONS) }),
])
export type LiveResult<T extends object = object> = ({ ok: true } & T) | { ok: false; reason: LiveReason }
