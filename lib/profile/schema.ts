import { z } from 'zod'

/**
 * The Leader Profile's two tests as data (handoff 6.17 and 9): data/profile/quick.v1.json, the Mini-IPIP,
 * and data/profile/full.v1.json, the IPIP-NEO-120. Both were parsed from the public-domain sources section
 * 9 names, never written from memory, and scripts/seed/profile.mjs turns them into the rows of 0012.
 *
 * 1. **The quick test**: 20 items, five domains of four items each, no facets.
 * 2. **The full test**: 120 items, five domains of six facets each, every facet four items.
 * 3. **Keys are +1 or −1**, as published. Every test has both.
 * 4. **Item wording is the source's, verbatim**, so it is not held to the product's copy rules: a published
 *    item keeps its American spelling ("Sympathize"), and its sentences are fragments by design (D-32).
 *
 * Every rule fails loudly, with the path of what broke it.
 */
const Text = z.string().min(1).refine((t) => t === t.trim() && !/\s{2,}/.test(t), 'stray whitespace')
const DomainKey = z.string().regex(/^[A-Z]$/)
const FacetKey = z.string().regex(/^[A-Z][1-6]$/)

export const profileTestSchema = z
  .object({
    key: z.enum(['quick', 'full']),
    version: z.number().int().positive(),
    name: Text,
    source: z.object({
      items: z.url(),
      citation: Text,
      licence: Text,
      retrieved: z.iso.date(),
      domains: z.url().optional(),
      order: Text,
    }),
    domains: z.array(z.object({ key: DomainKey, name: Text, ordinal: z.number().int().positive() })).length(5),
    facets: z.array(z.object({ key: FacetKey, domain: DomainKey, name: Text, ordinal: z.number().int().positive() })),
    items: z.array(z.object({ ordinal: z.number().int().positive(), text: Text, trait: z.string().regex(/^[A-Z][1-6]?$/), keyed: z.union([z.literal(1), z.literal(-1)]) })),
  })
  .superRefine((t, ctx) => {
    const fail = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', message, path })
    const domains = new Set(t.domains.map((d) => d.key))
    if (domains.size !== 5) fail('five distinct domains', ['domains'])
    t.items.forEach((item, i) => item.ordinal !== i + 1 && fail('items are numbered 1 to n in order', ['items', i, 'ordinal']))
    if (new Set(t.items.map((i) => i.text)).size !== t.items.length) fail('an item is asked twice', ['items'])
    const keyed = new Set(t.items.map((i) => i.keyed))
    if (keyed.size !== 2) fail('both plus- and minus-keyed items', ['items'])

    const count = (trait: string) => t.items.filter((i) => i.trait === trait).length
    if (t.key === 'quick') {
      if (t.facets.length) fail('the quick test has no facets', ['facets'])
      if (t.items.length !== 20) fail('the quick test has 20 items', ['items'])
      for (const d of t.domains) if (count(d.key) !== 4) fail(`domain ${d.key} has four items`, ['items'])
      for (const i of t.items) if (!domains.has(i.trait)) fail(`item ${i.ordinal} scores no domain`, ['items'])
    } else {
      if (t.facets.length !== 30) fail('the full test has 30 facets', ['facets'])
      if (t.items.length !== 120) fail('the full test has 120 items', ['items'])
      const facets = new Set(t.facets.map((f) => f.key))
      for (const f of t.facets) {
        if (!domains.has(f.domain) || f.key[0] !== f.domain) fail(`facet ${f.key} belongs to its domain`, ['facets'])
        if (count(f.key) !== 4) fail(`facet ${f.key} has four items`, ['items'])
      }
      for (const d of t.domains) if (t.facets.filter((f) => f.domain === d.key).length !== 6) fail(`domain ${d.key} has six facets`, ['facets'])
      for (const i of t.items) if (!facets.has(i.trait)) fail(`item ${i.ordinal} scores no facet`, ['items'])
    }
  })

export type ProfileTestData = z.infer<typeof profileTestSchema>
