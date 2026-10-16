import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import messages from '@/messages/en.json'
import { ARTICLE_GROUPS, PUBLISHED } from '@/lib/site/articles'
import { GUIDE_FILE, GUIDE_SLUG, grantFor, MIME, templateBySlug } from '@/lib/site/templates'

/**
 * The free guide (D-60): the published articles, printed by scripts/templates/guide.mjs. The PDF is committed, so
 * nothing rebuilds it on its own; this holds its manifest equal to the articles and the guide's words as they are
 * now. An article changed, added or moved without a rebuild fails here, with the command that fixes it.
 */
const sha = (text: string) => createHash('sha256').update(text).digest('hex')
const REBUILD = 'the guide is out of date: rebuild it with scripts/templates/guide.mjs (D-60)'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found')
  },
}))

describe('the guide', () => {
  const manifest = JSON.parse(readFileSync('private/templates/guide-manifest.json', 'utf8')) as {
    file: string
    edition: string
    articles: { slug: string; sha256: string }[]
    copy: string
  }

  it('is a guide in the registry, given as one PDF, for an address like the templates', () => {
    const entry = templateBySlug(GUIDE_SLUG)
    expect(entry?.kind).toBe('guide')
    expect(entry?.files).toEqual([{ name: GUIDE_FILE, format: 'pdf' }])
    expect(MIME.pdf).toBe('application/pdf')
    expect(existsSync(`private/templates/${GUIDE_FILE}`)).toBe(true)
    expect(readFileSync(`private/templates/${GUIDE_FILE}`).subarray(0, 5).toString()).toBe('%PDF-')
    expect(grantFor(GUIDE_FILE, [GUIDE_SLUG])?.slug).toBe(GUIDE_SLUG)
    expect(grantFor(GUIDE_FILE, ['leadership-team-charter-template'])).toBeNull()
  })

  it('holds every published article, in the parts of the articles index, as they read now', () => {
    const expected = ARTICLE_GROUPS.flatMap((group) => PUBLISHED.filter((a) => a.group === group).map((a) => a.slug))
    expect(manifest.file).toBe(GUIDE_FILE)
    expect(manifest.articles.map((a) => a.slug), REBUILD).toEqual(expected)
    for (const a of manifest.articles) expect(a.sha256, `${a.slug}: ${REBUILD}`).toBe(sha(readFileSync(`data/articles/${a.slug}.json`, 'utf8')))
  })

  it("its own words are the ones it was printed with", () => {
    const copy = sha(JSON.stringify({ guide: messages.site.guide, groups: messages.site.articles.groups }))
    expect(manifest.copy, REBUILD).toBe(copy)
  })

  it('its print view is not served in production', async () => {
    const { default: GuidePrint } = await import('@/app/print/guide/page')
    vi.stubEnv('VERCEL_ENV', 'production')
    await expect(GuidePrint({ searchParams: Promise.resolve({}) })).rejects.toThrow('not found')
    vi.unstubAllEnvs()
  })
})
