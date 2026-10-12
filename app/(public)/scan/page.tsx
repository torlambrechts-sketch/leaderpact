import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { loadScan } from '@/lib/scan/load'
import { ScanFlow } from './ScanFlow'
import { ScanUnavailable } from './Unavailable'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('scanTitle', { product: PRODUCT_NAME }) }
}

/** The scan (handoff 6.2): the published version's items, answered on the device with no account */
export default async function ScanPage() {
  const scan = await loadScan()
  return scan ? <ScanFlow scan={scan} /> : <ScanUnavailable />
}
