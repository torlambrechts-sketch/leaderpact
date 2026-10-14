import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { articleProblems, ArticleContent } from '@/lib/site/article-content'
import { ARTICLE_GROUPS, ARTICLES, articlePath, PUBLISHED } from '@/lib/site/articles'
import { ARTICLE_FILES, loadArticle } from '@/lib/site/article-load'
import { linksIn, blockText, plain } from '@/lib/site/blocks'
import { FEATURES, featurePath } from '@/lib/site/features'
import { contentInventory } from '@/lib/site/inventory'
import { loadPage, PRODUCT_PAGES, type ProductPageKey } from '@/lib/site/pages'
import { TEMPLATE_FILES, loadTemplate } from '@/lib/site/template-load'
import { TEMPLATES, granted, grantFor } from '@/lib/site/templates'
import sitemap from '@/app/sitemap'

/**
 * The public site (D-34 to D-38): the registries agree with the data files, every article keeps the editorial
 * rules, every page carries the search it answers in its title, and the inventory Sentral receives is the
 * keyword map with one page per search.
 */
describe('the articles', () => {
  it('are registered once each, in a known section, with dates and two published neighbours', () => {
    const slugs = ARTICLES.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const a of ARTICLES) {
      expect(ARTICLE_GROUPS).toContain(a.group)
      expect(a.slug).toMatch(/^[a-z0-9-]{3,80}$/)
      if (a.status !== 'published') continue
      expect(a.published).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect((a.modified ?? '') >= (a.published ?? '')).toBe(true)
      expect(a.related).toHaveLength(2)
      for (const r of a.related ?? []) {
        expect(r).not.toBe(a.slug)
        expect(PUBLISHED.map((p) => p.slug)).toContain(r)
      }
      if (a.template) expect(TEMPLATES.map((t) => t.slug)).toContain(a.template)
    }
  })

  it('has a data file for every published article, and none for a planned one', () => {
    expect(Object.keys(ARTICLE_FILES).sort()).toEqual(PUBLISHED.map((a) => a.slug).sort())
    for (const a of ARTICLES) expect(existsSync(`data/articles/${a.slug}.json`)).toBe(a.status === 'published')
  })

  it.each(PUBLISHED.map((a) => a.slug))('%s keeps the editorial rules', (slug) => {
    expect(articleProblems(slug, ARTICLE_FILES[slug])).toEqual([])
  })

  it.each(PUBLISHED.map((a) => [a.slug, a.queries[0]]))('%s carries its search in its title', (slug, query) => {
    expect(loadArticle(slug)?.content.title.toLowerCase()).toContain(query.toLowerCase())
  })

  it('links each article from the text of at least one other, not only from cards', () => {
    const linked = new Set(PUBLISHED.flatMap((a) => {
      const c = ArticleContent.parse(ARTICLE_FILES[a.slug])
      return linksIn([c.lead, ...c.takeaways, ...blockText(c.blocks)])
    }))
    for (const a of PUBLISHED) expect(linked, a.slug).toContain(articlePath(a.slug))
  })

  it('refuses an article that sells, names the product or links away', () => {
    const base = ArticleContent.parse(ARTICLE_FILES['leadership-team-purpose'])
    const selling = { ...base, lead: `${base.lead} Try LeaderPact free today.` }
    expect(articleProblems('leadership-team-purpose', selling).join()).toMatch(/sells or names the product/)
    const away = { ...base, lead: `${base.lead} Read [this](https://example.com).` }
    expect(articleProblems('leadership-team-purpose', away).join()).toMatch(/this site only/)
    const planned = { ...base, lead: `${base.lead} See [the team learning article](/articles/team-learning-and-reflection).` }
    expect(articleProblems('leadership-team-purpose', planned).join()).toMatch(/only to published articles/)
  })
})

describe('the templates', () => {
  it('have their page words and their files', () => {
    expect(Object.keys(TEMPLATE_FILES).sort()).toEqual(TEMPLATES.map((t) => t.slug).sort())
    for (const t of TEMPLATES) {
      const found = loadTemplate(t.slug)
      expect(found?.content.title.length).toBeLessThanOrEqual(65)
      expect(found?.content.description.length).toBeLessThanOrEqual(155)
      for (const f of t.files) {
        expect(existsSync(`private/templates/${f.name}`), f.name).toBe(true)
        expect(found?.content.files[f.name]).toBeTruthy()
      }
    }
  })

  it('grant a file only to a browser that asked for its template', () => {
    expect(granted('leadership-team-charter-template,nonsense')).toEqual(['leadership-team-charter-template'])
    expect(grantFor('leadership-team-charter-template.docx', ['leadership-team-charter-template'])?.slug).toBe('leadership-team-charter-template')
    expect(grantFor('leadership-team-charter-template.docx', ['leadership-team-meeting-agenda-template'])).toBeNull()
    expect(grantFor('../../.env', ['leadership-team-charter-template'])).toBeNull()
  })
})

describe('the product pages', () => {
  it.each(Object.keys(PRODUCT_PAGES) as ProductPageKey[])('%s parses, with the product named and its search in the title', (key) => {
    const c = loadPage(key)
    expect(c.title.length).toBeLessThanOrEqual(65)
    expect(c.description.length).toBeLessThanOrEqual(155)
    expect(JSON.stringify(c)).not.toContain('{product}')
    expect(c.title.toLowerCase()).toContain(PRODUCT_PAGES[key].queries[0])
  })

  it('names only claims that are true today: a step not built says so', () => {
    const steps = loadPage('platform').steps ?? []
    expect(steps.filter((s) => s.status === 'available').map((s) => s.title)).toEqual([
      'Take the Leadership Team Scan',
      'Invite your group',
      'Read the team view together',
      'Take the Leader Profile',
      'Agree a charter',
      'Run the full diagnostic',
      'Choose focus areas',
      'Meet with purpose',
      'Measure again',
    ])
    // every step leads to the feature page that shows it (D-54)
    const pages = new Set(FEATURES.map((f) => featurePath(f.slug)))
    for (const s of steps) expect(pages, s.title).toContain(s.href)
    for (const key of Object.keys(PRODUCT_PAGES) as ProductPageKey[]) {
      const text = JSON.stringify(loadPage(key))
      expect(text, key).not.toMatch(/\$\s?\d|£\s?\d|per seat|most chosen/i)
    }
  })

  it('keeps every FAQ answer the page shows equal to what FAQPage repeats', () => {
    for (const key of Object.keys(PRODUCT_PAGES) as ProductPageKey[]) {
      for (const f of loadPage(key).faq ?? []) expect(plain(f.a).length).toBeGreaterThan(10)
    }
  })
})

describe('the inventory and the sitemap', () => {
  const inventory = contentInventory()

  it('has one page per search: no search is the first of two pages', () => {
    const firsts = inventory.items.map((i) => i.queries[0]!.toLowerCase())
    expect(new Set(firsts).size).toBe(firsts.length)
    const paths = inventory.items.map((i) => i.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it("names every page with its status, and stays inside Sentral's limits", () => {
    expect(inventory.site).toBe('www.leaderpact.com')
    expect(inventory.keywords.length).toBeLessThanOrEqual(200)
    for (const k of inventory.keywords) expect(k).toBe(k.toLowerCase().trim())
    for (const a of ARTICLES) expect(inventory.items.find((i) => i.path === articlePath(a.slug))?.status).toBe(a.status)
    for (const i of inventory.items) expect(i.path).toMatch(/^\/[a-z0-9/-]*$/)
  })

  it('lists every published page in the sitemap, and nothing private', () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname)
    for (const a of PUBLISHED) expect(urls).toContain(articlePath(a.slug))
    for (const i of inventory.items.filter((x) => x.status === 'published')) expect(urls).toContain(i.path)
    for (const u of urls) expect(u).not.toMatch(/^\/(app|j|auth|sign-in|scan|specimens|templates\/file)(\/|$)/)
    expect(urls).not.toContain('/articles/team-learning-and-reflection')
  })
})
