/**
 * A session lasts 30 days on a device (handoff section 8, Authentication).
 *
 * `@supabase/ssr` writes its session cookies for 400 days and ignores a shorter `maxAge` in its own
 * options (it spreads its default over them), so the cap is applied where the cookies are written: in
 * the server client and in the middleware. A removal (`maxAge` 0) passes unchanged. Each refresh writes
 * the cookie again, so the 30 days run from the last visit; a hard limit from sign-in is the hosted
 * session time-box, a paid-plan setting (D-10, owner A2).
 */
export const SESSION_DAYS = 30
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60

export function capSessionCookie<T extends { maxAge?: number }>(options: T | undefined): T {
  const given = options ?? ({} as T)
  if (given.maxAge === 0) return given
  return { ...given, maxAge: Math.min(given.maxAge ?? SESSION_MAX_AGE, SESSION_MAX_AGE) }
}
