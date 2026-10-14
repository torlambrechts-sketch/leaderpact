import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Logo } from '@/components/lp/Logo'
import { PublicFooter } from '@/components/lp/PublicHeader'
import { PRODUCT_NAME } from '@/lib/brand'
import { LANDING_PATH } from '@/lib/routes'
import { NOINDEX } from '@/lib/site/meta'

/** The invite link carries a capability in its path: never indexed (D-33) */
export const metadata: Metadata = { robots: NOINDEX }

/**
 * The invite link's pages (handoff 6.5). A member came for their group's scan, so the bar holds the logo
 * only: the public menu's "Start the scan" would lead to a different scan from the one they were sent.
 * The footer's privacy and data-processing links stay, as on every public page.
 */
export default async function JoinLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('publicNav')
  return (
    <>
      <header className="flex justify-center px-4 pt-3 md:px-gutter md:pt-5">
        <div className="flex w-full max-w-[1080px] items-center rounded-pill border border-bar bg-bar py-2.5 pl-3.5 pr-2.5">
          <Link href={LANDING_PATH as Route} aria-label={t('home', { product: PRODUCT_NAME })} className="shrink-0 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
            <Logo name={PRODUCT_NAME} variant="public" />
          </Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <PublicFooter labels={{ menu: t('footer'), profile: t('profile'), privacy: t('privacy'), dataProcessing: t('dataProcessing'), signIn: t('signIn') }} />
    </>
  )
}
