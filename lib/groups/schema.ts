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

export const startGroupSchema = z.object({ name: groupNameSchema, size: groupSizeSchema, request: z.uuid() })
export type StartGroupInput = z.infer<typeof startGroupSchema>

/** start_group's own answer, parsed (0009) */
export const startReplySchema = z.union([
  z.object({ ok: z.literal(true), team: z.uuid(), code: codeSchema }),
  z.object({ ok: z.literal(false), reason: z.enum(['signed_out', 'invalid', 'unavailable']) }),
])

export type StartGroupResult =
  | { ok: true; team: string; code: string }
  | { ok: false; reason: 'signed_out' | 'invalid' | 'unavailable' | 'failed' }
