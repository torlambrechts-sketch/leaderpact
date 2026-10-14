import { z } from 'zod'

/**
 * The group's invite link and what crosses the scan's write path (handoff 6.4 and 6.5). Shared by the
 * route that submits (app/api/scan) and the pages that send to it.
 */

/** The link's code: what scan_session.code allows (0006) */
export const codeSchema = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/)

/** A replace key as app.new_replace_key mints it: 32 random bytes, base64url (0006) */
export const replaceKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

/** One submission: every item of the scan with its answer, and the browser's replace key if it has one */
export const submitSchema = z.object({
  code: codeSchema,
  answers: z.array(z.object({ item: z.uuid(), value: z.number().int().min(1).max(5) })).min(1).max(64),
  replaceKey: replaceKeySchema.nullable(),
})
export type SubmitInput = z.infer<typeof submitSchema>

/**
 * submit_scan's own answer, parsed: {ok, replace_key} or {ok: false, reason}; never an id (0006). Strict,
 * so a reply carrying anything more, an id above all, is refused rather than passed on (CLAUDE.md
 * invariant 4).
 */
export const submitReplySchema = z.union([
  z.strictObject({ ok: z.literal(true), replace_key: replaceKeySchema.nullable() }),
  z.strictObject({ ok: z.literal(false), reason: z.enum(['not_found', 'closed', 'invalid', 'full']) }),
])

export type SubmitResult =
  | { ok: true; replaceKey: string | null }
  | { ok: false; reason: 'not_found' | 'closed' | 'invalid' | 'full' | 'failed' }
  /** past 60 an hour from one network (handoff 8): the seconds to wait */
  | { ok: false; reason: 'rate_limited'; retry: number }

/** get_scan_invite's row (0009) */
export const inviteRowSchema = z.object({
  group_name: z.string().min(1),
  phase: z.enum(['open', 'closed', 'released']),
  answered: z.number().int().min(0),
  member_count: z.number().int().min(4).max(15),
  closes_at: z.string().min(1),
  instrument_version_id: z.uuid(),
})
export type InviteRow = z.infer<typeof inviteRowSchema>
