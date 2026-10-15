import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ResetForm } from '@/components/auth/ResetForm'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { NOINDEX } from '@/lib/site/meta'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('resetTitle', { product: PRODUCT_NAME }), robots: NOINDEX }
}

/** Asking for a link to set a new password (D-57); the link signs the person in to `/app/password` */
export default async function ResetPage() {
  const t = await getTranslations('reset')
  return (
    <div className="mx-auto mt-6 max-w-[520px] px-4 md:mt-12">
      <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{t('heading')}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('lead')}</p>
        <ClientMessages namespaces={['reset']}>
          <ResetForm />
        </ClientMessages>
      </section>
    </div>
  )
}
