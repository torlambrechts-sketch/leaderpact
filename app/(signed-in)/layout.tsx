import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Logo } from '@/components/lp/Logo'
import { PRODUCT_NAME } from '@/lib/brand'
import { signOut } from '@/lib/auth/actions'
import { APP_PATH } from '@/lib/routes'

/**
 * The signed-in pages of milestone 4: making a group and its invite page. The app shell with its
 * navigation is milestone 6; until then the bar holds the logo and Sign out, so no link leads to a page
 * that does not exist (D-24). The middleware refuses these addresses without a session (D-04).
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('appShell')
  return (
    <>
      <header className="flex justify-center px-4 pt-3 md:px-gutter md:pt-5">
        <div className="flex min-h-[58px] w-full max-w-app items-center gap-3.5 rounded-pill border border-bar bg-bar py-2 pl-3.5 pr-2.5">
          <Link href={APP_PATH as Route} aria-label={t('home', { product: PRODUCT_NAME })} className="shrink-0 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
            <Logo name={PRODUCT_NAME} />
          </Link>
          <form action={signOut} className="ml-auto">
            <button type="submit" className="rounded-btn-sm px-3 py-[7px] text-[13px] font-semibold text-nav-ink hover:text-ink max-md:min-h-[44px]">
              {t('signOut')}
            </button>
          </form>
        </div>
      </header>
      <main id="main">{children}</main>
    </>
  )
}
