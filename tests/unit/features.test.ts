import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { blockProblems, blockText, linksIn, plain } from '@/lib/site/blocks'
import { PUBLISHED, articlePath } from '@/lib/site/articles'
import { allFeatures, FEATURES, featurePath } from '@/lib/site/features'
import { SHOTS } from '@/lib/site/shots'

/**
 * The platform's feature pages (D-46): one per feature built today, each with screenshots of the real app, what
 * it brings to the person, the group and the organisation, and nothing that sells.
 */
const features = allFeatures()
const PAGES = new Set(['/', '/research', '/anonymity', '/platform', ...FEATURES.map((f) => featurePath(f.slug)), ...PUBLISHED.map((a) => articlePath(a.slug))])

describe('the feature pages', () => {
  it('are registered once each, in the loop’s order', () => {
    const slugs = FEATURES.map((f) => f.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).toEqual(['leadership-team-scan', 'team-view', 'leader-profile', 'team-charter', 'full-diagnostic'])
  })

  it.each(features.map((f) => [f.entry.slug, f] as const))('%s carries its search in its title, and fits the results page', (_, f) => {
    expect(f.content.title.toLowerCase()).toContain(f.entry.queries[0])
    expect(f.content.title.length).toBeLessThanOrEqual(70)
    expect(f.content.description.length).toBeLessThanOrEqual(155)
    expect(JSON.stringify(f.content)).not.toContain('{product}')
  })

  it.each(features.map((f) => [f.entry.slug, f] as const))('%s shows the real app, and what it brings to the person, the group and the organisation', (_, f) => {
    const blocks = f.content.blocks
    const shots = blocks.flatMap((b) => (b.t === 'feature' ? [b.shot] : b.t === 'shot' ? [b.id] : []))
    expect(shots.length).toBeGreaterThanOrEqual(2)
    expect(blocks.filter((b) => b.t === 'value')).toHaveLength(1)
    for (const b of blocks) expect(blockProblems(b, 0), b.t).toEqual([])
    expect(f.content.faq?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  it.each(features.map((f) => [f.entry.slug, f] as const))('%s sells nothing and links only to pages that exist', (_, f) => {
    const text = [f.content.title, f.content.description, f.content.lead, ...blockText(f.content.blocks), ...(f.content.faq ?? []).flatMap((q) => [q.q, q.a])]
    for (const t of text) expect(plain(t), t).not.toMatch(/\$\s?\d|£\s?\d|€\s?\d|per seat|per year|a month|discount|buy now|upgrade|most chosen|sign up/i)
    for (const href of linksIn(text)) expect(PAGES, href).toContain(href.split('#')[0])
  })
})

describe('the screenshots', () => {
  it('each have their file, and are WebP pictures of a desktop or a phone', () => {
    for (const [id, s] of Object.entries(SHOTS)) {
      expect(existsSync(`public${s.file}`), id).toBe(true)
      expect(s.file).toBe(`/shots/${id}.webp`)
    }
  })

  it('are all used: no picture is shipped that no page shows', () => {
    const used = new Set(features.flatMap((f) => f.content.blocks.flatMap((b) => (b.t === 'feature' ? [b.shot] : b.t === 'shot' ? [b.id] : []))))
    expect([...used].sort()).toEqual(Object.keys(SHOTS).sort())
  })
})
