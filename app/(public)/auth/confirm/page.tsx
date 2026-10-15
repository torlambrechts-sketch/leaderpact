import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { NOINDEX } from '@/lib/site/meta'
import { authCodeSchema, confirmSchema } from '@/lib/auth/schema'
import { OAUTH_CALLBACK_PATH, SIGN_IN_PATH } from '@/lib/routes'
import { ConfirmForm } from './ConfirmForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('confirmTitle', { product: PRODUCT_NAME }), robots: NOINDEX }
}

/**
 * Where the email link lands (supabase/templates). Opening it signs nobody in: a button does, on a POST,
 * so a mail scanner that opens the link first does not use it up (REUSE 4.15). A link without its token
 * is said to be incomplete, and nothing is sent. A code instead of a token comes from a mail whose link passed
 * through Auth (Supabase's default template), and goes on to be exchanged (D-58).
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const link = confirmSchema.safeParse({ token_hash: params.token_hash, type: params.type })
  const code = authCodeSchema.safeParse(params.code)
  if (!link.success && code.success) redirect(`${OAUTH_CALLBACK_PATH}?${new URLSearchParams({ code: code.data })}` as Route)
  const t = await getTranslations('confirm')
  return (
    <div className="mx-auto mt-6 max-w-[520px] px-4 md:mt-12">
      {link.success ? (
        <ClientMessages namespaces={['confirm']}>
          <ConfirmForm tokenHash={link.data.token_hash} type={link.data.type} product={PRODUCT_NAME} />
        </ClientMessages>
      ) : (
        <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
          <h1 className="m-0 font-display text-sub-headline">{t('incompleteTitle')}</h1>
          <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('incompleteBody')}</p>
          <Link href={SIGN_IN_PATH as Route} className="text-link self-start text-[15px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
            {t('newLink')}
          </Link>
        </section>
      )}
    </div>
  )
}
