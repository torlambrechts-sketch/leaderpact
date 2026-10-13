import 'server-only'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { anonClient } from '@/lib/supabase/anon'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed, readFailed } from '@/lib/supabase/read'
import { loadMyGroups } from '@/lib/groups/load'
import { bandSetRowSchema, buildTest, itemRowSchema, testRowSchema, toBandSet, traitRowSchema } from '@/lib/profile/model'
import { band, position, type Band, type BandSet, type ProfileTest } from '@/lib/profile/score'

/**
 * What the Leader Profile's pages read (handoff 6.17; 0011).
 *
 * - **The published tests and the band sets**, as a visitor reads them (the anon client), cached for ten
 *   minutes: they change only by a migration. A failure is thrown inside the cache and caught outside it.
 * - **The person's own profile and shares**, through row-level security: only its owner can select them.
 * - **A group's people**, through `get_group_profiles`: each profile only at the level shared with the group.
 *
 * Parsed, never cast. A failed read is null, which the page shows as a failure, never as "no profile".
 */
export type TestKey = 'quick' | 'full'

async function fetchTest(key: TestKey): Promise<ProfileTest> {
  const client = anonClient()
  if (!client) throw new Error('no Supabase configuration')
  const db = client.schema('app')
  const tests = await db.from('profile_test').select('id, key, version, name').eq('key', key).eq('status', 'published').limit(1)
  if (readFailed('loadProfileTest.test', tests.error, tests.data)) throw new Error('read failed')
  const test = z.array(testRowSchema).safeParse(tests.data)
  if (parseFailed('loadProfileTest.test', test)) throw new Error('parse failed')
  const row = test.data[0]
  if (!row) throw new Error('no published test')
  const [traits, items] = await Promise.all([
    db.from('profile_trait').select('key, kind, domain, name, ordinal').eq('test_id', row.id),
    db.from('profile_item').select('id, ordinal, text, trait, keyed').eq('test_id', row.id).order('ordinal'),
  ])
  if (readFailed('loadProfileTest.traits', traits.error, traits.data) || readFailed('loadProfileTest.items', items.error, items.data)) throw new Error('read failed')
  const t = z.array(traitRowSchema).safeParse(traits.data)
  const i = z.array(itemRowSchema).safeParse(items.data)
  if (parseFailed('loadProfileTest.traits', t) || parseFailed('loadProfileTest.items', i)) throw new Error('parse failed')
  const built = buildTest(row, t.data, i.data)
  if ('problem' in built) {
    console.error(`[read] loadProfileTest: ${built.problem}`)
    throw new Error('not a test')
  }
  return built
}

async function fetchBandSets(): Promise<BandSet[]> {
  const client = anonClient()
  if (!client) throw new Error('no Supabase configuration')
  const { data, error } = await client.schema('app').from('profile_band_set').select('version, lower_below, higher_above').order('version')
  if (readFailed('loadBandSets', error, data)) throw new Error('read failed')
  const rows = z.array(bandSetRowSchema).safeParse(data)
  if (parseFailed('loadBandSets', rows)) throw new Error('parse failed')
  return rows.data.map(toBandSet)
}

const cachedTest = unstable_cache((key: TestKey) => fetchTest(key), ['profile:test'], { revalidate: 600 })
const cachedBandSets = unstable_cache(() => fetchBandSets(), ['profile:bands'], { revalidate: 600 })

const quiet = (error: unknown, where: string): null => {
  if (error instanceof Error && !/^(read|parse) failed$|^not a test$|^no published test$/.test(error.message)) console.error(`[read] ${where}: ${error.message}`)
  return null
}

/** A published test, or null when it cannot be read; the page then says the test is not available */
export async function loadProfileTest(key: TestKey): Promise<ProfileTest | null> {
  try {
    return await cachedTest(key)
  } catch (error) {
    return quiet(error, 'loadProfileTest')
  }
}

/** The band set in force, the latest version: the one a new profile is made with */
export async function loadBandSet(): Promise<BandSet | null> {
  try {
    return (await cachedBandSets()).at(-1) ?? null
  } catch (error) {
    return quiet(error, 'loadBandSet')
  }
}

export interface TraitResult {
  key: string
  kind: 'domain' | 'facet'
  domain: string
  name: string
  band: Band
  /** 0 to 1 on the answer scale: where the dot sits */
  position: number
}

export interface MyProfile {
  test: { key: TestKey; version: number; name: string; items: number }
  takenAt: string
  domains: TraitResult[]
  facets: TraitResult[]
}

export interface MyShare {
  group: { id: string; name: string }
  level: 'nothing' | 'domains' | 'facets'
}

const profileRow = z.object({
  test_id: z.uuid(),
  band_set: z.number().int().positive(),
  taken_at: z.string().min(1),
  scores: z.record(z.string(), z.object({ sum: z.number().int().positive(), n: z.number().int().positive() })),
})

/** The traits of a profile with their bands, domains first, in the test's order */
export function profileTraits(test: ProfileTest, scores: Record<string, { sum: number; n: number }>, set: BandSet): TraitResult[] | null {
  const out: TraitResult[] = []
  for (const t of test.traits) {
    const s = scores[t.key]
    if (!s) return null
    out.push({ key: t.key, kind: t.kind, domain: t.domain, name: t.name, band: band(s.sum, s.n, set), position: position(s.sum, s.n) })
  }
  return out
}

/** The person's profile, 'none' when they have none, or null when it cannot be read */
export async function loadMyProfile(personId: string): Promise<MyProfile | 'none' | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').from('personality_profile').select('test_id, band_set, taken_at, scores').eq('person_id', personId).maybeSingle()
  if (error) {
    callFailed('loadMyProfile', error)
    return null
  }
  if (data === null) return 'none'
  const row = profileRow.safeParse(data)
  if (parseFailed('loadMyProfile', row)) return null
  // the test the profile was made with: a published or retired version, read by its id
  const tests = await supabase.schema('app').from('profile_test').select('id, key, version, name').eq('id', row.data.test_id).limit(1)
  const test = z.array(testRowSchema).safeParse(tests.data)
  if (tests.error || parseFailed('loadMyProfile.test', test) || !test.data[0]) return null
  const [full, sets] = await Promise.all([fetchTestById(test.data[0]), cachedBandSets().catch(() => null)])
  const set = sets?.find((s) => s.version === row.data.band_set)
  if (!full || !set) return null
  const traits = profileTraits(full, row.data.scores, set)
  if (!traits) {
    console.error('[read] loadMyProfile: a trait has no score')
    return null
  }
  return {
    test: { key: full.key, version: full.version, name: full.name, items: full.items.length },
    takenAt: row.data.taken_at,
    domains: traits.filter((t) => t.kind === 'domain'),
    facets: traits.filter((t) => t.kind === 'facet'),
  }
}

async function fetchTestById(row: z.infer<typeof testRowSchema>): Promise<ProfileTest | null> {
  const published = await loadProfileTest(row.key)
  if (published?.id === row.id) return published
  // a retired version: read directly, uncached
  try {
    const client = anonClient()
    if (!client) return null
    const db = client.schema('app')
    const [traits, items] = await Promise.all([
      db.from('profile_trait').select('key, kind, domain, name, ordinal').eq('test_id', row.id),
      db.from('profile_item').select('id, ordinal, text, trait, keyed').eq('test_id', row.id).order('ordinal'),
    ])
    const t = z.array(traitRowSchema).safeParse(traits.data)
    const i = z.array(itemRowSchema).safeParse(items.data)
    if (!t.success || !i.success) return null
    const built = buildTest(row, t.data, i.data)
    return 'problem' in built ? null : built
  } catch {
    return null
  }
}

const shareRow = z.object({ team_id: z.uuid(), level: z.enum(['nothing', 'domains', 'facets']) })

/** What each of the person's groups may see of their profile: nothing unless they shared it */
export async function loadMyShares(personId: string): Promise<MyShare[] | null> {
  const groups = await loadMyGroups(personId)
  if (groups === null) return null
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').from('profile_share').select('team_id, level').eq('person_id', personId)
  if (readFailed('loadMyShares', error, data)) return null
  const rows = z.array(shareRow).safeParse(data)
  if (parseFailed('loadMyShares', rows)) return null
  const level = new Map(rows.data.map((r) => [r.team_id, r.level]))
  return groups.map((g) => ({ group: { id: g.id, name: g.name }, level: level.get(g.id) ?? 'nothing' }))
}

const groupProfileRow = z.object({
  person_id: z.uuid(),
  display_name: z.string().min(1),
  role: z.enum(['leader', 'member']),
  level: z.enum(['nothing', 'domains', 'facets']),
  test: z.enum(['quick', 'full']).nullable(),
  traits: z.array(z.object({ key: z.string(), kind: z.enum(['domain', 'facet']), domain: z.string(), name: z.string(), band: z.enum(['lower', 'middle', 'higher']) })).nullable(),
})
export type GroupPerson = z.infer<typeof groupProfileRow>

/** A group's current members, each with their profile at the level they share with it; null on failure */
export async function loadGroupProfiles(groupId: string): Promise<GroupPerson[] | null> {
  if (!z.uuid().safeParse(groupId).success) return null
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').rpc('get_group_profiles', { p_team: groupId })
  if (readFailed('loadGroupProfiles', error, data)) return null
  const rows = z.array(groupProfileRow).safeParse(data)
  if (parseFailed('loadGroupProfiles', rows)) return null
  return rows.data
}

/** The person's display name, read through row-level security (themselves); null when there is no row yet */
export async function loadPersonName(personId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').from('person').select('display_name').eq('id', personId).maybeSingle()
  if (error) {
    callFailed('loadPersonName', error)
    return null
  }
  const row = z.object({ display_name: z.string().min(1) }).safeParse(data)
  return row.success ? row.data.display_name : null
}
