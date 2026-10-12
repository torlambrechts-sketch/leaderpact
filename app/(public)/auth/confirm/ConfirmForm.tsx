'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { confirmSignIn } from '@/lib/auth/actions'
import { SIGN_IN_PATH } from '@/lib/routes'

/** The button that signs in, with the link's token in hidden fields; on success the action redirects */
export function ConfirmForm({ tokenHash, type, product }: { tokenHash: string; type: string; product: string }) {
  const t = useTranslations('confirm')
  const [state, action, pending] = React.useActionState(confirmSignIn, null)

  if (state?.problem === 'expired') {
    return (
      <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <h1 className="m-0 font-display text-sub-headline">{t('expiredTitle')}</h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('expiredBody')}</p>
        <Link href={SIGN_IN_PATH as Route} className="text-link self-start text-[15px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
          {t('newLink')}
        </Link>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
      <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{t('heading')}</h1>
      <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('body', { product })}</p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        {state?.problem === 'failed' && (
          <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
            {t('failed')}
          </p>
        )}
        <Button type="submit" size="large" disabled={pending} className="self-start">
          {pending ? t('working') : t('submit')}
        </Button>
      </form>
    </section>
  )
}
