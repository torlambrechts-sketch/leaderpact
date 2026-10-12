import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { LegalPage } from '@/components/lp/LegalPage'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('privacyTitle', { product: PRODUCT_NAME }) }
}

/** TODO(owner): the privacy notice. Legal review is not done (handoff section 14); this page says so. */
export default async function PrivacyPage() {
  const t = await getTranslations('legal')
  return <LegalPage heading={t('privacyHeading')} body={t('privacyPending')} />
}
