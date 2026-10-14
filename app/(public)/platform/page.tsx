import type { Metadata } from 'next'
import { ProductPage } from '@/components/site/ProductPage'
import { pageCard } from '@/lib/site/cards'
import { pageMeta } from '@/lib/site/meta'
import { loadPage, PRODUCT_PAGES } from '@/lib/site/pages'

const PAGE = PRODUCT_PAGES.platform

export function generateMetadata(): Metadata {
  const c = loadPage('platform')
  return pageMeta({ title: c.title, description: c.description, path: PAGE.path, image: pageCard('platform') })
}

/** A product page (D-38); its words are data/pages, its frame components/site/ProductPage */
export default function Page() {
  return <ProductPage path={PAGE.path} content={loadPage('platform')} related={PAGE.related} />
}
