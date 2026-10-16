import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Blocks } from '@/components/site/Blocks'
import { Rich } from '@/components/site/Rich'
import { ArticleArt } from '@/components/site/art/ArticleArt'
import { PRODUCT_NAME } from '@/lib/brand'
import { loadArticle } from '@/lib/site/article-load'
import { ARTICLE_GROUPS, PUBLISHED } from '@/lib/site/articles'
import { sourceLabel } from '@/lib/site/blocks'
import { CHECKED_ON, SITE_HOST } from '@/lib/site/config'
import { formatDay } from '@/lib/site/dates'
import { NOINDEX } from '@/lib/site/meta'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'How leadership teams really work', robots: NOINDEX }

/**
 * The guide's print view (D-60): every published article, in the articles index's four parts, laid out for A4.
 * scripts/templates/guide.mjs opens it and prints it to private/templates. It reuses the article renderers, so
 * the guide reads and draws exactly as the site does, and an article changed is a rebuild, not an edit.
 *
 * Not served in production, like the specimens: the file is the guide, given for an address (D-37). The edition
 * date comes from the build script, so the page itself reads no clock.
 */
// Chromium paints a flex column that runs over a page break on top of what follows, so a chapter and its long
// columns flow as blocks in print, with the same spacing; rows, figures and cards keep their own layout
const PRINT_CSS = `
@page { size: A4; }
html, body { background: #fff !important; }
.skip-link { display: none; }
.guide-sheet { break-after: page; }
.guide-chapter { break-before: page; }
.guide-chapter, .guide-chapter > header, .guide-chapter > div.flex-col { display: block !important; }
.guide-chapter > * + *, .guide-chapter > div.flex-col > * + * { margin-top: 20px; }
.guide-chapter > header > * + * { margin-top: 12px; }
.guide-chapter ul.flex-col, .guide-chapter ol.flex-col { display: block !important; }
.guide-chapter ul.flex-col > li + li, .guide-chapter ol.flex-col > li + li { margin-top: 8px; }
.guide-chapter h2, .guide-chapter h3 { break-after: avoid; }
.guide-chapter svg, .guide-chapter figure, .guide-chapter table, .guide-chapter li, .guide-chapter .rounded-card { break-inside: avoid; }
`

export default async function GuidePrint({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const params = await searchParams
  const edition = typeof params.edition === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.edition) ? params.edition : CHECKED_ON
  const t = await getTranslations('site')

  const parts = ARTICLE_GROUPS.map((group) => ({
    group,
    chapters: PUBLISHED.filter((a) => a.group === group).flatMap((entry) => {
      const found = loadArticle(entry.slug)
      return found ? [{ entry, content: found.content }] : []
    }),
  })).filter((p) => p.chapters.length)
  let n = 0
  const numbered = parts.map((p) => ({ ...p, chapters: p.chapters.map((c) => ({ ...c, n: ++n })) }))

  return (
    <main id="main" className="mx-auto max-w-[720px] px-2 text-ink">
      <style>{PRINT_CSS}</style>

      <section className="guide-sheet flex min-h-[250mm] flex-col justify-between py-10">
        <p className="m-0 text-[14px] font-semibold uppercase tracking-[0.08em] text-text-2">{t('guide.kicker', { product: PRODUCT_NAME })}</p>
        <div className="flex flex-col gap-5">
          <h1 className="m-0 font-display text-[54px] font-medium leading-[1.04] tracking-[-0.03em]">{t('guide.title')}</h1>
          <p className="m-0 max-w-[560px] text-[20px] leading-[1.5] text-text-3">{t('guide.subtitle', { count: n })}</p>
        </div>
        <p className="m-0 text-[14px] text-text-2">
          {PRODUCT_NAME} · {SITE_HOST} · {t('guide.edition', { date: formatDay(edition) })}
        </p>
      </section>

      <section className="guide-sheet flex flex-col gap-4 py-6">
        <h2 className="m-0 font-display text-[30px] font-medium tracking-[-0.02em]">{t('guide.aboutTitle')}</h2>
        <p className="m-0 text-[16px] leading-[1.6]">{t('guide.about1', { site: SITE_HOST })}</p>
        <p className="m-0 text-[16px] leading-[1.6]">{t('guide.about2')}</p>
        <p className="m-0 text-[16px] leading-[1.6]">{t('guide.about3', { date: formatDay(CHECKED_ON) })}</p>
        <h2 className="m-0 mt-6 font-display text-[30px] font-medium tracking-[-0.02em]">{t('guide.contents')}</h2>
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {numbered.map((p, i) => (
            <li key={p.group} className="flex flex-col gap-1.5">
              <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-text-2">
                {t('guide.part', { n: i + 1 })} · {t(`articles.groups.${p.group}.title`)}
              </p>
              <ol className="m-0 flex list-none flex-col gap-1 p-0">
                {p.chapters.map((c) => (
                  <li key={c.entry.slug} className="text-[16px] leading-[1.45]">
                    <a href={`#chapter-${c.n}`} className="text-ink no-underline">
                      {`${c.n}. ${c.content.h1}`}
                    </a>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </section>

      {numbered.map((p, i) => (
        <div key={p.group}>
          <section className="guide-chapter guide-sheet flex min-h-[200mm] flex-col justify-center gap-4">
            <p className="m-0 text-[14px] font-bold uppercase tracking-[0.08em] text-text-2">{t('guide.part', { n: i + 1 })}</p>
            <h2 className="m-0 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.03em]">{t(`articles.groups.${p.group}.title`)}</h2>
            <p className="m-0 max-w-[560px] text-[18px] leading-[1.55] text-text-3">{t(`articles.groups.${p.group}.text`)}</p>
          </section>

          {p.chapters.map(({ entry, content: c, n: number }) => (
            <article key={entry.slug} id={`chapter-${number}`} data-chapter={number} data-slug={entry.slug} className="guide-chapter flex flex-col gap-6">
              <header className="flex flex-col gap-3">
                <p className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-text-2">{t('guide.chapter', { n: number })}</p>
                <h2 className="m-0 font-display text-[36px] font-medium leading-[1.1] tracking-[-0.03em]">{c.h1}</h2>
                {entry.art ? <ArticleArt kind={entry.art} className="h-auto w-[300px]" /> : null}
                <p className="m-0 text-[17px] leading-[1.6] text-text-3">
                  <Rich text={c.lead} />
                </p>
              </header>
              <section className="rounded-card bg-surface px-6 py-5">
                <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-text-2">{t('common.inShort')}</h3>
                <ul className="m-0 mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] leading-[1.6] text-text-body">
                  {c.takeaways.map((item, k) => (
                    <li key={k}>
                      <Rich text={item} />
                    </li>
                  ))}
                </ul>
              </section>
              <Blocks blocks={c.blocks} sources={c.sources} />
              <section className="border-t border-bar pt-5">
                <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.08em] text-text-2">{t('common.sources')}</h3>
                <ol className="m-0 mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-[1.5] text-text-body">
                  {c.sources.map((s, k) => (
                    <li key={s.url} id={`source-${k + 1}`}>
                      <a href={s.url} className="break-words text-ink underline decoration-1 underline-offset-2">
                        {sourceLabel(s)}
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            </article>
          ))}
        </div>
      ))}

      <section className="guide-chapter flex flex-col gap-4 py-6">
        <h2 className="m-0 font-display text-[30px] font-medium tracking-[-0.02em]">{t('guide.nextTitle')}</h2>
        <p className="m-0 text-[16px] leading-[1.6]">{t('guide.nextArticles', { site: SITE_HOST })}</p>
        <p className="m-0 text-[16px] leading-[1.6]">{t('guide.nextTemplates', { site: SITE_HOST })}</p>
        <p className="m-0 text-[16px] leading-[1.6]">{t('guide.nextScan', { site: SITE_HOST })}</p>
      </section>
    </main>
  )
}
