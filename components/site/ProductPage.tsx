import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, CircleCheck, Hammer } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/cn'
import { SCAN_PATH } from '@/lib/routes'
import { faqPage, breadcrumbs, graph, organization, webPage } from '@/lib/site/schema'
import type { PageContent } from '@/lib/site/page-content'
import { ArticleCards } from './ArticleCards'
import { Blocks } from './Blocks'
import { Breadcrumb } from './Breadcrumb'
import { JsonLd } from './JsonLd'
import { Rich } from './Rich'

/**
 * A product page (D-38): the hero with the one button the landing page has, "Start the scan"; the steps
 * where the page has them, each marked available or in development; the blocks; the questions, which the
 * FAQPage data repeats word for word; and two articles to read next.
 */
export async function ProductPage({
  path,
  content: c,
  related,
  extra,
  features,
}: {
  path: string
  content: PageContent
  related: readonly string[]
  extra?: React.ReactNode
  /** the platform's feature pages (D-44), under the steps */
  features?: React.ReactNode
}) {
  const t = await getTranslations('site')
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col px-4 pb-6 md:px-gutter">
      <JsonLd
        data={graph(
          organization(),
          webPage(path, c.h1, c.description),
          breadcrumbs([
            { name: t('common.home'), path: '/' },
            { name: c.crumb, path },
          ]),
          ...(c.faq?.length ? [faqPage(path, c.faq)] : []),
        )}
      />
      <header className="flex max-w-[800px] flex-col gap-4 pt-8 md:pt-12">
        <Breadcrumb label={t('common.breadcrumb')} trail={[{ name: t('common.home'), path: '/' }]} />
        <p className="m-0 self-start rounded-pill bg-accent px-3 py-[5px] text-[12.5px] font-semibold text-accent-ink">{c.kicker}</p>
        <h1 className="m-0 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.03em] max-md:text-[32px]">{c.h1}</h1>
        <p className="m-0 text-[19px] leading-[1.6] text-text-3 max-md:text-[17px]" style={{ textWrap: 'pretty' }}>
          <Rich text={c.lead} />
        </p>
        <Link
          href={SCAN_PATH as Route}
          className="mt-2 inline-flex items-center gap-2 self-start rounded-btn bg-ink px-[22px] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,.35)] hover:text-white"
        >
          {t('common.startScan')}
          <ArrowRight aria-hidden size={16} />
        </Link>
      </header>

      {c.steps?.length ? (
        <section aria-labelledby="steps" className="mt-12">
          <h2 id="steps" className="m-0 font-display text-section-headline max-md:text-[28px]">
            {t('platform.stepsTitle')}
          </h2>
          <ol className="m-0 mt-6 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
            {c.steps.map((s, i) => (
              <li key={i} className={cn('flex flex-col gap-2.5 rounded-card p-6', s.status === 'available' ? 'bg-surface' : 'border border-dashed border-line-dashed')}>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 self-start rounded-pill px-2.5 py-1 text-[12px] font-semibold',
                    s.status === 'available' ? 'bg-ok-bg text-ok-ink' : 'bg-pending-bg text-pending-ink',
                  )}
                >
                  {s.status === 'available' ? <CircleCheck aria-hidden size={14} /> : <Hammer aria-hidden size={14} />}
                  {s.status === 'available' ? t('platform.available') : t('platform.development')}
                </span>
                <h3 className="m-0 text-[18px] font-bold">
                  <span className="sr-only">{t('platform.step', { n: i + 1 })} </span>
                  {s.title}
                </h3>
                <p className="m-0 text-[15px] leading-[1.55] text-text-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {features}

      {/* figures take the page's width, text keeps the reading measure (D-44) */}
      <div className="mt-12">
        <Blocks blocks={c.blocks} wide />
      </div>

      {extra}

      {c.faq?.length ? (
        <section aria-labelledby="questions" className="mt-14 max-w-[760px]">
          <h2 id="questions" className="m-0 font-display text-[26px] font-medium tracking-[-0.02em]">
            {t('common.questions')}
          </h2>
          <dl className="m-0 mt-4 flex flex-col gap-3">
            {c.faq.map((f, i) => (
              <div key={i} className="rounded-card bg-surface px-6 py-5">
                <dt className="text-[16.5px] font-bold text-ink">
                  <Rich text={f.q} />
                </dt>
                <dd className="m-0 mt-2 text-[15.5px] leading-[1.6] text-text-body">
                  <Rich text={f.a} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="read-next" className="mt-14">
        <h2 id="read-next" className="m-0 font-display text-[24px] font-medium tracking-[-0.02em]">
          {t('common.readNext')}
        </h2>
        <ArticleCards slugs={related} className="mt-4" />
      </section>
    </div>
  )
}
