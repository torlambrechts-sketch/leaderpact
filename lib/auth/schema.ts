import { z } from 'zod'

/**
 * What crosses the sign-in boundary, parsed on the server (CLAUDE.md: Zod at every server boundary) and
 * shared with the forms that send it.
 */

/** An email address as a person types it: trimmed and lower-cased before it is checked */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))

/**
 * A sign-in link is asked for from two places. `save` comes from the personal view's save card and may
 * make an account (handoff 6.3: "if the email is already registered, sign in and add the group"); `sign_in`
 * comes from the sign-in page and never makes one, so an account exists only for someone who saved a scan.
 */
export const linkRequestSchema = z.object({
  email: emailSchema,
  intent: z.enum(['save', 'sign_in']),
})
export type LinkRequest = z.infer<typeof linkRequestSchema>

export type LinkResult = { ok: true } | { ok: false; reason: 'invalid' | 'rate_limited' | 'failed' }

/**
 * The email link's two parameters (supabase/templates). Auth makes the token single-use and short-lived;
 * here it is only checked for shape, so nothing malformed is sent on.
 */
export const confirmSchema = z.object({
  token_hash: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  type: z.literal('email'),
})

export type ConfirmState = { problem: 'expired' | 'failed' } | null
