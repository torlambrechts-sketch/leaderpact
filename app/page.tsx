import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'

/**
 * A holding page until milestone 3 builds the landing page. It claims nothing that is not true
 * today (handoff section 10).
 */
export default async function HoldingPage() {
  const t = await getTranslations('holding')
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-3xl font-medium">{t('heading', { product: PRODUCT_NAME })}</h1>
      <p className="text-base">{t('body')}</p>
    </main>
  )
}
