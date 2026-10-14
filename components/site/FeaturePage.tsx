import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { absolute } from '@/lib/site/config'
import { allFeatures, featurePath, PLATFORM_PATH, type FeatureContent, type FeatureSlug } from '@/lib/site/features'
import { breadcrumbs, faqPage, graph, organization, webPage } from '@/lib/site/schema'
import { ArticleCards } from './ArticleCards'
import { Blocks } from './Blocks'
import { Breadcrumb } from './Breadcrumb'
import { JsonLd } from './JsonLd'
import { Rich } from './Rich'
import { ArticleArt } from './art/ArticleArt'
import type { ArtKind } from '@/lib/site/articles'

/**
 * A feature page (D-46): what one feature of the platform does, shown in screenshots of the real app, with what
 * it brings to the person, the leadership group and the organisation. It informs and sells nothing (D-38): no
 * price and no offer beside the text, so the header and footer are the way into the product. Its questions are
 * repeated word for word as FAQPage data; the other features follow, then two articles.
 */
export async function FeaturePage({ slug, art, content: c, related }: { slug: FeatureSlug; art: ArtKind; content: FeatureContent; related: readonly string[] }) {
  const t = await getTranslations('site')
  const path = featurePath(slug)
  const others = allFeatures().filter((f) => f.entry.slug !== slug)
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col px-4 pb-6 md:px-gutter">
      <JsonLd
        data={graph(
          organization(),
          {
            ...webPage(path, c.h1, c.description),
            about: { '@type': 'SoftwareApplication', name: PRODUCT_NAME, url: absolute(PLATFORM_PATH), applicationCategory: 'BusinessApplication' },
          },
          breadcrumbs([
            { name: t('common.home'), path: '/' },
            { name: t('features.crumb'), path: PLATFORM_PATH },
            { name: c.crumb, path },
          ]),
          ...(c.faq?.length ? [faqPage(path, c.faq)] : []),
        )}
      />
      <header className="grid items-center gap-8 pt-8 md:pt-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex max-w-[780px] flex-col gap-4">
          <Breadcrumb
            label={t('common.breadcrumb')}
            trail={[
              { name: t('common.home'), path: '/' },
              { name: t('features.crumb'), path: PLATFORM_PATH },
            ]}
          />
          <p className="m-0 self-start rounded-pill bg-accent px-3 py-[5px] text-[12.5px] font-semibold text-accent-ink">{c.kicker}</p>
          <h1 className="m-0 font-display text-[44px] font-medium leading-[1.08] tracking-[-0.03em] max-md:text-[32px]">{c.h1}</h1>
          <p className="m-0 text-[19px] leading-[1.6] text-text-3 max-md:text-[17px]" style={{ textWrap: 'pretty' }}>
            <Rich text={c.lead} />
          </p>
        </div>
        <ArticleArt kind={art} className="hidden h-auto w-full lg:block" />
      </header>

      <div className="mt-12">
        <Blocks blocks={c.blocks} wide />
      </div>

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

      <section aria-labelledby="more-features" className="mt-14">
        <h2 id="more-features" className="m-0 font-display text-[24px] font-medium tracking-[-0.02em]">
          {t('features.more')}
        </h2>
        <FeatureCards items={others.map((f) => ({ slug: f.entry.slug, art: f.entry.art, nav: f.content.nav, summary: f.content.summary }))} className="mt-4" />
      </section>

      <section aria-labelledby="read-next" className="mt-14">
        <h2 id="read-next" className="m-0 font-display text-[24px] font-medium tracking-[-0.02em]">
          {t('common.readNext')}
        </h2>
        <ArticleCards slugs={related} className="mt-4" />
      </section>
    </div>
  )
}

/** Cards that lead to feature pages: the feature's drawing, its name and one line on what it does */
export async function FeatureCards({ items, className }: { items: { slug: string; art: ArtKind; nav: string; summary: string }[]; className?: string }) {
  const t = await getTranslations('site.features')
  return (
    <ul className={`m-0 grid list-none gap-4 p-0 sm:grid-cols-2 ${items.length === 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-4'} ${className ?? ''}`}>
      {items.map((f) => (
        <li key={f.slug}>
          <Link
            href={featurePath(f.slug) as Route}
            className="group flex h-full flex-col gap-2 overflow-hidden rounded-card border border-bar bg-surface px-5 pb-5 text-ink no-underline transition-shadow hover:text-ink hover:shadow-[0_18px_40px_-28px_rgba(17,17,17,0.45)]"
          >
            <span className="-mx-5 mb-2 flex h-[132px] items-center justify-center bg-surface-sunk">
              <ArticleArt kind={f.art} className="h-[118px] w-auto transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none" />
            </span>
            <span className="font-display text-[18px] font-medium leading-[1.25]">{f.nav}</span>
            <span className="text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{f.summary}</span>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[14px] font-semibold group-hover:underline">
              {t('read')}
              <ArrowRight aria-hidden size={15} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
