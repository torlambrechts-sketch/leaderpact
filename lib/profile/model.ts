import { z } from 'zod'
import type { BandSet, ProfileItem, ProfileTest, ProfileTrait } from '@/lib/profile/score'

/**
 * The Leader Profile's tests as the device needs them (handoff 6.17), from the rows 0012 wrote: a visitor
 * reads the published tests with no account (0011). Parsed, never cast; wording from the rows, never from
 * `messages/` (CLAUDE.md, Model as data). English is the only locale, so the `en` text is taken.
 */
const text = z.object({ en: z.string().trim().min(1) })

export const testRowSchema = z.object({
  id: z.uuid(),
  key: z.enum(['quick', 'full']),
  version: z.number().int().positive(),
  name: z.string().min(1),
})
export const traitRowSchema = z.object({
  key: z.string().regex(/^[A-Z][1-6]?$/),
  kind: z.enum(['domain', 'facet']),
  domain: z.string().regex(/^[A-Z]$/),
  name: text,
  ordinal: z.number().int().positive(),
})
export const itemRowSchema = z.object({
  id: z.uuid(),
  ordinal: z.number().int().positive(),
  text,
  trait: z.string().regex(/^[A-Z][1-6]?$/),
  keyed: z.union([z.literal(1), z.literal(-1)]),
})
export const bandSetRowSchema = z.object({
  version: z.number().int().positive(),
  lower_below: z.coerce.number(),
  higher_above: z.coerce.number(),
})

export const toBandSet = (row: z.infer<typeof bandSetRowSchema>): BandSet => ({ version: row.version, lowerBelow: row.lower_below, higherAbove: row.higher_above })

/** A test from its rows, or the reason it cannot be one: items 1 to n, each scoring a trait of the test */
export function buildTest(
  test: z.infer<typeof testRowSchema>,
  traitRows: readonly z.infer<typeof traitRowSchema>[],
  itemRows: readonly z.infer<typeof itemRowSchema>[],
): ProfileTest | { problem: string } {
  if (itemRows.length === 0 || traitRows.length === 0) return { problem: 'the published test has no items' }
  const traits: ProfileTrait[] = [...traitRows]
    .sort((a, b) => (a.kind === b.kind ? a.ordinal - b.ordinal : a.kind === 'domain' ? -1 : 1))
    .map((t) => ({ key: t.key, kind: t.kind, domain: t.domain, name: t.name.en, ordinal: t.ordinal }))
  const keys = new Set(traits.map((t) => t.key))
  const items: ProfileItem[] = [...itemRows].sort((a, b) => a.ordinal - b.ordinal).map((i) => ({ id: i.id, ordinal: i.ordinal, text: i.text.en, trait: i.trait, keyed: i.keyed }))
  if (items.some((item, i) => item.ordinal !== i + 1)) return { problem: 'the items are not numbered 1 to n' }
  if (items.some((item) => !keys.has(item.trait))) return { problem: 'an item scores no trait of the test' }
  return { id: test.id, key: test.key, version: test.version, name: test.name, traits, items }
}
