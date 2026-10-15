import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ProviderButtons } from '@/components/auth/ProviderButtons'
import { SignUpForm } from '@/components/auth/SignUpForm'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { enabledProviders } from '@/lib/auth/providers'
import { NOINDEX } from '@/lib/site/meta'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('signUpTitle', { product: PRODUCT_NAME }), robots: NOINDEX }
}

/**
 * Creating an account (owner, 15 October 2026; D-57, after D-44): Google or Microsoft where the Auth project has
 * turned them on, or name, work email, company and a password. No scan is needed: after it, the person makes a
 * group, joins one by invitation, or takes the Leader Profile (`/app/new`).
 */
export default async function SignUpPage() {
  const [t, providers] = await Promise.all([getTranslations('signUp'), enabledProviders()])
  return (
    <div className="mx-auto mt-6 max-w-[520px] px-4 md:mt-12">
      <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{t('heading')}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('lead')}</p>
        <ProviderButtons providers={providers} />
        <ClientMessages namespaces={['signUp']}>
          <SignUpForm />
        </ClientMessages>
      </section>
    </div>
  )
}
