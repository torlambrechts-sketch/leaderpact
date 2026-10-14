import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import { articleBySlug, articlePath } from '@/lib/site/articles'
import { loadArticle } from '@/lib/site/article-load'
import { ArticleArt } from './art/ArticleArt'

/**
 * Cards that lead to articles, by slug: the article's drawing (D-41), the heading, the description and "Read the
 * article". They fill the frame (D-48): two lie on their side, the drawing beside the words, from 1024 px; four
 * stand in one row from 1280 px; otherwise three to a row.
 */
export async function ArticleCards({ slugs, className }: { slugs: readonly string[]; className?: string }) {
  const t = await getTranslations('site.common')
  const cards = slugs.flatMap((slug) => {
    const a = loadArticle(slug)
    return a ? [{ slug, h1: a.content.h1, description: a.content.description, art: articleBySlug(slug)?.art }] : []
  })
  const side = cards.length <= 2
  const columns = cards.length === 2 ? 'md:grid-cols-2' : cards.length === 4 ? 'md:grid-cols-2 xl:grid-cols-4' : cards.length > 2 ? 'md:grid-cols-2 xl:grid-cols-3' : ''
  return (
    <ul className={cn('m-0 grid list-none gap-4 p-0', columns, className)}>
      {cards.map((c) => (
        <li key={c.slug}>
          <Link
            href={articlePath(c.slug) as Route}
            className={cn(
              'group flex h-full flex-col overflow-hidden rounded-card border border-bar bg-surface text-ink no-underline transition-shadow hover:text-ink hover:shadow-[0_18px_40px_-28px_rgba(17,17,17,0.45)]',
              side && 'lg:flex-row',
            )}
          >
            {c.art ? (
              <span className={cn('flex h-[168px] flex-none items-center justify-center bg-surface-sunk', side && 'lg:h-auto lg:w-[40%] lg:py-6')}>
                <ArticleArt kind={c.art} className="h-[150px] w-auto transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none" />
              </span>
            ) : null}
            <span className={cn('flex flex-1 flex-col gap-2 px-6 pb-5 pt-4', side && 'lg:justify-center lg:py-7')}>
              <span className="font-display text-[19px] font-medium leading-[1.25] tracking-[-0.01em]">{c.h1}</span>
              <span className="text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{c.description}</span>
              <span className={cn('mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-semibold group-hover:underline', side && 'lg:mt-2')}>
                {t('readArticle')}
                <ArrowRight aria-hidden size={15} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
