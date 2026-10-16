import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNotice, notifyOwner } from '@/lib/platform/owner-notice'

/**
 * The owner's copy of each new account and each template download (D-59). Which accounts are new is the
 * database's to say (0029, supabase/tests/signup_invariants.sql check 3); here, what the mail carries, that it
 * carries nothing else, and that it is quiet until set and says nothing about a person in a log.
 */

const ENV = ['BREVO_API_KEY', 'OWNER_NOTICE_TO', 'LEADERPACT_MAIL_FROM'] as const
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  vi.restoreAllMocks()
})

const configure = () => {
  process.env.BREVO_API_KEY = 'xkeysib-test-key-not-real-0123456789'
  process.env.OWNER_NOTICE_TO = ' Owner@Example.com '
  process.env.LEADERPACT_MAIL_FROM = 'post@leaderpact.example'
}

describe('the mail', () => {
  it('a new account: name, email, company and the way in, nothing else', () => {
    const mail = buildNotice('sign_up', { name: 'Sigrid Haugen', email: 'sigrid@haugen.example', company: 'Haugen AS', method: 'google' })
    expect(mail.subject).toBe('New account on LeaderPact: Sigrid Haugen')
    expect(mail.text).toContain('Name: Sigrid Haugen')
    expect(mail.text).toContain('Email: sigrid@haugen.example')
    expect(mail.text).toContain('Company: Haugen AS')
    expect(mail.text).toContain('Signed up with: Google')
    expect(buildNotice('sign_up', { email: 'a@b.example', method: 'azure' }).text).toContain('Signed up with: Microsoft')
  })

  it('a template download: the fields Sentral gets, the consent in words', () => {
    const mail = buildNotice('template', { template: 'charter', name: 'Ola', email: 'ola@x.example', organisation: '', role: 'CEO', consent: false })
    expect(mail.subject).toBe('Template download: charter, by Ola')
    expect(mail.text).toContain('Organisation: Not given')
    expect(mail.text).toContain('Role: CEO')
    expect(mail.text).toContain('Wants email about new templates and articles: No')
    expect(buildNotice('template', { template: 'agenda', email: 'ola@x.example', consent: true }).subject).toBe('Template download: agenda, by ola@x.example')
  })

  it('refuses any field its kind does not list', () => {
    expect(() => buildNotice('sign_up', { email: 'a@b.example', group: 'Lumio' })).toThrow('field not listed for sign_up: group')
    expect(() => buildNotice('template', { template: 'charter', answers: 'x' })).toThrow('field not listed')
  })

  it('what a person typed cannot become markup', () => {
    const mail = buildNotice('sign_up', { name: '<img src=x onerror=alert(1)>', email: 'a@b.example', company: 'A & B "Ltd"' })
    expect(mail.html).not.toContain('<img')
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(mail.html).toContain('A &amp; B &quot;Ltd&quot;')
  })
})

describe('sending', () => {
  it('quiet until set, and says which setting is missing, not to whom', async () => {
    for (const k of ENV) delete process.env[k]
    const fetcher = vi.fn()
    await expect(notifyOwner('sign_up', { email: 'sigrid@haugen.example' }, fetcher)).resolves.toBe('unconfigured')
    expect(fetcher).not.toHaveBeenCalled()
    const logged = vi.mocked(console.info).mock.calls.flat().join(' ')
    expect(logged).toContain('BREVO_API_KEY')
    expect(logged).not.toContain('sigrid')
  })

  it("one mail to the owner through Brevo's transactional API", async () => {
    configure()
    const fetcher = vi.fn(async () => new Response('{}', { status: 201 }))
    await expect(notifyOwner('template', { template: 'charter', email: 'ola@x.example', consent: true }, fetcher as unknown as typeof fetch)).resolves.toBe('sent')
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test-key-not-real-0123456789')
    const body = JSON.parse(String(init.body))
    expect(body.to).toEqual([{ email: 'owner@example.com' }])
    expect(body.sender).toEqual({ email: 'post@leaderpact.example', name: 'LeaderPact' })
    expect(body.tags).toEqual(['owner_template'])
  })

  it('a refusal or a dead network logs the kind and the status, never the person', async () => {
    configure()
    const refused = vi.fn(async () => new Response('{"message":"invalid sigrid@haugen.example"}', { status: 400 }))
    await expect(notifyOwner('sign_up', { name: 'Sigrid', email: 'sigrid@haugen.example' }, refused as unknown as typeof fetch)).resolves.toBe('failed')
    const down = vi.fn(async () => Promise.reject(new TypeError('fetch failed')))
    await expect(notifyOwner('sign_up', { name: 'Sigrid', email: 'sigrid@haugen.example' }, down as unknown as typeof fetch)).resolves.toBe('failed')
    const logged = vi.mocked(console.error).mock.calls.flat().join(' ')
    expect(logged).toContain('sign_up: HTTP 400')
    expect(logged).toContain('sign_up: TypeError')
    expect(logged).not.toMatch(/sigrid/i)
  })
})
