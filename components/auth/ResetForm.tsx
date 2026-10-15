'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { MailCheck } from 'lucide-react'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { requestPasswordReset } from '@/lib/auth/password'
import { emailSchema } from '@/lib/auth/schema'
import { SIGN_IN_PATH } from '@/lib/routes'

type State = { kind: 'form'; error?: 'invalid' | 'rate_limited' | 'failed' } | { kind: 'sending' } | { kind: 'sent'; email: string }

/** "Forgot your password?" (D-57): a link to set a new one, said the same way whether or not the address has an account */
export function ResetForm() {
  const t = useTranslations('reset')
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
    const result = await requestPasswordReset({ email: parsed.data }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setState(result.ok ? { kind: 'sent', email: parsed.data } : { kind: 'form', error: result.reason })
  }

  if (state.kind === 'sent') {
    return (
      <div className="flex flex-col gap-3">
        <MailCheck aria-hidden size={28} className="text-ink" />
        <h2 ref={heading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {t('sentTitle')}
        </h2>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('sentBody', { email: state.email })}</p>
      </div>
    )
  }

  const error = state.kind === 'form' ? state.error : undefined
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        id="reset-email"
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
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="large" disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? t('sending') : t('submit')}
        </Button>
        <Link href={SIGN_IN_PATH as Route} className="text-link text-[13.5px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center max-md:text-[15px]">
          {t('back')}
        </Link>
      </div>
    </form>
  )
}
