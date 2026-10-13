import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Logo } from '@/components/lp/Logo'
import { PRODUCT_NAME } from '@/lib/brand'
import { signOut } from '@/lib/auth/actions'
import { APP_PATH } from '@/lib/routes'

/**
 * The bar of a signed-in page outside a group: making a group, or a group that is not the person's. The
 * logo and Sign out only; inside a group the app shell's top bar takes over.
 */
export async function SimpleBar() {
  const t = await getTranslations('appShell')
  return (
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
  )
}
