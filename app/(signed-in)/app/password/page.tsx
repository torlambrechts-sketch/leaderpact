import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { NewPasswordForm } from '@/components/auth/NewPasswordForm'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { SIGN_IN_PATH } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('newPasswordTitle', { product: PRODUCT_NAME }) }
}

/** Setting a new password (D-57): where the reset link lands once its button has signed the person in */
export default async function NewPasswordPage() {
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const t = await getTranslations('newPassword')
  return (
    <div className="mx-auto mt-6 max-w-[520px] px-4 md:mt-12">
      <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{t('heading')}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('lead')}</p>
        <ClientMessages namespaces={['newPassword']}>
          <NewPasswordForm />
        </ClientMessages>
      </section>
    </div>
  )
}
