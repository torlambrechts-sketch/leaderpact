import { describe, expect, it } from 'vitest'
import { checkoutSchema, confirmSchema, devEventSchema, replySchema } from '@/lib/billing/schema'
import { countries, countryName } from '@/lib/billing/countries'
import { formatPrice } from '@/lib/plans/load'
import { FREE_ITEMS, TEAM_ITEMS } from '@/components/billing/plan-items'
import messages from '@/messages/en.json'

/**
 * Plans and checkout (handoff 6.18; milestone 8; D-33): what crosses the billing boundary, the countries a
 * company may be billed in, the prices as the design writes them, and the plan lists (handoff 11: meetings
 * in every plan list; no "VAT 25%"). The database checks everything again (supabase/tests/billing_invariants.sql).
 */
const GROUP = '0b000000-0000-4000-8000-000000000301'
const card = { group: GROUP, interval: 'year', method: 'card', company: ' Lumio AS ', country: 'NO' }

describe('the checkout boundary', () => {
  it('takes a card checkout with only a company and a country, trimmed, blanks as null', () => {
    const parsed = checkoutSchema.safeParse({ ...card, orgNumber: '', invoiceEmail: '  ', reference: '' })
    expect(parsed.success).toBe(true)
    expect(parsed.data).toMatchObject({ company: 'Lumio AS', orgNumber: null, invoiceEmail: null, reference: null })
  })

  it('refuses an invoice without the organisation number or the invoice email (handoff 6.18)', () => {
    expect(checkoutSchema.safeParse({ ...card, method: 'invoice', invoiceEmail: 'invoice@lumio.example' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...card, method: 'invoice', orgNumber: '923 456 789' }).success).toBe(false)
    const ok = checkoutSchema.safeParse({ ...card, method: 'invoice', orgNumber: '923 456 789', invoiceEmail: ' Invoice@Lumio.example ' })
    expect(ok.success && ok.data.invoiceEmail).toBe('invoice@lumio.example')
  })

  it('refuses a week, cash, a blank company, a lower-case country, a bad email and a long reference', () => {
    for (const wrong of [{ interval: 'week' }, { method: 'cash' }, { company: '   ' }, { country: 'no' }, { invoiceEmail: 'not-an-address' }, { reference: 'r'.repeat(61) }, { group: 'lumio' }]) {
      expect(checkoutSchema.safeParse({ ...card, ...wrong }).success).toBe(false)
    }
  })

  it('a confirm is paid or failed; a development event is one of four', () => {
    expect(confirmSchema.safeParse({ checkout: GROUP, outcome: 'refunded' }).success).toBe(false)
    expect(devEventSchema.safeParse({ group: GROUP, event: 'trial_ended' }).success).toBe(true)
    expect(devEventSchema.safeParse({ group: GROUP, event: 'refund' }).success).toBe(false)
  })

  it('reads a reply as ok with its fields, or a reason it knows', () => {
    expect(replySchema.safeParse({ ok: false, reason: 'trial_used' }).success).toBe(true)
    expect(replySchema.safeParse({ ok: false, reason: 'because' }).success).toBe(false)
    expect(replySchema.safeParse({ ok: true, checkout: GROUP, currency: 'USD', amount_minor: 180000 }).success).toBe(true)
  })
})

describe('the countries', () => {
  const list = countries()
  it('are named in British English, sorted, each code once, and two letters', () => {
    expect(list.length).toBeGreaterThan(200)
    expect(new Set(list.map((c) => c.code)).size).toBe(list.length)
    expect(list.every((c) => /^[A-Z]{2}$/.test(c.code))).toBe(true)
    expect([...list].sort((a, b) => a.name.localeCompare(b.name, 'en-GB'))).toEqual(list)
    expect(countryName('NO')).toBe('Norway')
    expect(countryName('GB')).toBe('United Kingdom')
  })

  it('leave out the groupings and the placeholders', () => {
    const codes = new Set(list.map((c) => c.code))
    for (const code of ['EU', 'UN', 'ZZ', 'XA', 'EZ', 'QO']) expect(codes.has(code)).toBe(false)
    for (const code of ['NO', 'SE', 'DK', 'DE', 'US']) expect(codes.has(code)).toBe(true)
  })
})

describe('the prices and the plan lists', () => {
  it('write the test prices as the design does: $1,800 a year, $180 a month', () => {
    expect(formatPrice({ amountMinor: 180000, currency: 'USD', interval: 'year' })).toBe('$1,800')
    expect(formatPrice({ amountMinor: 18000, currency: 'USD', interval: 'month' })).toBe('$180')
  })

  it('list meetings in the Team plan, and no tax rate anywhere in the billing copy (handoff 11)', () => {
    const billing = messages.billing as Record<string, string>
    expect(TEAM_ITEMS.map((k) => billing[k]).some((s) => /Meetings/.test(s ?? ''))).toBe(true)
    expect(FREE_ITEMS.every((k) => typeof billing[k] === 'string')).toBe(true)
    expect(Object.values(billing).some((s) => /VAT|\d+\s?%/.test(s))).toBe(false)
  })
})
