import { PRODUCT_NAME } from '@/lib/brand'
import { LANDING_PATH, PROFILE_PATH } from '@/lib/routes'
import messages from '@/messages/en.json'
import { ARTICLES, articlePath } from './articles'
import { loadArticle } from './article-load'
import { SITE_HOST } from './config'
import { allFeatures, featurePath } from './features'
import { loadPage, PRODUCT_PAGES, type ProductPageKey } from './pages'
import { loadTemplate } from './template-load'
import { TEMPLATES, templatePath } from './templates'

/**
 * The public site's content inventory (D-36): every page a search should find, the searches each answers
 * (the first is the one it is the answer to: one page per intent), and whether it is live or planned. It is
 * the keyword map of docs/marketing/seo-geo-strategy.md as data, and it is what Sentral receives as a
 * `content.inventory` event (scripts/platform/publish-content.mjs), so Growth › SEO tracks the same searches
 * and plans the same pages. Titles, paths, dates and searches only: no person and no answer.
 */
export type InventoryItem = {
  path: string
  kind: 'page' | 'article' | 'template'
  title: string
  queries: string[]
  status: 'published' | 'planned'
  published?: string
}

/** The landing page and the Leader Profile, the two free tools (owner's market angle: the tool searches) */
export const TOOL_PAGES = [
  {
    path: LANDING_PATH,
    title: messages.meta.landingTitle,
    queries: ['leadership team assessment', 'executive team effectiveness assessment', 'leadership team effectiveness survey'],
  },
  {
    path: PROFILE_PATH,
    title: messages.meta.profileTitle,
    queries: ['leadership assessment test free', 'big five personality test for leaders'],
  },
] as const

const named = (s: string) => s.replaceAll('{product}', PRODUCT_NAME)

export function contentInventory(): { site: string; items: InventoryItem[]; keywords: string[] } {
  const items: InventoryItem[] = [
    ...TOOL_PAGES.map((p) => ({ path: p.path, kind: 'page' as const, title: named(p.title), queries: [...p.queries], status: 'published' as const })),
    ...(Object.keys(PRODUCT_PAGES) as ProductPageKey[]).map((k) => ({
      path: PRODUCT_PAGES[k].path,
      kind: 'page' as const,
      title: loadPage(k).title,
      queries: [...PRODUCT_PAGES[k].queries],
      status: 'published' as const,
    })),
    // the platform's feature pages (D-47)
    ...allFeatures().map(({ entry, content }) => ({
      path: featurePath(entry.slug),
      kind: 'page' as const,
      title: content.title,
      queries: [...entry.queries],
      status: 'published' as const,
    })),
    ...ARTICLES.map((a) => ({
      path: articlePath(a.slug),
      kind: 'article' as const,
      title: loadArticle(a.slug)?.content.title ?? a.slug,
      queries: [...a.queries],
      status: a.status,
      ...(a.published ? { published: a.published } : {}),
    })),
    ...TEMPLATES.map((t) => ({
      path: templatePath(t.slug),
      kind: 'template' as const,
      title: loadTemplate(t.slug)?.content.title ?? t.slug,
      queries: [...t.queries],
      status: 'published' as const,
      published: t.published,
    })),
  ]
  const keywords = [...new Set(items.flatMap((i) => i.queries.map((q) => q.toLowerCase().trim())))]
  return { site: SITE_HOST, items, keywords }
}
