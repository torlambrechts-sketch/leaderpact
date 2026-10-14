import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { NOINDEX } from '@/lib/site/meta'
import { LegalPage } from '@/components/lp/LegalPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('dataProcessingTitle', { product: PRODUCT_NAME }), robots: NOINDEX }
}

/** TODO(owner): the data-processing terms. Legal review is not done (handoff section 14); this page says so. */
export default async function DataProcessingPage() {
  const t = await getTranslations('legal')
  return <LegalPage heading={t('dataProcessingHeading')} body={t('dataProcessingPending')} />
}
