'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { PasswordField } from '@/components/auth/PasswordField'
import { Button } from '@/components/ui/button'
import { setNewPassword } from '@/lib/auth/password'
import { PASSWORD_MIN, passwordSchema } from '@/lib/auth/schema'

type State = { kind: 'form'; error?: 'invalid' | 'weak_password' | 'same_password' | 'signed_out' | 'failed' } | { kind: 'saving' }

/** A new password, after the reset link signed the person in (D-57); a success goes on to their group */
export function NewPasswordForm() {
  const t = useTranslations('newPassword')
  const [state, setState] = React.useState<State>({ kind: 'form' })
  const [password, setPassword] = React.useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!passwordSchema.safeParse(password).success) return setState({ kind: 'form', error: 'invalid' })
    setState({ kind: 'saving' })
    const result = await setNewPassword({ password }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setState({ kind: 'form', error: result.reason })
  }

  const error = state.kind === 'form' ? state.error : undefined
  const fieldError =
    error === 'invalid' ? t('invalid', { min: PASSWORD_MIN }) : error === 'weak_password' ? t('weak') : error === 'same_password' ? t('same') : undefined
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <PasswordField
        id="new-password"
        name="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={72}
        label={t('label')}
        hint={t('hint', { min: PASSWORD_MIN })}
        showLabel={t('show')}
        hideLabel={t('hide')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldError}
      />
      {(error === 'signed_out' || error === 'failed') && (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
          {t(error === 'signed_out' ? 'signedOut' : 'failed')}
        </p>
      )}
      <Button type="submit" size="large" disabled={state.kind === 'saving'} className="self-start">
        {state.kind === 'saving' ? t('saving') : t('submit')}
      </Button>
    </form>
  )
}
