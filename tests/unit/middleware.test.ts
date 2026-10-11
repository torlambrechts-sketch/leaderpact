import { describe, expect, it } from 'vitest'
import { isPublic } from '@/lib/supabase/middleware'

/**
 * Deny by default. Orgpuls made every unknown kebab-case address public; LeaderPact names its
 * public surface, and everything else needs a session.
 */
describe('isPublic', () => {
  it.each(['/', '/scan', '/scan/result', '/j/abc123', '/sign-in', '/auth/confirm', '/privacy', '/leadership-team-assessment', '/specimens'])(
    '%s is public',
    (path) => expect(isPublic(path)).toBe(true),
  )

  it.each(['/app/lumio/home', '/app/me', '/settings', '/some-page', '/scanner', '/joined', '/jx'])(
    '%s needs a session',
    (path) => expect(isPublic(path)).toBe(false),
  )

  it('"/" does not make every address public', () => {
    expect(isPublic('/anything')).toBe(false)
  })
})
