import { z } from 'zod'

/**
 * What crosses the Leader Profile's server boundary (CLAUDE.md: Zod at every server boundary), shared with
 * the screens that send it. The database checks every answer again (0011, save_profile).
 */
export const answersSchema = z.record(z.uuid(), z.number().int().min(1).max(5)).refine((a) => Object.keys(a).length <= 120, 'too many answers')

export const saveProfileSchema = z.object({ test: z.enum(['quick', 'full']), answers: answersSchema })
export const shareSchema = z.object({ group: z.uuid(), level: z.enum(['nothing', 'domains', 'facets']) })

export const replySchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.enum(['signed_out', 'unavailable', 'invalid', 'not_member', 'no_profile']) }),
])

export type ProfileResult = { ok: true } | { ok: false; reason: 'signed_out' | 'unavailable' | 'invalid' | 'not_member' | 'no_profile' | 'failed' }
