import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { loadScan } from '@/lib/scan/load'
import { ScanUnavailable } from '../Unavailable'
import { PersonalView } from './PersonalView'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('resultTitle', { product: PRODUCT_NAME }) }
}

/** The personal view (handoff 6.3), worked out on the device from the answers kept there */
export default async function ResultPage() {
  const scan = await loadScan()
  return scan ? <PersonalView scan={scan} /> : <ScanUnavailable />
}
