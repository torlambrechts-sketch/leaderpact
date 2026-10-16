import { z } from 'zod'

/**
 * What crosses the private link's boundary (D-66), shared by the server and the screens: a token of 22 base64url
 * characters (app.new_link_code), and the two levels a link may show. "Nothing" is not a level: that is a link
 * turned off.
 */
export const linkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/)
export const linkLevelSchema = z.enum(['domains', 'facets'])
export type LinkLevel = z.infer<typeof linkLevelSchema>

export const makeLinkSchema = z.object({ level: linkLevelSchema })

export const makeLinkReply = z.union([
  z.object({ ok: z.literal(true), token: linkTokenSchema }),
  z.object({ ok: z.literal(false), reason: z.enum(['signed_out', 'invalid', 'no_profile']) }),
])

export type MakeLinkResult = { ok: true; token: string } | { ok: false; reason: 'signed_out' | 'invalid' | 'no_profile' | 'failed' }
