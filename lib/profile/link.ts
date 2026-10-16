import 'server-only'
import { z } from 'zod'
import { anonClient } from '@/lib/supabase/anon'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import type { Band } from '@/lib/profile/score'
import { linkLevelSchema, linkTokenSchema, type LinkLevel } from '@/lib/profile/link-io'

/**
 * A private link to a Leader Profile (D-66; 0031): what Me reads of the owner's own link, and what the link's page
 * reads for whoever holds it. The link's token never comes back from the database: Me knows only whether a link is
 * on, its level and its day. Parsed, never cast; a failed read is null, never "no link".
 */
export interface MyLink {
  on: boolean
  level?: LinkLevel
  madeAt?: string
}

export interface LinkedTrait {
  key: string
  domain: string
  name: string
  band: Band
}

export interface LinkedProfile {
  name: string
  test: 'quick' | 'full'
  testName: string
  items: number
  takenOn: string
  level: LinkLevel
  domains: LinkedTrait[]
  facets: LinkedTrait[]
}

const myLinkReply = z.union([
  z.object({ ok: z.literal(true), on: z.literal(true), level: linkLevelSchema, made_at: z.string().min(1) }),
  z.object({ ok: z.literal(true), on: z.literal(false) }),
  z.object({ ok: z.literal(false), reason: z.string() }),
])

const band = z.enum(['lower', 'middle', 'higher'])
const linkedReply = z.union([
  z.object({
    ok: z.literal(true),
    name: z.string().min(1),
    test: z.enum(['quick', 'full']),
    test_name: z.string().min(1),
    items: z.number().int().positive(),
    taken_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    level: linkLevelSchema,
    traits: z.array(z.object({ key: z.string().min(1), kind: z.enum(['domain', 'facet']), domain: z.string().min(1), name: z.string().min(1), band })).min(1),
  }),
  z.object({ ok: z.literal(false), reason: z.string() }),
])

/** The signed-in person's link: on or off, with its level and day; null when it cannot be read */
export async function loadMyLink(): Promise<MyLink | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').rpc('get_profile_link')
  if (callFailed('loadMyLink', error)) return null
  const reply = myLinkReply.safeParse(data)
  if (parseFailed('loadMyLink', reply) || !reply.data.ok) return null
  return reply.data.on ? { on: true, level: reply.data.level, madeAt: reply.data.made_at } : { on: false }
}

/**
 * What the link shows, read as a visitor (the anon client: no session goes with it): 'not_found' for a token that
 * is malformed, unknown or ended, which read alike; null when it cannot be read.
 */
export async function loadLinkedProfile(token: string): Promise<LinkedProfile | 'not_found' | null> {
  if (!linkTokenSchema.safeParse(token).success) return 'not_found'
  const client = anonClient()
  if (!client) return null
  const { data, error } = await client.schema('app').rpc('get_linked_profile', { p_token: token })
  if (callFailed('loadLinkedProfile', error)) return null
  const reply = linkedReply.safeParse(data)
  if (parseFailed('loadLinkedProfile', reply)) return null
  if (!reply.data.ok) return 'not_found'
  const traits = reply.data.traits.map(({ key, kind, domain, name, band: b }) => ({ key, kind, domain, name, band: b }))
  return {
    name: reply.data.name,
    test: reply.data.test,
    testName: reply.data.test_name,
    items: reply.data.items,
    takenOn: reply.data.taken_on,
    level: reply.data.level,
    domains: traits.filter((t) => t.kind === 'domain').map(({ kind: _kind, ...t }) => t),
    facets: traits.filter((t) => t.kind === 'facet').map(({ kind: _kind, ...t }) => t),
  }
}
