import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { article as articleLd, breadcrumbs, graph, organization } from '@/lib/site/schema'
import { headingIds, plain, sourceLabel } from '@/lib/site/blocks'
import { articleWords, type ArticleContent } from '@/lib/site/article-content'
import { ARTICLES_PATH, articlePath, type ArticleEntry } from '@/lib/site/articles'
import { articleCard } from '@/lib/site/cards'
import { CHECKED_ON } from '@/lib/site/config'
import { formatDay } from '@/lib/site/dates'
import { ArticleCards } from './ArticleCards'
import { Blocks } from './Blocks'
import { Breadcrumb } from './Breadcrumb'
import { JsonLd } from './JsonLd'
import { Rich } from './Rich'
import { TemplateTeaser } from './TemplateTeaser'
import { ArticleArt } from './art/ArticleArt'

/** Words a minute for English non-fiction read on a screen; rounded up, never below 1 */
const WPM = 230

/**
 * An article (D-34): the answer first, the argument in the blocks, every claim's source listed under it,
 * and two neighbouring articles. It sells nothing (Orgpuls D-235): no offer beside or under the text. The
 * site's header and footer are the way to the product. The one box at the foot is the free template that
 * goes with the article (Orgpuls D-243): a resource for the reader, named for what it is.
 */
export async function ArticleView({ entry, content: c }: { entry: ArticleEntry; content: ArticleContent }) {
  const t = await getTranslations('site')
  const path = articlePath(entry.slug)
  const words = articleWords(c)
  const minutes = Math.max(1, Math.ceil(words / WPM))
  const published = entry.published ?? CHECKED_ON
  const modified = entry.modified ?? published
  const ids = headingIds(c.blocks)
  const toc = [...ids.entries()].map(([i, id]) => {
    const b = c.blocks[i]
    return { id, text: b && 'text' in b ? plain(b.text) : '' }
  })

  return (
    <article className="mx-auto flex max-w-site flex-col px-4 pb-6 md:px-gutter">
      <JsonLd
        data={graph(
          organization(),
          articleLd({
            path,
            headline: c.h1,
            description: c.description,
            published,
            modified,
            words,
            image: articleCard(entry.slug),
            sources: c.sources,
            about: entry.queries,
            topics: entry.about,
            mentions: entry.mentions,
          }),
          breadcrumbs([
            { name: t('common.home'), path: '/' },
            { name: t('articles.crumb'), path: ARTICLES_PATH },
            { name: c.h1, path },
          ]),
        )}
      />

      <header className="grid items-center gap-8 pt-8 md:pt-12 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-16">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Breadcrumb label={t('common.breadcrumb')} trail={[{ name: t('common.home'), path: '/' }, { name: t('articles.crumb'), path: ARTICLES_PATH }]} />
          <h1 className="m-0 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.03em] max-md:text-[32px]">{c.h1}</h1>
          <p className="m-0 text-[19px] leading-[1.6] text-text-3 max-md:text-[17px]" style={{ textWrap: 'pretty' }}>
            <Rich text={c.lead} />
          </p>
          <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">
            {t('common.byline', { date: formatDay(modified), minutes })}
          </p>
        </div>
        {/* the drawing (D-41) beside the title on a wide screen; on a phone the answer comes first and the drawing waits for the card */}
        {entry.art ? <ArticleArt kind={entry.art} className="hidden h-auto w-full lg:block" /> : null}
      </header>

      {/* the text at the reading measure, and beside it, filling the frame (D-48), what is on the page and the template */}
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-14 xl:grid-cols-[minmax(0,800px)_minmax(0,1fr)] xl:gap-16">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="in-short" className="rounded-card bg-surface px-6 py-5">
            <h2 id="in-short" className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-text-2">
              {t('common.inShort')}
            </h2>
            <ul className="m-0 mt-3 flex list-disc flex-col gap-2 pl-5 text-[16px] leading-[1.6] text-text-body">
              {c.takeaways.map((item, i) => (
                <li key={i}>
                  <Rich text={item} />
                </li>
              ))}
            </ul>
          </section>

          <Blocks blocks={c.blocks} sources={c.sources} />

          {entry.template ? <TemplateTeaser slug={entry.template} className="lg:hidden" /> : null}

          <section aria-labelledby="sources" className="border-t border-bar pt-6">
            <h2 id="sources" className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-text-2">
              {t('common.sources')}
            </h2>
            <ol className="m-0 mt-3 flex list-decimal flex-col gap-2 pl-5 text-[14.5px] leading-[1.55] text-text-body max-md:text-[15px]">
              {c.sources.map((s, i) => (
                <li key={s.url} id={`source-${i + 1}`} className="scroll-mt-6 target:rounded-chip target:bg-pending-bg">
                  <a href={s.url} className="text-link break-words underline decoration-1 underline-offset-2" target="_blank" rel="noopener noreferrer">
                    {sourceLabel(s)}
                  </a>
                </li>
              ))}
            </ol>
            <p className="m-0 mt-4 text-[13px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('common.sourcesNote', { date: formatDay(CHECKED_ON) })}</p>
          </section>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-6 flex flex-col gap-4">
            {toc.length >= 3 ? (
              <nav aria-label={t('common.onThisPage')} className="flex flex-col gap-3 rounded-card border border-bar px-5 py-4">
                <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-text-2">{t('common.onThisPage')}</p>
                <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[14px] leading-[1.45]">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <Link href={`#${h.id}` as Route} className="text-text-2 hover:text-ink">
                        {h.text}
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}
            {entry.template ? <TemplateTeaser slug={entry.template} compact /> : null}
          </div>
        </div>
      </div>

      {entry.related ? (
        <section aria-labelledby="read-next" className="mt-16">
          <h2 id="read-next" className="m-0 font-display text-[24px] font-medium tracking-[-0.02em]">
            {t('common.readNext')}
          </h2>
          <ArticleCards slugs={entry.related} className="mt-4" />
        </section>
      ) : null}
    </article>
  )
}
