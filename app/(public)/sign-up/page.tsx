import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SignInForm } from '@/app/(public)/sign-in/SignInForm'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { NOINDEX } from '@/lib/site/meta'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('signUpTitle', { product: PRODUCT_NAME }), robots: NOINDEX }
}

/**
 * An account without the scan (owner, 14 October 2026; D-44): for someone who wants to try the product, a
 * mentor, or HR, who is not answering as part of a leadership group. The email link makes the account; after
 * it, the person makes a group, joins one by invitation, or takes the Leader Profile (`/app/new`).
 */
export default function SignUpPage() {
  return (
    <div className="mx-auto mt-6 max-w-[520px] px-4 md:mt-12">
      <ClientMessages namespaces={['signUp']}>
        <SignInForm mode="sign_up" />
      </ClientMessages>
    </div>
  )
}
