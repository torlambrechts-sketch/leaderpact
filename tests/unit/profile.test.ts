import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { profileTestSchema, type ProfileTestData } from '@/lib/profile/schema'
import { band, firstUnanswered, isComplete, position, traitSums, type ProfileTest } from '@/lib/profile/score'
import { buildTest } from '@/lib/profile/model'
import { PENDING_KEY, draftKey, readDraft, readPending, writeDraft, writePending } from '@/lib/profile/device'
import { OUTPUT, readFiles, render, type ProfileFiles } from '@/scripts/seed/profile.mjs'

/**
 * The Leader Profile (handoff 6.17 and 9; D-31, D-32): the two tests as data, the committed 0012 is what
 * the generator makes, the device's scoring gives the same sums as `save_profile` (the cases of
 * supabase/tests/profile_invariants.sql), the bands follow D-31, and the device keeps drafts apart.
 */
const files = readFiles() as unknown as ProfileFiles
const V1 = { lowerBelow: 2.33, higherAbove: 3.67 }

/** A test as the device builds it, from a data file, with item ids made from the ordinal */
function asTest(data: ProfileTestData): ProfileTest {
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  return {
    id: id(data.key === 'quick' ? 9001 : 9002),
    key: data.key,
    version: data.version,
    name: data.name,
    traits: [
      ...data.domains.map((d) => ({ key: d.key, kind: 'domain' as const, domain: d.key, name: d.name, ordinal: d.ordinal })),
      ...data.facets.map((f) => ({ key: f.key, kind: 'facet' as const, domain: f.domain, name: f.name, ordinal: f.ordinal })),
    ],
    items: data.items.map((i) => ({ id: id(i.ordinal), ordinal: i.ordinal, text: i.text, trait: i.trait, keyed: i.keyed })),
  }
}
const all = (test: ProfileTest, value: number) => Object.fromEntries(test.items.map((i) => [i.id, value]))

describe('the two tests as data', () => {
  it('parse: the quick test 20 items in five domains, the full test 120 items in 30 facets', () => {
    expect(profileTestSchema.safeParse(files.quick).success).toBe(true)
    expect(profileTestSchema.safeParse(files.full).success).toBe(true)
    expect(files.quick.items).toHaveLength(20)
    expect(files.full.items).toHaveLength(120)
    expect(files.full.facets).toHaveLength(30)
  })

  it('name their sources, public domain, and were read from them, not written from memory', () => {
    expect(files.quick.source.items).toBe('https://ipip.ori.org/MiniIPIPKey.htm')
    expect(files.full.source.items).toBe('https://ipip.ori.org/30FacetNEO-PI-RItems.htm')
    for (const t of [files.quick, files.full]) expect(t.source.licence).toMatch(/^Public domain/)
  })

  it('keep the published wording: the first items of each, verbatim', () => {
    expect(files.full.items.slice(0, 3).map((i) => i.text)).toEqual(['Worry about things.', 'Make friends easily.', 'Have a vivid imagination.'])
    expect(files.quick.items[0]?.text).toBe('Am the life of the party.')
  })

  it('refuse a facet with three items, a quick test with facets, and a single key', () => {
    const broken = structuredClone(files.full)
    broken.items[0]!.trait = 'E1'
    expect(profileTestSchema.safeParse(broken).success).toBe(false)
    expect(profileTestSchema.safeParse({ ...files.quick, facets: files.full.facets.slice(0, 1) }).success).toBe(false)
    expect(profileTestSchema.safeParse({ ...files.quick, items: files.quick.items.map((i) => ({ ...i, keyed: 1 })) }).success).toBe(false)
  })

  it('band set version 1 is equal thirds of the answer scale (D-31)', () => {
    expect(files.bands.find((b) => b.version === 1)).toMatchObject(V1)
  })

  it('the committed 0012 is exactly what scripts/seed/profile.mjs makes', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(render(files))
  })
})

describe('scoring on the device', () => {
  const full = asTest(files.full)
  const quick = asTest(files.quick)

  it('every answer 4 gives the sums save_profile gives (profile_invariants 6)', () => {
    const s = traitSums(full, all(full, 4))
    expect([s.O?.sum, s.C?.sum, s.E?.sum, s.A?.sum, s.N?.sum, s.O?.n]).toEqual([72, 70, 84, 62, 82, 24])
    expect([s.A2?.sum, s.N1?.sum, s.O4?.sum, s.C6?.sum, s.E5?.sum, s.E5?.n]).toEqual([8, 16, 10, 8, 16, 4])
    expect(Object.keys(s)).toHaveLength(35)
  })

  it('a minus-keyed answer counts as 6 minus the answer', () => {
    const s = traitSums(quick, all(quick, 5))
    // Intellect or imagination: one plus-keyed item, three minus-keyed
    expect(s.I).toEqual({ sum: 5 + 1 + 1 + 1, n: 4 })
    expect(s.E).toEqual({ sum: 5 + 5 + 1 + 1, n: 4 })
  })

  it('refuses a missing or impossible answer', () => {
    const answers = all(quick, 3)
    delete answers[quick.items[0]!.id]
    expect(() => traitSums(quick, answers)).toThrow(RangeError)
    expect(() => traitSums(quick, { ...all(quick, 3), [quick.items[0]!.id]: 6 })).toThrow(RangeError)
  })

  it('bands are thirds in hundredths: 55 of 24 lower, 56 and 88 middle, 89 higher (profile_invariants 7)', () => {
    expect([band(55, 24, V1), band(56, 24, V1), band(88, 24, V1), band(89, 24, V1)]).toEqual(['lower', 'middle', 'middle', 'higher'])
    expect([band(9, 4, V1), band(10, 4, V1), band(14, 4, V1), band(15, 4, V1)]).toEqual(['lower', 'middle', 'middle', 'higher'])
    expect(() => band(3, 4, V1)).toThrow(RangeError)
  })

  it('places the dot from 0 to 1 on the answer scale', () => {
    expect([position(4, 4), position(12, 4), position(20, 4)]).toEqual([0, 0.5, 1])
  })

  it('knows a complete set and the first question left', () => {
    const answers = all(quick, 3)
    expect(isComplete(quick, answers)).toBe(true)
    delete answers[quick.items[4]!.id]
    expect(isComplete(quick, answers)).toBe(false)
    expect(firstUnanswered(quick, answers)).toBe(4)
  })

  it('builds a test from rows, and refuses one whose items do not run 1 to n', () => {
    const row = { id: quick.id, key: 'quick' as const, version: 1, name: 'Mini-IPIP' }
    const traits = files.quick.domains.map((d) => ({ key: d.key, kind: 'domain' as const, domain: d.key, name: { en: d.name }, ordinal: d.ordinal }))
    const items = quick.items.map((i) => ({ id: i.id, ordinal: i.ordinal, text: { en: i.text }, trait: i.trait, keyed: i.keyed }))
    expect('problem' in buildTest(row, traits, items)).toBe(false)
    expect(buildTest(row, traits, items.slice(1))).toHaveProperty('problem')
  })
})

describe('the device', () => {
  const quick = asTest(files.quick)
  const store = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
  }
  const now = new Date('2026-10-13T12:00:00Z')

  it('keeps a draft per test, under keys of its own, never the scan\'s', () => {
    expect(draftKey('quick')).toBe('leaderpact.profile.draft.quick')
    expect(PENDING_KEY.startsWith('leaderpact.profile.')).toBe(true)
    const s = store()
    writeDraft(s, quick, { answers: { [quick.items[0]!.id]: 4 }, position: 1 }, now)
    expect(readDraft(s, quick, now)).toEqual({ answers: { [quick.items[0]!.id]: 4 }, position: 1 })
    expect([...s.m.keys()]).toEqual(['leaderpact.profile.draft.quick'])
  })

  it('drops a draft for another version, or older than 30 days', () => {
    const s = store()
    writeDraft(s, quick, { answers: {}, position: 0 }, now)
    expect(readDraft(s, { ...quick, id: '00000000-0000-4000-8000-000000009999' }, now)).toBeNull()
    writeDraft(s, quick, { answers: {}, position: 0 }, now)
    expect(readDraft(s, quick, new Date(now.getTime() + 31 * 86_400_000))).toBeNull()
  })

  it('keeps a finished test for sign-in for 7 days', () => {
    const s = store()
    writePending(s, { test: 'quick', version: quick.id, answers: { [quick.items[0]!.id]: 2 } }, now)
    expect(readPending(s, now)?.test).toBe('quick')
    expect(readPending(s, new Date(now.getTime() + 8 * 86_400_000))).toBeNull()
  })
})
