'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { MailCheck } from 'lucide-react'
import { SizeStepper } from '@/components/lp/SizeStepper'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { requestSignInLink } from '@/lib/auth/actions'
import { emailSchema } from '@/lib/auth/schema'
import { GROUP_MAX, GROUP_MIN, groupNameSchema } from '@/lib/groups/schema'
import { deviceStore } from '@/lib/scan/draft'
import { readSave, writeSave } from '@/lib/scan/device'

type Problem = 'email' | 'name' | 'rate_limited' | 'failed'
type State = { kind: 'form'; problems?: Problem[] } | { kind: 'sending' } | { kind: 'sent'; email: string }

/** The design's starting size, which the leader changes with the stepper (design `personal`) */
const START_SIZE = 8

/**
 * The save card (handoff 6.3, design `personal`, right card): email, group name and the number of
 * members, 4 to 15 with the leader included (owner C4). Saving asks for a sign-in link that may make an
 * account (an existing address signs in and adds the group, handoff 6.3), and keeps the group's name and
 * size on this device for when the link is opened (lib/scan/device.ts). No answer and no address leaves
 * the device here: the answers go to the group's scan once it exists (D-15).
 *
 * The card is the design's ink gradient; focus inside it is a white outline (`on-ink`), since the ink
 * one would not show.
 */
export function SaveCard() {
  const t = useTranslations('save')
  const [state, setState] = React.useState<State>({ kind: 'form' })
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [size, setSize] = React.useState(START_SIZE)
  const sentHeading = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    // a save already on this device (the link did not arrive, say) fills the card again
    const saved = readSave(deviceStore(), new Date())
    if (saved) {
      setName(saved.name)
      setSize(saved.size)
    }
  }, [])

  React.useEffect(() => {
    if (state.kind === 'sent') sentHeading.current?.focus()
  }, [state.kind])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = emailSchema.safeParse(email)
    const group = groupNameSchema.safeParse(name)
    const problems: Problem[] = [...(address.success ? [] : ['email' as const]), ...(group.success ? [] : ['name' as const])]
    if (!address.success || !group.success) return setState({ kind: 'form', problems })

    const store = deviceStore()
    const now = new Date()
    // the same request id while the save stands, so one save never makes two groups (0009)
    const request = readSave(store, now)?.request ?? crypto.randomUUID()
    writeSave(store, { name: group.data, size, request }, now)

    setState({ kind: 'sending' })
    const result = await requestSignInLink({ email: address.data, intent: 'save' }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (result.ok) return setState({ kind: 'sent', email: address.data })
    setState({ kind: 'form', problems: [result.reason === 'invalid' ? 'email' : result.reason] })
  }

  const card = 'on-ink flex flex-col gap-4 rounded-card-lg bg-[linear-gradient(160deg,var(--ink-raised),var(--ink))] p-6 text-white md:p-8'

  if (state.kind === 'sent') {
    return (
      <section className={card}>
        <MailCheck aria-hidden size={28} />
        <h2 ref={sentHeading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {t('sentTitle')}
        </h2>
        <p className="m-0 text-[14.5px] leading-[1.55] max-md:text-[15px]">{t('sentBody', { email: state.email })}</p>
        <p className="m-0 text-[14.5px] leading-[1.55] text-white/85 max-md:text-[15px]">{t('sameDevice')}</p>
        <Button variant="on-ink" className="mt-1 self-start" onClick={() => setState({ kind: 'form' })}>
          {t('another')}
        </Button>
      </section>
    )
  }

  const problems = state.kind === 'form' ? (state.problems ?? []) : []
  const general = problems.find((p) => p === 'rate_limited' || p === 'failed')
  return (
    <section aria-labelledby="save-title" className={card}>
      <h2 id="save-title" className="m-0 font-display text-sub-headline">
        {t('title')}
      </h2>
      <p className="m-0 text-[13.5px] leading-[1.5] text-white/90 max-md:text-[15px]">{t('lead')}</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          id="save-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          tone="ink"
          label={t('emailLabel')}
          hint={t('emailHint')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={problems.includes('email') ? t('invalidEmail') : undefined}
        />
        <TextField
          id="save-name"
          name="group"
          autoComplete="organization"
          required
          maxLength={120}
          tone="ink"
          label={t('nameLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={problems.includes('name') ? t('invalidName') : undefined}
        />
        <SizeStepper
          id="save-size"
          tone="ink"
          label={t('sizeLabel')}
          hint={t('sizeHint')}
          value={size}
          min={GROUP_MIN}
          max={GROUP_MAX}
          onChange={setSize}
          fewerLabel={t('fewer')}
          moreLabel={t('more')}
        />
        {general && (
          <p role="alert" className="m-0 text-[13.5px] font-semibold max-md:text-[15px]">
            {t(general === 'rate_limited' ? 'rateLimited' : 'failed')}
          </p>
        )}
        <Button type="submit" variant="on-ink" size="large" disabled={state.kind === 'sending'} className="w-full font-bold">
          {state.kind === 'sending' ? t('sending') : t('submit')}
        </Button>
      </form>
    </section>
  )
}
