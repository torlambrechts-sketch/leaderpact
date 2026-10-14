import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crc32, zipStored } from '@/lib/export/zip'
import { downloadReplySchema, exportArchive, exportTokenSchema } from '@/lib/export/files'
import { keyed, networkOf, clientAddress } from '@/lib/limits/key'
import { sameOrigin } from '@/lib/limits/same-origin'
import { deleteAccountSchema, deleteReplySchema, exportReplySchema, notificationsSchema, timeZoneSchema } from '@/lib/account/schema'

/**
 * Milestone 16 (handoff 6.18 and 8; D-53): "An export arrives. A delete removes personal data. Limits return
 * 429." The database counts, builds, empties and deletes (supabase/tests/limits_, mail_ and
 * privacy_invariants.sql); here, the keys the app counts by, the boundary the settings send, and the file.
 */

describe('the public limits are keyed by network, and the key names nobody', () => {
  it('reads the client from the platform headers', () => {
    expect(clientAddress(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9')
    expect(clientAddress(new Headers({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
    expect(clientAddress(new Headers())).toBeNull()
  })

  it('a /24 for IPv4 and a /48 for IPv6; anything else is no network', () => {
    expect(networkOf('203.0.113.9')).toBe('203.0.113.0/24')
    expect(networkOf('::ffff:203.0.113.200')).toBe('203.0.113.0/24')
    expect(networkOf('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::/48')
    expect(networkOf('2001:0db8:0000::1')).toBe('2001:db8:0::/48')
    expect(networkOf('::1')).toBe('0:0:0::/48')
    expect(networkOf('300.1.1.1')).toBeNull()
    expect(networkOf('not an address')).toBeNull()
    expect(networkOf(null)).toBeNull()
  })

  describe('keyed', () => {
    const saved = process.env.RATE_LIMIT_SECRET
    afterEach(() => {
      if (saved === undefined) delete process.env.RATE_LIMIT_SECRET
      else process.env.RATE_LIMIT_SECRET = saved
    })
    it('is 64 hex characters, the same for the same network, and changes with the secret', () => {
      delete process.env.RATE_LIMIT_SECRET
      const plain = keyed('network:203.0.113.0/24')
      expect(plain).toMatch(/^[0-9a-f]{64}$/)
      expect(keyed('network:203.0.113.0/24')).toBe(plain)
      expect(plain).not.toContain('203')
      process.env.RATE_LIMIT_SECRET = 'a-secret-for-the-test'
      const secret = keyed('network:203.0.113.0/24')
      expect(secret).toMatch(/^[0-9a-f]{64}$/)
      expect(secret).not.toBe(plain)
    })
  })

  it('a route that changes something takes requests from its own pages only', () => {
    const req = (origin: string | null, host = 'app.example') =>
      new Request('https://app.example/api/export', { method: 'POST', headers: { host, ...(origin ? { origin } : {}) } })
    expect(sameOrigin(req('https://app.example'))).toBe(true)
    expect(sameOrigin(req('https://evil.example'))).toBe(false)
    expect(sameOrigin(req(null))).toBe(false)
    expect(sameOrigin(req('not a url'))).toBe(false)
  })
})

describe("the person's settings at the boundary", () => {
  it('a summary the database knows, and a time zone spelt as IANA spells it, or none', () => {
    expect(notificationsSchema.safeParse({ summary: 'monthly', timeZone: 'Europe/Oslo' }).success).toBe(true)
    expect(notificationsSchema.safeParse({ summary: 'off', timeZone: null }).success).toBe(true)
    expect(notificationsSchema.safeParse({ summary: 'daily', timeZone: null }).success).toBe(false)
    expect(notificationsSchema.safeParse({ summary: 'weekly', timeZone: "Europe/Oslo'; drop" }).success).toBe(false)
    expect(notificationsSchema.safeParse({ summary: 'weekly', timeZone: null, extra: 1 }).success).toBe(false)
    for (const z of ['UTC', 'America/Argentina/Buenos_Aires', 'Etc/GMT+1', 'America/Port-au-Prince']) expect(timeZoneSchema.safeParse(z).success).toBe(true)
  })

  it('deleting an account is asked for in words, and its answers read', () => {
    expect(deleteAccountSchema.safeParse({ confirm: 'delete' }).success).toBe(true)
    expect(deleteAccountSchema.safeParse({}).success).toBe(false)
    expect(deleteReplySchema.safeParse({ ok: false, reason: 'sole_leader', groups: ['Lumio'] }).success).toBe(true)
    expect(deleteReplySchema.safeParse({ ok: false, reason: 'sole_leader', groups: [] }).success).toBe(false)
    expect(exportReplySchema.safeParse({ ok: false, reason: 'too_many', retry: 3600 }).success).toBe(true)
    expect(exportReplySchema.safeParse({ ok: false, reason: 'too_many' }).success).toBe(false)
  })
})

describe('the export file', () => {
  it('a ZIP of README.txt and data.json, stored, with correct checksums', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
    const at = new Date('2026-10-14T12:00:00Z')
    const { name, bytes } = exportArchive({ format: 'leaderpact-export/1', person: { name: 'Kari Nordmann' } }, ['One.', 'Two.'], at)
    expect(name).toBe('leaderpact-data-2026-10-14.zip')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    // the end record: two files
    const end = bytes.byteLength - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 8, true)).toBe(2)
    // walk the local headers: each name, and its stored content with its checksum
    const dec = new TextDecoder()
    const files: Record<string, string> = {}
    let at0 = 0
    for (let i = 0; i < 2; i++) {
      const size = view.getUint32(at0 + 18, true)
      const nameLen = view.getUint16(at0 + 26, true)
      const fname = dec.decode(bytes.slice(at0 + 30, at0 + 30 + nameLen))
      const data = bytes.slice(at0 + 30 + nameLen, at0 + 30 + nameLen + size)
      expect(view.getUint32(at0 + 14, true)).toBe(crc32(data))
      files[fname] = dec.decode(data)
      at0 += 30 + nameLen + size
    }
    expect(Object.keys(files)).toEqual(['README.txt', 'data.json'])
    expect(JSON.parse(files['data.json']!)).toEqual({ format: 'leaderpact-export/1', person: { name: 'Kari Nordmann' } })
    expect(files['README.txt']).toBe('One.\r\n\r\nTwo.\r\n')
  })

  it('a zip of nothing is still a zip', () => {
    expect(zipStored([]).byteLength).toBe(22)
  })

  it("the link's token is base64url, and download's answers read", () => {
    expect(exportTokenSchema.safeParse('AbCdEfGhIjKlMnOpQrStUv-_AbCdEfGhIjKlMnOpQrSt').success).toBe(true)
    expect(exportTokenSchema.safeParse('short').success).toBe(false)
    expect(exportTokenSchema.safeParse('a'.repeat(40) + '/..').success).toBe(false)
    expect(downloadReplySchema.safeParse({ ok: true, content: { format: 'x' } }).success).toBe(true)
    expect(downloadReplySchema.safeParse({ ok: false, reason: 'used' }).success).toBe(true)
    expect(downloadReplySchema.safeParse({ ok: true, content: null }).success).toBe(false)
  })
})

// ---------------------------------------------------------------- the routes answer 429
const rpc = vi.fn()
const takePublicRate = vi.fn()
const submitScanAnswers = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ schema: () => ({ rpc }) }) }))
vi.mock('@/lib/supabase/anon', () => ({ anonClient: () => ({ schema: () => ({ rpc }) }) }))
vi.mock('@/lib/scan/submit', () => ({ submitScanAnswers: (...a: unknown[]) => submitScanAnswers(...a) }))
vi.mock('@/lib/limits/key', async (orig) => ({ ...(await orig<typeof import('@/lib/limits/key')>()), takePublicRate: (...a: unknown[]) => takePublicRate(...a) }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

describe('the routes', () => {
  beforeEach(() => {
    rpc.mockReset()
    takePublicRate.mockReset()
    submitScanAnswers.mockReset()
  })

  const scanBody = JSON.stringify({ code: 'lumioLeadershipScan00001', answers: [{ item: '9b2f6c1e-3a4d-4c5b-8e6f-7a8b9c0d1e2f', value: 4 }], replaceKey: null })

  it('the scan: past 60 an hour from a network, 429 with the seconds to wait, and nothing is written', async () => {
    const { POST } = await import('@/app/api/scan/route')
    takePublicRate.mockResolvedValue(1800)
    const res = await POST(new Request('https://app.example/api/scan', { method: 'POST', body: scanBody, headers: { 'x-forwarded-for': '203.0.113.9' } }))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('1800')
    expect(await res.json()).toEqual({ ok: false, reason: 'rate_limited', retry: 1800 })
    expect(submitScanAnswers).not.toHaveBeenCalled()
    expect(takePublicRate.mock.calls[0]![0]).toBe('scan_submit')
    expect(takePublicRate.mock.calls[0]![1]).toMatch(/^[0-9a-f]{64}$/)
  })

  it('the scan: under the limit it submits; a malformed body is 400', async () => {
    const { POST } = await import('@/app/api/scan/route')
    takePublicRate.mockResolvedValue(0)
    submitScanAnswers.mockResolvedValue({ ok: true, replaceKey: null })
    const res = await POST(new Request('https://app.example/api/scan', { method: 'POST', body: scanBody, headers: { 'x-forwarded-for': '203.0.113.9' } }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, replaceKey: null })
    const bad = await POST(new Request('https://app.example/api/scan', { method: 'POST', body: '{"code":1}' }))
    expect(bad.status).toBe(400)
  })

  const exportReq = (origin = 'https://app.example') => new Request('https://app.example/api/export', { method: 'POST', headers: { host: 'app.example', origin } })

  it('the export: past 5 a day, 429 with Retry-After; from another site, 403', async () => {
    const { POST } = await import('@/app/api/export/route')
    rpc.mockResolvedValue({ data: { ok: false, reason: 'too_many', retry: 7200 }, error: null })
    const res = await POST(exportReq())
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('7200')
    expect(await res.json()).toEqual({ ok: false, reason: 'too_many', retry: 7200 })
    expect(rpc).toHaveBeenCalledWith('request_export')
    rpc.mockClear()
    const foreign = await POST(exportReq('https://evil.example'))
    expect(foreign.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('the export: built and mailed is 200; signed out is 401', async () => {
    const { POST } = await import('@/app/api/export/route')
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null })
    expect((await POST(exportReq())).status).toBe(200)
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: 'signed_out' }, error: null })
    expect((await POST(exportReq())).status).toBe(401)
  })

  it('the download: the file once, as a ZIP; a used link goes back to the page', async () => {
    const { POST } = await import('@/app/(join)/export/[token]/download/route')
    const token = 'AbCdEfGhIjKlMnOpQrStUv-_AbCdEfGhIjKlMnOpQrSt'
    const params = Promise.resolve({ token })
    rpc.mockResolvedValueOnce({ data: { ok: true, content: { format: 'leaderpact-export/1' } }, error: null })
    const res = await POST(new Request(`https://app.example/export/${token}/download`, { method: 'POST' }), { params })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="leaderpact-data-\d{4}-\d{2}-\d{2}\.zip"$/)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(rpc).toHaveBeenCalledWith('download_export', { p_token: token })
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: 'used' }, error: null })
    const used = await POST(new Request(`https://app.example/export/${token}/download`, { method: 'POST' }), { params: Promise.resolve({ token }) })
    expect(used.status).toBe(303)
    expect(used.headers.get('location')).toBe(`/export/${token}?state=used`)
    rpc.mockClear()
    const unknown = await POST(new Request('https://app.example/export/x/download', { method: 'POST' }), { params: Promise.resolve({ token: 'x' }) })
    expect(unknown.headers.get('location')).toBe('/export/x?state=unknown')
    expect(rpc).not.toHaveBeenCalled()
  })
})
