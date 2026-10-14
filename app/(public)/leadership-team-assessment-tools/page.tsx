import type { Metadata } from 'next'
import { ProductPage } from '@/components/site/ProductPage'
import { pageCard } from '@/lib/site/cards'
import { pageMeta } from '@/lib/site/meta'
import { loadPage, PRODUCT_PAGES } from '@/lib/site/pages'

const PAGE = PRODUCT_PAGES.tools

export function generateMetadata(): Metadata {
  const c = loadPage('tools')
  return pageMeta({ title: c.title, description: c.description, path: PAGE.path, image: pageCard('leadership-team-assessment-tools') })
}

/** A product page (D-38); its words are data/pages, its frame components/site/ProductPage */
export default function Page() {
  return <ProductPage path={PAGE.path} content={loadPage('tools')} related={PAGE.related} />
}
