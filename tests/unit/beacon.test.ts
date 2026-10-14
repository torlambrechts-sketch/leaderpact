import { describe, expect, it } from 'vitest'
import { beaconBody, mayCount, referrerHost, utmFrom } from '@/lib/site/beacon'

/**
 * The public site's visit counting (D-39): it counts the reading pages on the production hosts, never a page
 * that answers or carries a capability, never for a browser that opts out, and sends a path, a campaign and a
 * referring host, never who.
 */
describe('the visit beacon', () => {
  it.each(['/leadership-team-assessment', '/leader-profile', '/articles', '/articles/leadership-team-purpose', '/templates/leadership-team-charter-template', '/platform', '/research', '/anonymity', '/leadership-team-assessment-tools'])(
    'counts %s on www.leaderpact.com',
    (path) => expect(mayCount('www.leaderpact.com', path, false, '')).toBe(true),
  )

  it.each(['/scan', '/scan/result', '/j/abc123', '/app', '/app/lumio/home', '/app/me', '/auth/confirm', '/sign-in', '/leader-profile/quick', '/leader-profile/full', '/templates/file/leadership-team-charter-template.docx', '/specimens', '/api/x'])(
    'never counts %s',
    (path) => expect(mayCount('www.leaderpact.com', path, false, '')).toBe(false),
  )

  it('counts only on the production hosts, and never for a browser that opts out', () => {
    expect(mayCount('leaderpact.com', '/articles', false, '')).toBe(true)
    expect(mayCount('leaderpact.vercel.app', '/articles', false, '')).toBe(false)
    expect(mayCount('localhost', '/articles', false, '')).toBe(false)
    expect(mayCount('www.leaderpact.com', '/articles', true, '')).toBe(false)
    expect(mayCount('localhost', '/articles', false, 'http://127.0.0.1:9/collect')).toBe(true)
  })

  it('sends a path, the five campaign tags and the referring host, never a query or anything else', () => {
    expect(utmFrom('?utm_source=linkedin&utm_campaign=launch&email=a@b.c&utm_term=' + 'x'.repeat(100))).toEqual({
      utm_source: 'linkedin',
      utm_campaign: 'launch',
      utm_term: 'x'.repeat(80),
    })
    expect(referrerHost('https://www.google.com/search?q=leadership', 'www.leaderpact.com')).toBe('www.google.com')
    expect(referrerHost('https://www.leaderpact.com/articles', 'www.leaderpact.com')).toBeUndefined()
    expect(beaconBody({ k: 'view' }, '/articles', {}, 'www.google.com')).toEqual({ k: 'view', p: '/articles', r: 'www.google.com' })
    expect(beaconBody({ k: 'cta', l: 'template' }, '/templates/x', { utm_source: 'news' })).toEqual({ k: 'cta', p: '/templates/x', l: 'template', u: { utm_source: 'news' } })
  })
})
