import { z } from 'zod'

/**
 * How a session was signed in, from its access token's `amr` claim (D-63): `recovery` for a password-reset link,
 * `otp` for a sign-in link, `password`, `oauth` and so on. The token was issued to this server a moment ago over
 * TLS, in the same request; this only decides where a person who is now signed in goes next, so its payload is
 * read, not verified again. Anything unreadable reads as no method.
 */
const claimsSchema = z.object({ amr: z.array(z.object({ method: z.string() })).optional() })

export function signedInBy(accessToken: string | undefined): string[] {
  const payload = accessToken?.split('.')[1]
  if (!payload) return []
  try {
    const claims = claimsSchema.safeParse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
    return claims.success ? (claims.data.amr ?? []).map((a) => a.method) : []
  } catch {
    return []
  }
}
