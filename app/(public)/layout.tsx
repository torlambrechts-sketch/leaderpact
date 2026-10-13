import { getTranslations } from 'next-intl/server'
import { PRODUCT_NAME } from '@/lib/brand'
import { PublicFooter, PublicHeader } from '@/components/lp/PublicHeader'

/**
 * The public site: the landing page, the scan, the personal view, the Leader Profile and the legal pages
 * (handoff 6.1-6.3, 6.17).
 * The footer's privacy and data-processing links are on every public page, not only the landing page:
 * the scan is where a visitor most wants to know how answers are kept.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('publicNav')
  return (
    <>
      <PublicHeader productName={PRODUCT_NAME} labels={{ menu: t('menu'), scan: t('scan'), profile: t('profile'), start: t('start'), home: t('home', { product: PRODUCT_NAME }), signIn: t('signIn') }} />
      <main id="main">{children}</main>
      <PublicFooter labels={{ menu: t('footer'), profile: t('profile'), privacy: t('privacy'), dataProcessing: t('dataProcessing'), signIn: t('signIn') }} />
    </>
  )
}
