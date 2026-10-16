import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Where the owner's copy is sent from (D-59): a template request that Sentral took sends one, after the response;
 * a bot's request (the hidden field filled) and a refused one send none.
 */
const calls = vi.hoisted(() => ({ notify: vi.fn(async () => 'sent'), send: vi.fn(async () => 'sent'), after: [] as Array<() => unknown> }))

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => calls.after.push(fn) }))
vi.mock('@/lib/platform/owner-notice', () => ({ notifyOwner: calls.notify }))
vi.mock('@/lib/platform/sentral', () => ({ buildEvent: (kind: string, payload: unknown) => ({ kind, payload }), sendEvents: calls.send }))

const { requestTemplate } = await import('@/app/(public)/templates/actions')
const { TEMPLATES } = await import('@/lib/site/templates')

const form = { slug: TEMPLATES[0]!.slug, name: 'Ola Nordmann', mail: 'Ola@X.example', org: 'X AS', role: '', consent: true, trap: '' }

beforeEach(() => {
  calls.notify.mockClear()
  calls.send.mockReset().mockResolvedValue('sent')
  calls.after.length = 0
})

describe('a template request', () => {
  it('Sentral took it: one copy to the owner, after the response, with the same fields', async () => {
    await expect(requestTemplate(form)).resolves.toEqual({ ok: true })
    expect(calls.notify).not.toHaveBeenCalled()
    expect(calls.after).toHaveLength(1)
    await calls.after[0]!()
    expect(calls.notify).toHaveBeenCalledWith('template', {
      template: form.slug,
      name: 'Ola Nordmann',
      email: 'ola@x.example',
      organisation: 'X AS',
      role: '',
      consent: true,
    })
  })

  it('a bot, a refusal or a failure sends no copy', async () => {
    await requestTemplate({ ...form, trap: 'filled by a bot' })
    calls.send.mockResolvedValueOnce('refused')
    await expect(requestTemplate(form)).resolves.toEqual({ ok: false, problem: 'rate_limited' })
    calls.send.mockResolvedValueOnce('failed')
    await expect(requestTemplate(form)).resolves.toEqual({ ok: false, problem: 'failed' })
    expect(calls.after).toHaveLength(0)
  })
})
