import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPublic, isUnknown, PUBLIC_PATHS, SESSION_PATHS } from '@/lib/supabase/middleware'

/**
 * Deny by default. Orgpuls made every unknown kebab-case address public; LeaderPact names its
 * public surface, and everything else needs a session.
 */
describe('isPublic', () => {
  it.each(['/', '/scan', '/scan/result', '/j/abc123', '/j/lumioLeadershipScan00001', '/join/AbCdEfGhIjKlMnOpQrStUv', '/sign-in', '/sign-up', '/auth/confirm', '/privacy', '/leadership-team-assessment', '/specimens',
    '/articles', '/articles/leadership-team-purpose', '/templates', '/templates/leadership-team-charter-template', '/templates/file/x.docx',
    '/platform', '/research', '/anonymity', '/leadership-team-assessment-tools', '/sitemap.xml', '/llms.txt', '/robots.txt'])(
    '%s is public',
    (path) => expect(isPublic(path)).toBe(true),
  )

  it.each(['/app', '/app/new', '/app/0b000000-0000-4000-8000-000000000001/invite', '/app/lumio/home', '/app/me', '/settings', '/some-page', '/scanner', '/joined', '/jx', '/sign-inx', '/sign-upx', '/articlesx', '/platforms', '/api/platform/content'])(
    '%s needs a session',
    (path) => expect(isPublic(path)).toBe(false),
  )

  it('"/" does not make every address public', () => {
    expect(isPublic('/anything')).toBe(false)
  })
})

/**
 * An address under no route is answered 404 (D-49), not sent to sign-in. That is safe only while every route the
 * app has is named, public or behind a session: this reads app/ and holds it.
 */
describe('isUnknown', () => {
  it.each(['/blog/2019/hello-world', '/product/old-widget', '/wp-content/uploads/a.pdf', '/sitemap_index.xml', '/kontakt', '/about-us'])(
    '%s is under no route',
    (path) => expect(isUnknown(path)).toBe(true),
  )

  it.each(['/', '/app', '/app/me', '/api/anything', '/scan', '/articles/an-old-slug', '/platform/x'])('%s is a route', (path) => expect(isUnknown(path)).toBe(false))

  it.each(['/App/me', '/APP', '//app/me', '/%61pp/me', '/%2Fapp/me', '/%E0%A4%A'])('%s is never taken for unknown: it fails closed', (path) => expect(isUnknown(path)).toBe(false))

  it('every top-level route in app/ is public or needs a session', () => {
    const roots = new Set<string>()
    const visit = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) {
          // a route group adds no segment; its children are top-level routes
          if (/^\(.+\)$/.test(name)) visit(full)
          else if (!name.startsWith('_')) roots.add(`/${name}`)
        } else if (name === 'robots.ts') roots.add('/robots.txt')
        else if (name === 'sitemap.ts') roots.add('/sitemap.xml')
      }
    }
    visit('app')
    // a dynamic top-level segment would make every address a route
    expect([...roots].filter((r) => r.startsWith('/['))).toEqual([])
    const named = new Set<string>([...PUBLIC_PATHS, ...SESSION_PATHS])
    expect([...roots].filter((r) => !named.has(r)).sort()).toEqual([])
  })
})
