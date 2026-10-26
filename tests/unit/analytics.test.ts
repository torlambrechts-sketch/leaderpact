import { describe, expect, it } from 'vitest'
import { analyticsOn, analyticsUrl } from '@/lib/site/analytics'

/**
 * Vercel Web Analytics (D-69) counts what the site's own beacon counts and nothing more: the production
 * deployment only, the production hosts only, never a page that answers or carries a capability, nothing from a
 * browser that asks not to be tracked, and no query string but the campaign tags.
 */
describe('Vercel Web Analytics', () => {
  it('runs only on the production deployment', () => {
    expect(analyticsOn('production')).toBe(true)
    for (const env of ['preview', 'development', undefined, '']) expect(analyticsOn(env)).toBe(false)
  })

  it('sends a public page, without its query string, keeping only the campaign tags', () => {
    expect(analyticsUrl('https://www.leaderpact.com/articles/team-effectiveness-models', false)).toBe(
      'https://www.leaderpact.com/articles/team-effectiveness-models',
    )
    expect(analyticsUrl('https://www.leaderpact.com/platform?utm_source=linkedin&email=a%40b.no&ref=x#faq', false)).toBe(
      'https://www.leaderpact.com/platform?utm_source=linkedin',
    )
  })

  it('never sends a page that answers, carries a capability, signs in or is the app', () => {
    for (const path of ['/scan', '/scan/result', '/j/abc123', '/p/token', '/app/x/home', '/auth/confirm?token_hash=t', '/sign-in', '/leader-profile/quick', '/templates/file/a.docx', '/api/scan']) {
      expect(analyticsUrl(`https://www.leaderpact.com${path}`, false), path).toBeNull()
    }
  })

  it('never sends from a browser that asks not to be tracked, from another host, or a malformed address', () => {
    expect(analyticsUrl('https://www.leaderpact.com/articles', true)).toBeNull()
    expect(analyticsUrl('https://leaderpact-git-branch.vercel.app/articles', false)).toBeNull()
    expect(analyticsUrl('not a url', false)).toBeNull()
  })
})
