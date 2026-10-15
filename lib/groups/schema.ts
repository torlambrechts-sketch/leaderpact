import { z } from 'zod'
import { codeSchema } from '@/lib/scan/link'

/**
 * Starting a group (handoff 6.3): its name and its size, 4 to 15 with the leader included (owner C4), and
 * a random request id so that a second press makes no second group (0009).
 */
export const GROUP_MIN = 4
export const GROUP_MAX = 15

export const groupNameSchema = z.string().trim().min(1).max(120)
export const groupSizeSchema = z.number().int().min(GROUP_MIN).max(GROUP_MAX)

// the company, when the new-group form asks for it (a sign-up through Google or Microsoft gives none; D-57)
export const startGroupSchema = z.object({ name: groupNameSchema, size: groupSizeSchema, request: z.uuid(), company: z.string().trim().min(1).max(200).optional() })
export type StartGroupInput = z.infer<typeof startGroupSchema>

/** start_group's own answer, parsed (0009) */
export const startReplySchema = z.union([
  z.object({ ok: z.literal(true), team: z.uuid(), code: codeSchema }),
  z.object({ ok: z.literal(false), reason: z.enum(['signed_out', 'invalid', 'unavailable']) }),
])

export type StartGroupResult =
  | { ok: true; team: string; code: string }
  | { ok: false; reason: 'signed_out' | 'invalid' | 'unavailable' | 'failed' }

/**
 * The Settings Group tab (handoff 6.18; 0026): the name, the organisation, the threshold (4, raised up to 8 and
 * never lowered), and the member count, with whether the reader leads the group. The database checks each write
 * again: the leader, a name of 1 to 120 characters, a threshold above the current one.
 */
export const THRESHOLD_MIN = 4
export const THRESHOLD_MAX = 8

export const groupSettingsSchema = z.object({
  name: z.string().min(1),
  organisation: z.string().min(1),
  threshold: z.number().int().min(THRESHOLD_MIN).max(THRESHOLD_MAX),
  threshold_max: z.number().int().min(THRESHOLD_MIN).max(THRESHOLD_MAX),
  members: z.number().int().min(0),
  members_max: z.number().int().positive(),
  can_edit: z.boolean(),
})
export type GroupSettings = z.infer<typeof groupSettingsSchema>

export const renameGroupSchema = z.strictObject({ team: z.uuid(), name: groupNameSchema })
export const raiseThresholdSchema = z.strictObject({ team: z.uuid(), threshold: z.number().int().min(THRESHOLD_MIN + 1).max(THRESHOLD_MAX) })

export const renameReplySchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.enum(['signed_out', 'not_leader', 'invalid']) }),
])
export const raiseReplySchema = z.union([
  z.object({ ok: z.literal(true), threshold: z.number().int() }),
  z.object({ ok: z.literal(false), reason: z.literal('not_higher'), threshold: z.number().int() }),
  z.object({ ok: z.literal(false), reason: z.enum(['signed_out', 'not_leader', 'invalid']) }),
])

export type GroupSettingResult = { ok: true } | { ok: false; reason: 'signed_out' | 'not_leader' | 'invalid' | 'not_higher' | 'failed' }
