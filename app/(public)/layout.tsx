import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { PublicFooter, PublicHeader } from '@/components/lp/PublicHeader'
import { SiteBeacon } from '@/components/site/SiteBeacon'
import type { PlatformNav } from '@/components/lp/PlatformMenu'
import { allFeatures, featurePath, PLATFORM_PATH } from '@/lib/site/features'

/**
 * The public site: the landing page, the scan, the personal view, the Leader Profile and the legal pages
 * (handoff 6.1-6.3, 6.17).
 * The footer's privacy and data-processing links are on every public page, not only the landing page:
 * the scan is where a visitor most wants to know how answers are kept.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('publicNav')
  // the Platform menu (D-47): the features, named and summed up by their own pages, then the pages about how it is built
  const platform: PlatformNav = {
    label: t('platform'),
    featuresTitle: t('platformFeatures'),
    aboutTitle: t('platformAbout'),
    features: allFeatures().map(({ entry, content }) => ({ href: featurePath(entry.slug), label: content.nav, text: content.summary, icon: entry.icon })),
    about: [
      { href: PLATFORM_PATH, label: t('howItWorks'), text: t('overviewText'), icon: 'overview' },
      { href: '/anonymity', label: t('anonymity'), text: t('anonymityText'), icon: 'anonymity' },
      { href: '/research', label: t('research'), text: t('researchText'), icon: 'research' },
    ],
  }
  return (
    <>
      <PublicHeader
        productName={PRODUCT_NAME}
        labels={{
          menu: t('menu'),
          scan: t('scan'),
          profile: t('profile'),
          start: t('start'),
          home: t('home', { product: PRODUCT_NAME }),
          signIn: t('signIn'),
          articles: t('articles'),
          open: t('openMenu'),
          close: t('closeMenu'),
        }}
        platform={platform}
      />
      <SiteBeacon />
      <main id="main">{children}</main>
      <PublicFooter
        labels={{
          menu: t('footer'),
          profile: t('profile'),
          privacy: t('privacy'),
          dataProcessing: t('dataProcessing'),
          signIn: t('signIn'),
          product: t('product'),
          learn: t('learn'),
          scan: t('scan'),
          howItWorks: t('howItWorks'),
          research: t('research'),
          anonymity: t('anonymity'),
          tools: t('tools'),
          articles: t('articles'),
          templates: t('templates'),
        }}
        platform={{ label: t('platform'), links: platform.features.map((f) => ({ href: f.href, label: f.label })) }}
      />
    </>
  )
}
