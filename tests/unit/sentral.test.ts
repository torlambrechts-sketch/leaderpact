import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildEvent, sign } from '@/lib/platform/sentral'

/**
 * The events to Sentral (D-35): the builder refuses any field its kind does not list (CLAUDE.md invariant 12),
 * an id fits Sentral's dedupe key, and the signature is the one Sentral's product-events checks.
 */
describe('the Sentral event builder', () => {
  it('builds a template request with only its listed fields, and drops empty ones', () => {
    const e = buildEvent('template.requested', { template: 'leadership-team-charter-template', name: 'A', email: 'a@example.com', organisation: '', role: '', consent: false, lang: 'en' })
    expect(e.kind).toBe('template.requested')
    expect(e.org_id).toBeNull()
    expect(e.payload).toEqual({ template: 'leadership-team-charter-template', name: 'A', email: 'a@example.com', consent: false, lang: 'en' })
    expect(e.id).toMatch(/^\d{14,18}$/)
  })

  it('refuses a field its kind does not list, so no answer, score or comment can leave', () => {
    for (const field of ['answer', 'answers', 'score', 'standing', 'comment', 'profile', 'participation', 'message']) {
      expect(() => buildEvent('template.requested', { [field]: 'x' })).toThrow(/not listed/)
      expect(() => buildEvent('content.inventory', { [field]: 'x' })).toThrow(/not listed/)
    }
    // @ts-expect-error an unknown kind is a type error, and a runtime one
    expect(() => buildEvent('scan.answered', {})).toThrow()
  })

  it('signs "<timestamp>.<body>" with HMAC-SHA256, as Sentral verifies it', () => {
    const body = '{"product":"leaderpact","events":[]}'
    expect(sign('s'.repeat(40), '1791900000', body)).toBe(`sha256=${createHmac('sha256', 's'.repeat(40)).update(`1791900000.${body}`).digest('hex')}`)
  })
})
