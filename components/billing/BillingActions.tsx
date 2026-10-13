'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cancelSubscription, devBillingEvent, startTrial, withdrawCancel } from '@/lib/billing/actions'
import type { BillingResult } from '@/lib/billing/schema'

type Said = 'idle' | 'busy' | 'failed'
const failed = { ok: false as const, reason: 'failed' as const }

/** One write, then the page is read again; a failure is said in words, and nothing else changes */
function useWrite() {
  const router = useRouter()
  const [said, setSaid] = React.useState<Said>('idle')
  async function run(write: () => Promise<BillingResult>) {
    setSaid('busy')
    const result = await write().catch(() => failed)
    if (!result.ok) return setSaid('failed')
    setSaid('idle')
    router.refresh()
  }
  return { said, run }
}

function Failure({ said, text }: { said: Said; text: string }) {
  if (said !== 'failed') return null
  return (
    <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
      {text}
    </p>
  )
}

/** The group's one Team trial (owner D2a), from the Team card: no billing details */
export function StartTrial({ group, days }: { group: string; days: number }) {
  const t = useTranslations('billing')
  const { said, run } = useWrite()
  return (
    <>
      <Button variant="secondary" disabled={said === 'busy'} onClick={() => run(() => startTrial({ group }))}>
        {said === 'busy' ? t('trialStarting') : t('trialStart', { days })}
      </Button>
      <Failure said={said} text={t('writeFailed')} />
    </>
  )
}

/**
 * Switch to Free (design `settings`, plan tab: "Switch {group} to Free?"): asked once more on the page,
 * with what stops at the end of the paid period, or at once while a payment is owed (`until` null), and
 * how long its data is kept.
 */
export function SwitchToFree({ group, groupName, until, retentionDays }: { group: string; groupName: string; until: string | null; retentionDays: number }) {
  const t = useTranslations('billing')
  const { said, run } = useWrite()
  const [asking, setAsking] = React.useState(false)
  const ask = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (asking) ask.current?.focus()
  }, [asking])

  if (!asking) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setAsking(true)}>
        {t('switchFree')}
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-3 rounded-option border-[1.5px] border-danger-border bg-flag-bg p-4">
      <h3 ref={ask} tabIndex={-1} className="m-0 text-[15px] font-bold focus-visible:outline-none">
        {t('switchAsk', { group: groupName })}
      </h3>
      <p className="m-0 text-[13.5px] leading-[1.5] max-md:text-[15px]">
        {until ? t('switchBody', { date: until, days: retentionDays }) : t('switchBodyNow', { days: retentionDays })}
      </p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {(['switchLose1', 'switchLose2', 'switchLose3', 'switchLose4'] as const).map((k) => (
          <li key={k} className="flex items-center gap-2 text-[13.5px] max-md:text-[15px]">
            <Minus aria-hidden size={15} className="shrink-0" />
            {t(k)}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={said === 'busy'} onClick={() => setAsking(false)}>
          {t('switchKeep')}
        </Button>
        <Button variant="danger" disabled={said === 'busy'} onClick={() => run(() => cancelSubscription({ group }))}>
          {said === 'busy' ? t('switching') : t('switchConfirm')}
        </Button>
      </div>
      <Failure said={said} text={t('writeFailed')} />
    </div>
  )
}

/** Withdraw a cancel before it takes effect */
export function KeepTeam({ group }: { group: string }) {
  const t = useTranslations('billing')
  const { said, run } = useWrite()
  return (
    <>
      <Button className="self-start" disabled={said === 'busy'} onClick={() => run(() => withdrawCancel({ group }))}>
        {t('keepTeam')}
      </Button>
      <Failure said={said} text={t('writeFailed')} />
    </>
  )
}

export type DevEvent = 'trial_ended' | 'payment_failed' | 'grace_ended' | 'payment_received'

/**
 * The development adapter's later events (handoff 3: "succeeds or fails on demand"), so grace, read-only and
 * a trial's end can be seen and tested. The database refuses them unless it runs that adapter (0013).
 */
export function DevEvents({ group, events }: { group: string; events: DevEvent[] }) {
  const t = useTranslations('billing')
  const { said, run } = useWrite()
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {events.map((event) => (
          <Button key={event} variant="secondary" size="compact" disabled={said === 'busy'} onClick={() => run(() => devBillingEvent({ group, event }))}>
            {t(`dev_${event}`)}
          </Button>
        ))}
      </div>
      <Failure said={said} text={t('writeFailed')} />
    </>
  )
}
