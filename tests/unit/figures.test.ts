import { describe, expect, it } from 'vitest'
import { articleProblems, ArticleContent } from '@/lib/site/article-content'
import { ART_KINDS, PUBLISHED } from '@/lib/site/articles'
import { ARTICLE_FILES } from '@/lib/site/article-load'
import { Block, blockProblems, blockText, FIGURES, isFigure, shortCite, type Source } from '@/lib/site/blocks'
import { loadPage, PRODUCT_PAGES, type ProductPageKey } from '@/lib/site/pages'
import { TEMPLATE_FILES, loadTemplate } from '@/lib/site/template-load'

/**
 * The figures and drawings (D-41): an article draws its argument, every figure keeps the copy rules, every number
 * says where it comes from, and every cited source is in the article's own list.
 */
const source = (authors: string, year = 2001): Source => ({ authors, year, title: 'A title', venue: 'A venue', url: 'https://doi.org/10.1/x' })

describe('the drawings', () => {
  it('give every published article one of the known drawings', () => {
    for (const a of PUBLISHED) expect(ART_KINDS, a.slug).toContain(a.art)
  })

  it('are not all the same: each article has its own', () => {
    const arts = PUBLISHED.map((a) => a.art)
    expect(new Set(arts).size).toBe(arts.length)
  })
})

describe('the figures', () => {
  it.each(PUBLISHED.map((a) => a.slug))('%s draws at least two, and cites only sources in its list', (slug) => {
    const a = ArticleContent.parse(ARTICLE_FILES[slug])
    expect(a.blocks.filter(isFigure).length).toBeGreaterThanOrEqual(2)
    for (const b of a.blocks) expect(blockProblems(b, a.sources.length)).toEqual([])
  })

  it('cite as the text does: one author, two joined by "and", three or more as "et al."', () => {
    expect(shortCite(source('Edmondson, A.', 1999))).toBe('Edmondson (1999)')
    expect(shortCite(source('Simons, T. L., & Peterson, R. S.', 2000))).toBe('Simons and Peterson (2000)')
    expect(shortCite(source('De Jong, B. A., Dirks, K. T., & Gillespie, N.', 2016))).toBe('De Jong et al. (2016)')
    expect(shortCite(source('re:Work Editorial Team', 2015))).toBe('re:Work Editorial Team (2015)')
  })

  it('never draw a number without saying where it comes from', () => {
    const bars = { t: 'bars', title: 'Pairs of members', items: [{ label: 'Four', value: 6 }, { label: 'Eight', value: 28 }] }
    expect(Block.safeParse(bars).success).toBe(false)
    expect(Block.safeParse({ ...bars, basis: { arithmetic: 'A team of n has n × (n − 1) ÷ 2 pairs.' } }).success).toBe(true)
    expect(Block.safeParse({ ...bars, basis: { source: 2 } }).success).toBe(true)
    expect(Block.safeParse({ ...bars, basis: { example: true } }).success).toBe(true)
    // a figure is a number as a reader writes it, never a phrase that hides one
    const stats = (value: string) => Block.safeParse({ t: 'stats', items: [{ value, label: 'teams', source: 1 }, { value: '12', label: 'studies', source: 1 }] }).success
    for (const ok of ['7,763', '22,000+', '74%', '<10%', '0.7']) expect(stats(ok), ok).toBe(true)
    for (const bad of ['about 100', 'many', '', '10 per cent']) expect(stats(bad), bad).toBe(false)
  })

  it('refuse a citation the list does not hold, a kind the time bar does not name and a share over 100', () => {
    const one = [source('Edmondson, A.')]
    expect(blockProblems(Block.parse({ t: 'stats', items: [{ value: '51', label: 'teams', source: 1 }, { value: '5', label: 'units', source: 2 }] }), one.length)).toEqual([
      'stats cites source 2; the list has 1',
    ])
    expect(blockProblems(Block.parse({ t: 'flow', items: [{ title: 'A', text: 'B.' }, { title: 'C', text: 'D.' }, { title: 'E', text: 'F.' }], source: 1 }), 0)).toHaveLength(1)
    const timebar = Block.parse({ t: 'timebar', title: 'An agenda', kinds: ['Information'], items: [{ label: 'Opening', minutes: 5, kind: 0 }, { label: 'Decision', minutes: 30, kind: 2 }], basis: { example: true } })
    expect(blockProblems(timebar, 0)).toHaveLength(1)
    const share = Block.parse({ t: 'bars', title: 'Who said so', items: [{ label: 'A', value: 140 }, { label: 'B', value: 20 }], percent: true, basis: { example: true } })
    expect(blockProblems(share, 0)).toHaveLength(1)
  })

  it('keep the copy rules in every word they show, and count it in the reading time', () => {
    const long = 'This sentence has far too many words in it for a reader to follow it easily on a phone screen while walking to a meeting.'
    expect(Block.safeParse({ t: 'matrix', x: { label: 'Safety', low: 'Low', high: 'High' }, y: { label: 'Standards', low: 'Low', high: 'High' }, cells: [
      { title: 'A', text: long }, { title: 'B', text: 'Two.' }, { title: 'C', text: 'Three.' }, { title: 'D', text: 'Four.' },
    ] }).success).toBe(false)
    expect(Block.safeParse({ t: 'steps', items: [{ title: 'A proven method' }, { title: 'Two' }, { title: 'Three' }] }).success).toBe(false)
    expect(Block.safeParse({ t: 'steps', items: [{ title: 'Read [this](https://example.com)' }, { title: 'Two' }, { title: 'Three' }] }).success).toBe(false)
    const fork = Block.parse({ t: 'fork', from: { title: 'A disagreement', text: 'About the work.' }, items: [
      { when: 'When trust is high', title: 'It stays on the work', text: 'Debate helps.' },
      { when: 'When trust is low', title: 'It turns personal', text: 'Debate hurts.' },
    ] })
    expect(blockText([fork])).toEqual(['A disagreement', 'About the work.', 'When trust is high', 'It stays on the work', 'Debate helps.', 'When trust is low', 'It turns personal', 'Debate hurts.'])
  })

  it('count as figures only the drawn kinds', () => {
    expect(FIGURES).not.toContain('p')
    expect(FIGURES).not.toContain('table')
    expect(isFigure(Block.parse({ t: 'p', text: 'Plain text.' }))).toBe(false)
  })

  it('refuse an article with fewer than two', () => {
    const a = ArticleContent.parse(ARTICLE_FILES['leadership-team-purpose'])
    const flat = { ...a, blocks: a.blocks.filter((b) => !isFigure(b)) }
    expect(articleProblems('leadership-team-purpose', flat).join(' ')).toMatch(/0 figures; draw at least 2/)
  })

  it('cite nothing on a page that has no list of sources', () => {
    for (const key of Object.keys(PRODUCT_PAGES) as ProductPageKey[]) {
      for (const b of loadPage(key).blocks) expect(blockProblems(b, 0), key).toEqual([])
    }
    for (const slug of Object.keys(TEMPLATE_FILES)) {
      for (const b of loadTemplate(slug)?.content.blocks ?? []) expect(blockProblems(b, 0), slug).toEqual([])
    }
  })
})
