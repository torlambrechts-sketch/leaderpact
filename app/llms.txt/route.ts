import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { LANDING_PATH, PROFILE_PATH } from '@/lib/routes'
import { ARTICLE_GROUPS, ARTICLES_PATH, articlePath, PUBLISHED } from '@/lib/site/articles'
import { allArticles } from '@/lib/site/article-load'
import { absolute } from '@/lib/site/config'
import { loadPage, PRODUCT_PAGES, type ProductPageKey } from '@/lib/site/pages'
import { allTemplates } from '@/lib/site/template-load'
import { templatePath } from '@/lib/site/templates'

export const dynamic = 'force-static'

/**
 * /llms.txt (Orgpuls D-281): the public pages with their own titles and descriptions, so an answer engine
 * reading it learns nothing the pages do not say themselves.
 */
export async function GET() {
  const [meta, site] = await Promise.all([getTranslations('meta'), getTranslations('site')])
  const line = (title: string, path: string, description: string) => `- [${title}](${absolute(path)}): ${description}`
  const articles = allArticles()
  const out = [
    `# ${PRODUCT_NAME}`,
    '',
    `> ${meta('description', { product: PRODUCT_NAME })}`,
    '',
    '## Product',
    line(meta('landingTitle', { product: PRODUCT_NAME }), LANDING_PATH, meta('landingDescription')),
    line(meta('profileTitle', { product: PRODUCT_NAME }), PROFILE_PATH, meta('profileDescription')),
    ...(Object.keys(PRODUCT_PAGES) as ProductPageKey[]).map((k) => {
      const c = loadPage(k)
      return line(c.title, PRODUCT_PAGES[k].path, c.description)
    }),
    '',
    `## ${site('articles.crumb')}`,
    line(site('articles.title'), ARTICLES_PATH, site('articles.description')),
    ...ARTICLE_GROUPS.flatMap((g) =>
      PUBLISHED.filter((a) => a.group === g).flatMap((a) => {
        const found = articles.find((x) => x.entry.slug === a.slug)
        return found ? [line(found.content.title, articlePath(a.slug), found.content.description)] : []
      }),
    ),
    '',
    `## ${site('templates.crumb')}`,
    ...allTemplates().map(({ template, content }) => line(content.title, templatePath(template.slug), content.description)),
    '',
  ]
  return new Response(out.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
