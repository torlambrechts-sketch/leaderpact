import { z } from 'zod'
import { emailSchema } from '@/lib/auth/schema'

/**
 * What crosses the group's boundary (CLAUDE.md: Zod at every server boundary), shared with the forms that
 * send it. The database checks everything again, with the charter template's limits (0014): the limits here
 * are only the template's widest, so nothing absurd is sent on.
 */
export const RIGHTS = ['decide', 'advise', 'inform'] as const
export type Right = (typeof RIGHTS)[number]

const line = z.string().trim().min(1).max(500)

export const draftSchema = z.object({
  group: z.uuid(),
  purpose: z.string().trim().max(2000),
  tasks: z.array(z.object({ title: line, right: z.enum(RIGHTS) })).max(30),
  agreements: z.array(line).max(30),
})
export type DraftInput = z.input<typeof draftSchema>

export const groupSchema = z.object({ group: z.uuid() })
export const memberSchema = z.object({ group: z.uuid(), person: z.uuid() })
export const invitationSchema = z.object({ group: z.uuid(), invitation: z.uuid() })
export const inviteSchema = z.object({ group: z.uuid(), email: emailSchema, name: z.string().trim().min(1).max(120) })

/** The invitation link's token: 16 random bytes, base64url (0009's link codes, reused by 0014) */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/)
export const joinRequestSchema = z.object({ token: tokenSchema, email: emailSchema })

export const REASONS = [
  'signed_out', 'not_leader', 'unavailable', 'invalid', 'no_draft', 'incomplete', 'already_member', 'full',
  'unknown', 'revoked', 'used', 'expired', 'other_address', 'only_leader',
] as const
export type GroupReason = (typeof REASONS)[number] | 'failed' | 'rate_limited'

export const replySchema = z.union([
  z.object({ ok: z.literal(true), version: z.number().int().optional(), token: z.string().optional(), invitation: z.uuid().optional(), team: z.uuid().optional() }),
  z.object({ ok: z.literal(false), reason: z.enum(REASONS) }),
])

export type GroupResult<T extends object = object> = ({ ok: true } & T) | { ok: false; reason: GroupReason }
