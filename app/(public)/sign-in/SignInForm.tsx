'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { MailCheck } from 'lucide-react'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { requestSignInLink } from '@/lib/auth/actions'
import { emailSchema } from '@/lib/auth/schema'
import { SCAN_PATH } from '@/lib/routes'

type State = { kind: 'form'; error?: 'invalid' | 'rate_limited' | 'failed' } | { kind: 'sending' } | { kind: 'sent'; email: string }

/**
 * The sign-in form: one email field. It never says whether an address has an account: an unknown address
 * reads "if it has an account, a link is on its way", as a known one does (lib/auth/actions.ts).
 */
export function SignInForm() {
  const t = useTranslations('signIn')
  const [state, setState] = React.useState<State>({ kind: 'form' })
  const [email, setEmail] = React.useState('')
  const heading = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    if (state.kind === 'sent') heading.current?.focus()
  }, [state.kind])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) return setState({ kind: 'form', error: 'invalid' })
    setState({ kind: 'sending' })
    const result = await requestSignInLink({ email: parsed.data, intent: 'sign_in' }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setState(result.ok ? { kind: 'sent', email: parsed.data } : { kind: 'form', error: result.reason })
  }

  if (state.kind === 'sent') {
    return (
      <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
        <MailCheck aria-hidden size={28} className="text-ink" />
        <h1 ref={heading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {t('sentTitle')}
        </h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('sentBody', { email: state.email })}</p>
        <Button variant="secondary" className="mt-2 self-start" onClick={() => setState({ kind: 'form' })}>
          {t('another')}
        </Button>
      </section>
    )
  }

  const error = state.kind === 'form' ? state.error : undefined
  return (
    <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-9">
      <h1 className="m-0 font-display text-page-title max-md:text-[28px]">{t('heading')}</h1>
      <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('lead')}</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          label={t('emailLabel')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error === 'invalid' ? t('invalid') : undefined}
        />
        {error && error !== 'invalid' && (
          <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
            {t(error === 'rate_limited' ? 'rateLimited' : 'failed')}
          </p>
        )}
        <Button type="submit" size="large" disabled={state.kind === 'sending'} className="self-start">
          {state.kind === 'sending' ? t('sending') : t('submit')}
        </Button>
      </form>
      <p className="m-0 border-t border-rule-softer pt-4 text-[13.5px] text-text-2 max-md:text-[15px]">
        {t('noAccount')}{' '}
        <Link href={SCAN_PATH as Route} className="text-link font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
          {t('startScan')}
        </Link>
      </p>
    </section>
  )
}
