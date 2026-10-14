import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import { articlePath } from '@/lib/site/articles'
import { loadArticle } from '@/lib/site/article-load'

/** Cards that lead to articles, by slug: the heading, the description and "Read the article" */
export async function ArticleCards({ slugs, className }: { slugs: readonly string[]; className?: string }) {
  const t = await getTranslations('site.common')
  const cards = slugs.flatMap((slug) => {
    const a = loadArticle(slug)
    return a ? [{ slug, h1: a.content.h1, description: a.content.description }] : []
  })
  return (
    <ul className={cn('m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3', className)}>
      {cards.map((c) => (
        <li key={c.slug}>
          <Link
            href={articlePath(c.slug) as Route}
            className="group flex h-full flex-col gap-2 rounded-card border border-bar bg-surface px-6 py-5 text-ink no-underline hover:text-ink"
          >
            <span className="font-display text-[19px] font-medium leading-[1.25] tracking-[-0.01em]">{c.h1}</span>
            <span className="text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{c.description}</span>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-semibold group-hover:underline">
              {t('readArticle')}
              <ArrowRight aria-hidden size={15} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
