import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { SignInForm } from './SignInForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('signInTitle', { product: PRODUCT_NAME }) }
}

/** Sign-in by email link (handoff section 5, `/sign-in`; section 8, Authentication). The design draws none. */
export default function SignInPage() {
  return (
    <div className="mx-auto mt-6 max-w-[520px] px-4 md:mt-12">
      <ClientMessages namespaces={['signIn']}>
        <SignInForm />
      </ClientMessages>
    </div>
  )
}
