import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ProviderButtons } from '@/components/auth/ProviderButtons'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { enabledProviders } from '@/lib/auth/providers'
import { NOINDEX } from '@/lib/site/meta'
import { SignInForm } from './SignInForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('signInTitle', { product: PRODUCT_NAME }), robots: NOINDEX }
}

/**
 * Signing in (handoff section 5, `/sign-in`; owner, 15 October 2026, D-57): Google and Microsoft where the Auth
 * project has turned them on, then email and password, with the email link and a password reset as the other
 * ways in. A provider that refused or failed comes back here with `?problem=provider`, which the page says.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [t, providers, params] = await Promise.all([getTranslations('signIn'), enabledProviders(), searchParams])
  return (
    <div className="mx-auto mt-6 max-w-[520px] px-4 md:mt-12">
      <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{t('heading')}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('lead', { product: PRODUCT_NAME })}</p>
        {params.problem === 'provider' && (
          <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
            {t('providerFailed')}
          </p>
        )}
        <ProviderButtons providers={providers} />
        <ClientMessages namespaces={['signIn']}>
          <SignInForm />
        </ClientMessages>
      </section>
    </div>
  )
}
