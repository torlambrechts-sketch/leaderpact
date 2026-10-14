import { describe, expect, it } from 'vitest'
import { isPublic } from '@/lib/supabase/middleware'

/**
 * Deny by default. Orgpuls made every unknown kebab-case address public; LeaderPact names its
 * public surface, and everything else needs a session.
 */
describe('isPublic', () => {
  it.each(['/', '/scan', '/scan/result', '/j/abc123', '/j/lumioLeadershipScan00001', '/join/AbCdEfGhIjKlMnOpQrStUv', '/sign-in', '/auth/confirm', '/privacy', '/leadership-team-assessment', '/specimens',
    '/articles', '/articles/leadership-team-purpose', '/templates', '/templates/leadership-team-charter-template', '/templates/file/x.docx',
    '/platform', '/research', '/anonymity', '/leadership-team-assessment-tools', '/sitemap.xml', '/llms.txt', '/robots.txt'])(
    '%s is public',
    (path) => expect(isPublic(path)).toBe(true),
  )

  it.each(['/app', '/app/new', '/app/0b000000-0000-4000-8000-000000000001/invite', '/app/lumio/home', '/app/me', '/settings', '/some-page', '/scanner', '/joined', '/jx', '/sign-inx', '/articlesx', '/platforms', '/api/platform/content'])(
    '%s needs a session',
    (path) => expect(isPublic(path)).toBe(false),
  )

  it('"/" does not make every address public', () => {
    expect(isPublic('/anything')).toBe(false)
  })
})
