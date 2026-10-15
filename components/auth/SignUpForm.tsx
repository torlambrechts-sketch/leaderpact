'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { MailCheck } from 'lucide-react'
import { PasswordField } from '@/components/auth/PasswordField'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { resendConfirmation, signUpWithPassword } from '@/lib/auth/password'
import { PASSWORD_MIN, signUpSchema } from '@/lib/auth/schema'
import { DATA_PROCESSING_PATH, PRIVACY_PATH, SIGN_IN_PATH } from '@/lib/routes'

const footLink = 'text-link font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center'

type Field = 'name' | 'email' | 'company' | 'password'
type State =
  | { kind: 'form'; fields?: Field[]; error?: 'weak_password' | 'rate_limited' | 'failed' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string; resent?: 'ok' | 'rate_limited' }

/**
 * Creating an account with a password (owner, 15 October 2026; D-57): name, work email, company and a password
 * of at least 10 characters. Auth mails a link to confirm the address; it comes back to the confirmation page,
 * whose button signs in, then on to making a group (`/app/new`). An address that already has an account reads
 * the same as a new one, so nobody learns which addresses have one. The name and company go to the account and
 * name the person and the organisation (0028).
 */
export function SignUpForm() {
  const t = useTranslations('signUp')
  const [state, setState] = React.useState<State>({ kind: 'form' })
  const [values, setValues] = React.useState({ name: '', email: '', company: '', password: '' })
  const heading = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (state.kind === 'sent') heading.current?.focus()
  }, [state.kind])

  const set = (key: Field) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }))

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = signUpSchema.safeParse(values)
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => i.path[0]))].filter((f): f is Field => ['name', 'email', 'company', 'password'].includes(String(f)))
      return setState({ kind: 'form', fields })
    }
    setState({ kind: 'sending' })
    const result = await signUpWithPassword(parsed.data).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (result.ok) return setState({ kind: 'sent', email: parsed.data.email })
    setState({ kind: 'form', fields: result.reason === 'invalid' ? ['email'] : undefined, error: result.reason === 'invalid' ? undefined : result.reason })
  }

  async function resend(email: string) {
    const result = await resendConfirmation({ email }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setState({ kind: 'sent', email, resent: result.ok ? 'ok' : result.reason === 'rate_limited' ? 'rate_limited' : undefined })
  }

  if (state.kind === 'sent') {
    return (
      <section className="flex flex-col gap-3">
        <MailCheck aria-hidden size={28} className="text-ink" />
        <h2 ref={heading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {t('sentTitle')}
        </h2>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('sentBody', { email: state.email })}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void resend(state.email)}>
            {t('resend')}
          </Button>
          <Button variant="secondary" onClick={() => setState({ kind: 'form' })}>
            {t('another')}
          </Button>
        </div>
        <p role="status" className="m-0 min-h-[1em] text-[13.5px] font-semibold max-md:text-[15px]">
          {state.resent === 'ok' ? t('resent') : state.resent === 'rate_limited' ? t('rateLimited') : null}
        </p>
      </section>
    )
  }

  const bad = (f: Field) => state.kind === 'form' && state.fields?.includes(f)
  const error = state.kind === 'form' ? state.error : undefined
  return (
    <section className="flex flex-col gap-4">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField id="sign-up-name" name="name" autoComplete="name" required maxLength={120} label={t('nameLabel')} value={values.name} onChange={set('name')} error={bad('name') ? t('invalidName') : undefined} />
        <TextField
          id="sign-up-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          label={t('emailLabel')}
          value={values.email}
          onChange={set('email')}
          error={bad('email') ? t('invalid') : undefined}
        />
        <TextField
          id="sign-up-company"
          name="company"
          autoComplete="organization"
          required
          maxLength={200}
          label={t('companyLabel')}
          value={values.company}
          onChange={set('company')}
          error={bad('company') ? t('invalidCompany') : undefined}
        />
        <PasswordField
          id="sign-up-password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={72}
          label={t('passwordLabel')}
          hint={t('passwordHint', { min: PASSWORD_MIN })}
          showLabel={t('showPassword')}
          hideLabel={t('hidePassword')}
          value={values.password}
          onChange={set('password')}
          error={bad('password') ? t('invalidPassword', { min: PASSWORD_MIN }) : error === 'weak_password' ? t('weakPassword') : undefined}
        />
        {error && error !== 'weak_password' && (
          <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
            {t(error === 'rate_limited' ? 'rateLimited' : 'failed')}
          </p>
        )}
        <p className="m-0 text-[13px] leading-[1.5] text-text-2 max-md:text-[15px]">
          {t.rich('terms', {
            privacy: (chunks) => (
              <Link href={PRIVACY_PATH as Route} className="text-link font-semibold text-ink underline underline-offset-2">
                {chunks}
              </Link>
            ),
            processing: (chunks) => (
              <Link href={DATA_PROCESSING_PATH as Route} className="text-link font-semibold text-ink underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </p>
        <Button type="submit" size="large" disabled={state.kind === 'sending'} className="self-start">
          {state.kind === 'sending' ? t('sending') : t('submit')}
        </Button>
      </form>
      <p className="m-0 border-t border-rule-softer pt-4 text-[13.5px] text-text-2 max-md:text-[15px]">
        {t('haveAccount')}{' '}
        <Link href={SIGN_IN_PATH as Route} className={footLink}>
          {t('signIn')}
        </Link>
      </p>
    </section>
  )
}
