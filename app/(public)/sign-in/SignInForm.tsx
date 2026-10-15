'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { MailCheck } from 'lucide-react'
import { PasswordField } from '@/components/auth/PasswordField'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { requestSignInLink } from '@/lib/auth/actions'
import { resendConfirmation, signInWithPassword } from '@/lib/auth/password'
import { emailSchema } from '@/lib/auth/schema'
import { RESET_PASSWORD_PATH, SCAN_PATH, SIGN_UP_PATH } from '@/lib/routes'

const footLink = 'text-link font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center'
const quiet = 'text-link self-start text-[13.5px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center max-md:text-[15px]'

type Mode = 'password' | 'link'
type State =
  | { kind: 'form'; error?: 'invalid' | 'wrong' | 'unconfirmed' | 'rate_limited' | 'failed'; resent?: boolean }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }

/**
 * Signing in (owner, 15 October 2026; D-57): email and password first, with "Forgot your password?" and the email
 * link of before as the other way in. Nothing it says tells whether an address has an account: a wrong password
 * and an unknown address read the same, and the link's answer is "if it has an account, a link is on its way"
 * (lib/auth/actions.ts). An address not yet confirmed is told so, with the confirmation mail again.
 */
export function SignInForm() {
  const t = useTranslations('signIn')
  const [mode, setMode] = React.useState<Mode>('password')
  const [state, setState] = React.useState<State>({ kind: 'form' })
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const sent = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    if (state.kind === 'sent') sent.current?.focus()
  }, [state.kind])

  function switchTo(next: Mode) {
    setMode(next)
    setState({ kind: 'form' })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = emailSchema.safeParse(email)
    if (!address.success) return setState({ kind: 'form', error: 'invalid' })
    setState({ kind: 'sending' })
    if (mode === 'link') {
      const result = await requestSignInLink({ email: address.data, intent: 'sign_in' }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
      return setState(result.ok ? { kind: 'sent', email: address.data } : { kind: 'form', error: result.reason })
    }
    // a success navigates on; only a refusal comes back
    const result = await signInWithPassword({ email: address.data, password }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setState({ kind: 'form', error: result.reason })
  }

  async function resend() {
    const address = emailSchema.safeParse(email)
    if (!address.success) return
    await resendConfirmation({ email: address.data }).catch(() => null)
    setState({ kind: 'form', error: 'unconfirmed', resent: true })
  }

  if (state.kind === 'sent') {
    return (
      <div className="flex flex-col gap-3">
        <MailCheck aria-hidden size={28} className="text-ink" />
        <h2 ref={sent} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {t('sentTitle')}
        </h2>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('sentBody', { email: state.email })}</p>
        <Button variant="secondary" className="mt-2 self-start" onClick={() => setState({ kind: 'form' })}>
          {t('another')}
        </Button>
      </div>
    )
  }

  const error = state.kind === 'form' ? state.error : undefined
  return (
    <div className="flex flex-col gap-4">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete={mode === 'password' ? 'username' : 'email'}
          inputMode="email"
          required
          label={t('emailLabel')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error === 'invalid' ? t('invalid') : undefined}
        />
        {mode === 'password' ? (
          <div className="flex flex-col gap-1">
            <PasswordField
              id="sign-in-password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={72}
              label={t('passwordLabel')}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Link href={RESET_PASSWORD_PATH as Route} className={quiet}>
              {t('forgot')}
            </Link>
          </div>
        ) : (
          <p className="m-0 text-[14px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('linkLead')}</p>
        )}
        {error === 'unconfirmed' && (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">{state.kind === 'form' && state.resent ? t('resent') : t('unconfirmed')}</p>
            {state.kind === 'form' && !state.resent && (
              <Button variant="secondary" type="button" onClick={() => void resend()}>
                {t('resend')}
              </Button>
            )}
          </div>
        )}
        {error && error !== 'invalid' && error !== 'unconfirmed' && (
          <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
            {t(error === 'wrong' ? 'wrong' : error === 'rate_limited' ? 'rateLimited' : 'failed')}
          </p>
        )}
        <Button type="submit" size="large" disabled={state.kind === 'sending'} className="self-start">
          {state.kind === 'sending' ? t(mode === 'link' ? 'sending' : 'signingIn') : t(mode === 'link' ? 'submit' : 'submitPassword')}
        </Button>
      </form>
      <button type="button" onClick={() => switchTo(mode === 'password' ? 'link' : 'password')} className={quiet}>
        {mode === 'password' ? t('useLink') : t('usePassword')}
      </button>
      <div className="flex flex-col gap-1 border-t border-rule-softer pt-4 text-[13.5px] text-text-2 max-md:text-[15px]">
        <p className="m-0">
          {t('noAccount')}{' '}
          <Link href={SIGN_UP_PATH as Route} className={footLink}>
            {t('createAccount')}
          </Link>
        </p>
        <p className="m-0">
          {t('orScan')}{' '}
          <Link href={SCAN_PATH as Route} className={footLink}>
            {t('startScan')}
          </Link>
        </p>
      </div>
    </div>
  )
}
