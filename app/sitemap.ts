import type { MetadataRoute } from 'next'
import { LANDING_PATH, PROFILE_PATH } from '@/lib/routes'
import { ARTICLES_PATH, articlePath, PUBLISHED } from '@/lib/site/articles'
import { absolute } from '@/lib/site/config'
import { PRODUCT_PAGES } from '@/lib/site/pages'
import { TEMPLATES, TEMPLATES_PATH, templatePath } from '@/lib/site/templates'

/**
 * Every page a search engine may show, from the registries (D-33): the landing page, the Leader Profile,
 * the product pages, the articles and the templates. The questionnaires, results, sign-in, the invite link
 * and the app are not here, and each says noindex itself.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const newest = [...PUBLISHED.map((a) => a.modified ?? ''), ...TEMPLATES.map((t) => t.modified)].sort().at(-1)
  return [
    { url: absolute(LANDING_PATH), changeFrequency: 'monthly', priority: 1 },
    { url: absolute(PROFILE_PATH), changeFrequency: 'monthly', priority: 0.8 },
    ...Object.values(PRODUCT_PAGES).map((p) => ({ url: absolute(p.path), changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: absolute(ARTICLES_PATH), lastModified: newest, changeFrequency: 'weekly', priority: 0.7 },
    ...PUBLISHED.map((a) => ({ url: absolute(articlePath(a.slug)), lastModified: a.modified, changeFrequency: 'monthly' as const, priority: 0.6 })),
    { url: absolute(TEMPLATES_PATH), lastModified: newest, changeFrequency: 'monthly', priority: 0.6 },
    ...TEMPLATES.map((t) => ({ url: absolute(templatePath(t.slug)), lastModified: t.modified, changeFrequency: 'monthly' as const, priority: 0.6 })),
  ]
}
