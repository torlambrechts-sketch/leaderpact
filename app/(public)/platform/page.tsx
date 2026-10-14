import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { FeatureCards } from '@/components/site/FeaturePage'
import { ProductPage } from '@/components/site/ProductPage'
import { allFeatures } from '@/lib/site/features'
import { pageCard } from '@/lib/site/cards'
import { pageMeta } from '@/lib/site/meta'
import { loadPage, PRODUCT_PAGES } from '@/lib/site/pages'

const PAGE = PRODUCT_PAGES.platform

export function generateMetadata(): Metadata {
  const c = loadPage('platform')
  return pageMeta({ title: c.title, description: c.description, path: PAGE.path, image: pageCard('platform') })
}

/** A product page (D-38); its words are data/pages, its frame components/site/ProductPage; the features' pages under the steps (D-47) */
export default async function Page() {
  const t = await getTranslations('site.platform')
  const features = (
    <section aria-labelledby="features" className="mt-14">
      <h2 id="features" className="m-0 font-display text-section-headline max-md:text-[28px]">
        {t('featuresTitle')}
      </h2>
      <FeatureCards
        className="mt-6"
        items={allFeatures().map((f) => ({ slug: f.entry.slug, art: f.entry.art, nav: f.content.nav, summary: f.content.summary }))}
      />
    </section>
  )
  return <ProductPage path={PAGE.path} content={loadPage('platform')} related={PAGE.related} features={features} />
}
