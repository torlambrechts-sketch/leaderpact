import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArticleCards } from '@/components/site/ArticleCards'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { JsonLd } from '@/components/site/JsonLd'
import { TemplateTeaser } from '@/components/site/TemplateTeaser'
import { ARTICLE_GROUPS, ARTICLES_PATH, articlePath, PUBLISHED } from '@/lib/site/articles'
import { allArticles } from '@/lib/site/article-load'
import { pageCard } from '@/lib/site/cards'
import { absolute } from '@/lib/site/config'
import { pageMeta } from '@/lib/site/meta'
import { breadcrumbs, graph, organization, webPage } from '@/lib/site/schema'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site.articles')
  return pageMeta({ title: t('title'), description: t('description'), path: ARTICLES_PATH, image: pageCard('articles') })
}

/**
 * The articles, by section (D-33). Informational: the index carries no offer. Under the sections, the free
 * templates, which are resources for the reader's own work.
 */
export default async function ArticlesPage() {
  const t = await getTranslations('site')
  const articles = allArticles()
  const sections = ARTICLE_GROUPS.map((group) => ({ group, slugs: PUBLISHED.filter((a) => a.group === group).map((a) => a.slug) })).filter((s) => s.slugs.length)

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-12 px-4 pb-6 pt-8 md:px-gutter md:pt-12">
      <JsonLd
        data={graph(
          organization(),
          {
            ...webPage(ARTICLES_PATH, t('articles.h1'), t('articles.description'), 'CollectionPage'),
            hasPart: articles.map(({ entry, content }) => ({ '@type': 'Article', headline: content.h1, url: absolute(articlePath(entry.slug)) })),
          },
          breadcrumbs([
            { name: t('common.home'), path: '/' },
            { name: t('articles.crumb'), path: ARTICLES_PATH },
          ]),
        )}
      />
      <header className="flex max-w-[760px] flex-col gap-4">
        <Breadcrumb label={t('common.breadcrumb')} trail={[{ name: t('common.home'), path: '/' }]} />
        <h1 className="m-0 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.03em] max-md:text-[32px]">{t('articles.h1')}</h1>
        <p className="m-0 text-[19px] leading-[1.6] text-text-3 max-md:text-[17px]">{t('articles.lead')}</p>
      </header>
      {sections.map((s) => (
        <section key={s.group} aria-labelledby={`group-${s.group}`} className="flex flex-col gap-2">
          <h2 id={`group-${s.group}`} className="m-0 font-display text-[26px] font-medium tracking-[-0.02em]">
            {t(`articles.groups.${s.group}.title`)}
          </h2>
          <p className="m-0 max-w-[760px] text-[15.5px] leading-[1.6] text-text-2">{t(`articles.groups.${s.group}.text`)}</p>
          <ArticleCards slugs={s.slugs} className="mt-3" />
        </section>
      ))}
      <section aria-labelledby="templates" className="flex flex-col gap-4">
        <h2 id="templates" className="m-0 font-display text-[26px] font-medium tracking-[-0.02em]">
          {t('articles.templates')}
        </h2>
        <TemplateTeaser slug="leadership-team-charter-template" />
        <TemplateTeaser slug="leadership-team-meeting-agenda-template" />
      </section>
    </div>
  )
}
