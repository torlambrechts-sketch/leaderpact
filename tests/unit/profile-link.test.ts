import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { linkTokenSchema, makeLinkSchema } from '@/lib/profile/link-io'
import { NEVER, mayCount } from '@/lib/site/beacon'

/**
 * Sharing a Leader Profile outside its owner's groups (D-66): the private link's boundary, its two server actions,
 * what its page reads, the PDF route, and that the link's page is never counted. The database's side (a fingerprint
 * only, bands only, ended on a retake) is supabase/tests/profile_link_invariants.sql; the walk is profile.spec.ts.
 */
const rpc = vi.hoisted(() => vi.fn())
const anonRpc = vi.hoisted(() => vi.fn())
const user = vi.hoisted(() => ({ value: { id: '0b000000-0000-4000-8000-0000000000aa' } as { id: string } | null }))
const profile = vi.hoisted(() => ({ value: null as unknown }))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ schema: () => ({ rpc }) }) }))
vi.mock('@/lib/supabase/anon', () => ({ anonClient: () => ({ schema: () => ({ rpc: anonRpc }) }) }))
vi.mock('@/lib/auth/session', () => ({ currentUser: async () => user.value }))
vi.mock('@/lib/profile/load', () => ({ loadMyProfile: async () => profile.value, loadPersonName: async () => 'Sofie Lie' }))
vi.mock('@/lib/profile/pdf', async (original) => {
  const actual = await original<typeof import('@/lib/profile/pdf')>()
  return { profilePdf: vi.fn(actual.profilePdf) }
})

const { endProfileLink, makeProfileLink } = await import('@/lib/profile/actions')
const { loadLinkedProfile, loadMyLink } = await import('@/lib/profile/link')
const { profilePdf } = await import('@/lib/profile/pdf')
const { GET: pdfRoute } = await import('@/app/(signed-in)/app/me/pdf/route')

const TOKEN = 'abcDEF0123456789_-xyzQ'
const domain = (key: string, name: string, band: 'lower' | 'middle' | 'higher', position = 0.5) => ({ key, kind: 'domain' as const, domain: key, name, band, position })
const facet = (key: string, d: string, name: string) => ({ key, kind: 'facet' as const, domain: d, name, band: 'middle' as const, position: 0.4 })
const mine = {
  test: { key: 'full' as const, version: 1, name: 'IPIP-NEO-120', items: 120 },
  takenAt: '2026-10-16T08:00:00Z',
  domains: [domain('O', 'Openness to experience', 'higher', 0.8), domain('C', 'Conscientiousness', 'middle'), domain('E', 'Extraversion', 'lower', 0.1)],
  facets: [facet('O1', 'O', 'Imagination'), facet('C1', 'C', 'Self-efficacy')],
}

beforeEach(() => {
  rpc.mockReset()
  anonRpc.mockReset()
  vi.mocked(profilePdf).mockClear()
  user.value = { id: '0b000000-0000-4000-8000-0000000000aa' }
  profile.value = mine
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the boundary', () => {
  it('a token is 22 base64url characters, and a link shows domains or domains and facets, never "nothing"', () => {
    expect(linkTokenSchema.safeParse(TOKEN).success).toBe(true)
    for (const bad of ['', TOKEN.slice(1), `${TOKEN}A`, 'abcDEF0123456789+/xyzQ', `${TOKEN.slice(0, 21)} `]) expect(linkTokenSchema.safeParse(bad).success).toBe(false)
    expect(makeLinkSchema.safeParse({ level: 'domains' }).success).toBe(true)
    expect(makeLinkSchema.safeParse({ level: 'facets' }).success).toBe(true)
    expect(makeLinkSchema.safeParse({ level: 'nothing' }).success).toBe(false)
  })
})

describe('the actions', () => {
  it('make sends the level and returns the token once; a level it does not know never reaches the database', async () => {
    rpc.mockResolvedValue({ data: { ok: true, token: TOKEN }, error: null })
    expect(await makeProfileLink({ level: 'facets' })).toEqual({ ok: true, token: TOKEN })
    expect(rpc).toHaveBeenCalledWith('make_profile_link', { p_level: 'facets' })
    rpc.mockClear()
    expect(await makeProfileLink({ level: 'everything' })).toEqual({ ok: false, reason: 'invalid' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("make's refusals read as such, and an odd reply or an error as failed", async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'no_profile' }, error: null })
    expect(await makeProfileLink({ level: 'domains' })).toEqual({ ok: false, reason: 'no_profile' })
    rpc.mockResolvedValue({ data: { ok: true, token: 'short' }, error: null })
    expect(await makeProfileLink({ level: 'domains' })).toEqual({ ok: false, reason: 'failed' })
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
    expect(await makeProfileLink({ level: 'domains' })).toEqual({ ok: false, reason: 'failed' })
  })

  it('turning off calls its function, and the token is never logged', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
    expect(await endProfileLink()).toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('end_profile_link', {})
    rpc.mockResolvedValue({ data: { ok: true, token: TOKEN }, error: { code: 'XX000', message: 'boom' } })
    await makeProfileLink({ level: 'domains' })
    for (const call of vi.mocked(console.error).mock.calls) expect(call.join(' ')).not.toContain(TOKEN)
  })
})

describe('what the link reads', () => {
  it("Me reads on with its level and day, or off; a failed read is null, never off", async () => {
    rpc.mockResolvedValue({ data: { ok: true, on: true, level: 'domains', made_at: '2026-10-16T08:00:00Z' }, error: null })
    expect(await loadMyLink()).toEqual({ on: true, level: 'domains', madeAt: '2026-10-16T08:00:00Z' })
    rpc.mockResolvedValue({ data: { ok: true, on: false }, error: null })
    expect(await loadMyLink()).toEqual({ on: false })
    rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'down' } })
    expect(await loadMyLink()).toBeNull()
  })

  it('a malformed token is not asked for; the profile splits into domains and facets; an ended link reads not_found', async () => {
    expect(await loadLinkedProfile('nope')).toBe('not_found')
    expect(anonRpc).not.toHaveBeenCalled()
    anonRpc.mockResolvedValue({
      data: {
        ok: true, name: 'Sofie Lie', test: 'full', test_name: 'IPIP-NEO-120', items: 120, taken_on: '2026-10-16', level: 'facets',
        traits: [{ key: 'O', kind: 'domain', domain: 'O', name: 'Openness to experience', band: 'higher' }, { key: 'O1', kind: 'facet', domain: 'O', name: 'Imagination', band: 'middle' }],
      },
      error: null,
    })
    const read = await loadLinkedProfile(TOKEN)
    expect(anonRpc).toHaveBeenCalledWith('get_linked_profile', { p_token: TOKEN })
    expect(read).toMatchObject({ name: 'Sofie Lie', items: 120, level: 'facets', domains: [{ key: 'O', band: 'higher' }], facets: [{ key: 'O1', band: 'middle' }] })
    anonRpc.mockResolvedValue({ data: { ok: false, reason: 'not_found' }, error: null })
    expect(await loadLinkedProfile(TOKEN)).toBe('not_found')
    anonRpc.mockResolvedValue({ data: { ok: true, name: 'Sofie Lie', test: 'full', traits: [] }, error: null })
    expect(await loadLinkedProfile(TOKEN)).toBeNull()
  })
})

describe('the PDF', () => {
  const at = (query = '') => pdfRoute(new Request(`https://app.example/app/me/pdf${query}`))

  it('is the owner own profile, as a file, never cached, at the level chosen', async () => {
    const res = await at('?level=facets')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="leader-profile.pdf"')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(bytes.subarray(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getTitle()).toBe('Leader Profile: Sofie Lie')
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    const input = vi.mocked(profilePdf).mock.calls[0]![0]
    expect(input.facets.map((f) => f.key)).toEqual(['O1', 'C1'])
    expect(input.meta).toBe('Full test · IPIP-NEO-120 · 120 questions · taken 16 October 2026')
    expect(input.words.notes).toContain('Research-based, not yet validated')
  })

  it('holds bands only: never a position, at domains no facets', async () => {
    await at()
    const input = vi.mocked(profilePdf).mock.calls[0]![0]
    expect(input.facets).toEqual([])
    for (const t of input.domains) expect(Object.keys(t).sort()).toEqual(['band', 'domain', 'key', 'name'])
    expect(JSON.stringify(input)).not.toContain('position')
  })

  it('signed out 401, an unknown level 400, no profile 404, an unreadable one 503', async () => {
    user.value = null
    expect((await at()).status).toBe(401)
    user.value = { id: '0b000000-0000-4000-8000-0000000000aa' }
    expect((await at('?level=nothing')).status).toBe(400)
    profile.value = 'none'
    expect((await at()).status).toBe(404)
    profile.value = null
    expect((await at()).status).toBe(503)
    expect(profilePdf).not.toHaveBeenCalled()
  })
})

describe('the link page is never counted', () => {
  it('its path is among those the beacon never sends', () => {
    expect(NEVER.test(`/p/${TOKEN}`)).toBe(true)
    expect(mayCount('www.leaderpact.com', `/p/${TOKEN}`, false)).toBe(false)
    expect(mayCount('www.leaderpact.com', '/platform', false)).toBe(true)
  })
})
