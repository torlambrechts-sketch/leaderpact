'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/actions'
import { emailSchema } from '@/lib/auth/schema'
import { acceptInvitation, requestJoinLink } from '@/lib/group/actions'
import { forgetPendingJoin, readPendingJoin, writePendingJoin } from '@/lib/group/device'
import type { GroupReason } from '@/lib/group/schema'
import { deviceStore } from '@/lib/scan/draft'
import { homePath } from '@/lib/routes'

function reasonText(t: ReturnType<typeof useTranslations>, reason: GroupReason): string {
  switch (reason) {
    case 'other_address':
      return t('otherAddress')
    case 'full':
      return t('full')
    case 'expired':
    case 'revoked':
    case 'used':
    case 'unknown':
      return t('gone')
    case 'rate_limited':
      return t('rateLimited')
    case 'invalid':
      return t('invalidEmail')
    default:
      return t('failed')
  }
}

/**
 * Signed in: join the group. When this device sent the sign-in link for this invitation, joining runs at
 * once on the way back from the email; otherwise the person presses the button.
 */
export function JoinNow({ token, group, email }: { token: string; group: string; email: string }) {
  const t = useTranslations('invitation')
  const router = useRouter()
  const [state, setState] = React.useState<'idle' | 'busy'>('idle')
  const [problem, setProblem] = React.useState<GroupReason | null>(null)
  const started = React.useRef(false)

  const join = React.useCallback(async () => {
    setState('busy')
    setProblem(null)
    const result = await acceptInvitation(token).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    forgetPendingJoin(deviceStore())
    if (result.ok && result.team) return router.replace(homePath(result.team) as Route)
    setState('idle')
    setProblem(result.ok ? 'failed' : result.reason)
  }, [router, token])

  React.useEffect(() => {
    if (started.current) return
    started.current = true
    if (readPendingJoin(deviceStore(), new Date()) === token) void join()
  }, [join, token])

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 break-words text-[14px] max-md:text-[15px]">{t('signedInAs', { email })}</p>
      {problem && (
        <p role="alert" className="m-0 text-[14px] font-semibold text-danger max-md:text-[15px]">
          {reasonText(t, problem)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="large" disabled={state === 'busy'} onClick={join}>
          {state === 'busy' ? t('joining') : t('join', { group })}
        </Button>
        {problem === 'other_address' && (
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              {t('signOut')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

/**
 * Signed out: the address the invitation names gets a sign-in link, which may make the account. The device
 * keeps the token, so the way back from the email returns here and joins.
 */
export function JoinSignIn({ token }: { token: string }) {
  const t = useTranslations('invitation')
  const [email, setEmail] = React.useState('')
  const [state, setState] = React.useState<'idle' | 'busy' | 'sent'>('idle')
  const [problem, setProblem] = React.useState<GroupReason | null>(null)
  const sent = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (state === 'sent') sent.current?.focus()
  }, [state])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = emailSchema.safeParse(email)
    if (!address.success) return setProblem('invalid')
    setState('busy')
    setProblem(null)
    const result = await requestJoinLink({ token, email: address.data }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (!result.ok) {
      setState('idle')
      return setProblem(result.reason)
    }
    writePendingJoin(deviceStore(), token, new Date())
    setState('sent')
  }

  if (state === 'sent') {
    return (
      <p ref={sent} tabIndex={-1} role="status" className="m-0 rounded-btn bg-surface-soft px-4 py-3 text-[14.5px] font-semibold focus-visible:outline-none max-md:text-[15px]">
        {t('sent', { email })}
      </p>
    )
  }
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3">
      <TextField
        id="join-email"
        type="email"
        autoComplete="email"
        label={t('emailLabel')}
        hint={t('emailHint')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={problem ? reasonText(t, problem) : undefined}
        maxLength={254}
      />
      <Button type="submit" size="large" disabled={state === 'busy'} className="self-start">
        {state === 'busy' ? t('sending') : t('sendLink')}
      </Button>
    </form>
  )
}
