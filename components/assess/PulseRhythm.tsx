'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { Card } from '@/components/lp/Card'
import { Button } from '@/components/ui/button'
import { setPulseRhythm, startPulses, stopPulses } from '@/lib/pulses/actions'
import { choices, windowsFor } from '@/lib/pulses/build'
import type { PulseActionResult } from '@/lib/pulses/schema'

/**
 * The group's pulse rhythm (handoff 6.16 and 8, Configuration): every 4 weeks unless set from 2 to 8, open for
 * 7 days unless set from 3 to 14, closing before the next is due. The leader starts it, which opens the first
 * pulse at once for every current member, changes it, or stops it; a pulse that is open runs to its close.
 * Everyone else reads the rhythm and the next date. The design's toggles for agreements and rotating items are
 * left out: the handoff fixes how a pulse is built.
 */
export function PulseRhythm({
  group,
  running,
  next,
  weeks,
  days,
  weeksRange,
  daysRange,
  canManage,
  leader,
  members,
  k,
  open,
  membersHref,
}: {
  group: string
  running: boolean
  /** the next pulse's date, as the reader reads it; null while stopped */
  next: string | null
  weeks: number
  days: number
  weeksRange: [number, number]
  daysRange: [number, number]
  canManage: boolean
  leader: boolean
  members: number
  k: number
  /** a round is answering now: pulses start when it closes */
  open: boolean
  membersHref: string
}) {
  const t = useTranslations('pulses')
  const router = useRouter()
  const id = React.useId()
  const [w, setW] = React.useState(weeks)
  const [d, setD] = React.useState(days)
  const [step, setStep] = React.useState<'idle' | 'edit' | 'start' | 'stop'>('idle')
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const ask = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (step === 'start' || step === 'stop') ask.current?.focus()
  }, [step])

  const windows = windowsFor(w, daysRange[0], daysRange[1])
  const field = 'h-11 w-full rounded-input border border-line bg-surface px-3 text-[14.5px] text-ink'

  function reason(r: Exclude<PulseActionResult, { ok: true }>) {
    return r.reason === 'too_few'
      ? t('tooFew', { k: r.k ?? k, members: r.members ?? members })
      : r.reason === 'open_round'
        ? t('refusedOpen')
        : r.reason === 'already'
          ? t('refusedAlready')
          : r.reason === 'not_running'
            ? t('refusedStopped')
            : r.reason === 'unavailable'
              ? t('refusedPlan')
              : r.reason === 'not_leader'
                ? t('refusedLeader')
                : r.reason === 'invalid'
                  ? t('refusedInvalid')
                  : t('failed')
  }

  async function run(action: () => Promise<PulseActionResult>) {
    setBusy(true)
    setProblem(null)
    const result = await action().catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    setStep('idle')
    if (!result.ok) setProblem(reason(result))
    router.refresh()
  }

  const pickers = (
    <div className="flex flex-wrap gap-3">
      <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
        <label htmlFor={`${id}-weeks`} className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">
          {t('weeksLabel')}
        </label>
        <select
          id={`${id}-weeks`}
          value={w}
          onChange={(e) => {
            const next = Number(e.target.value)
            setW(next)
            if (d >= next * 7) setD(Math.max(daysRange[0], next * 7 - 1))
          }}
          className={field}
        >
          {choices(weeksRange[0], weeksRange[1]).map((n) => (
            <option key={n} value={n}>
              {t('weeksOption', { count: n })}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
        <label htmlFor={`${id}-days`} className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">
          {t('daysLabel')}
        </label>
        <select id={`${id}-days`} value={d} onChange={(e) => setD(Number(e.target.value))} className={field}>
          {windows.map((n) => (
            <option key={n} value={n}>
              {t('daysOption', { count: n })}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  return (
    <Card large className="flex flex-col gap-3">
      <h2 className="m-0 text-[16px] font-bold">{t('title')}</h2>
      <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">
        {running && next ? t('runningNext', { weeks, days, date: next }) : running ? t('running', { weeks, days }) : t('stopped')}
      </p>
      {problem && (
        <p role="alert" className="m-0 rounded-btn bg-flag-bg px-4 py-3 text-[13.5px] font-semibold max-md:text-[15px]">
          {problem}
        </p>
      )}

      {!canManage ? (
        leader ? (
          <p className="m-0 flex items-center gap-2 rounded-btn bg-surface px-3.5 py-3 text-[13px] text-text-2 max-md:text-[15px]">
            <Lock aria-hidden size={15} className="shrink-0 text-ink" />
            {t('refusedPlan')}
          </p>
        ) : (
          !running && <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('leaderStarts')}</p>
        )
      ) : !running && members < k ? (
        <>
          <p className="m-0 text-[13.5px] font-semibold max-md:text-[15px]">{t('tooFew', { k, members })}</p>
          <Link href={membersHref as Route} className="self-start text-[13.5px] font-bold underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center max-md:text-[15px]">
            {t('inviteMembers')}
          </Link>
        </>
      ) : !running && open ? (
        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('refusedOpen')}</p>
      ) : !running ? (
        step === 'start' ? (
          <div className="flex flex-col gap-3 rounded-option border-[1.5px] border-line-strong bg-surface-soft p-4">
            <p ref={ask} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
              {t('startAsk', { members })}
            </p>
            <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('startAskBody', { weeks: w, days: d })}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => run(() => startPulses({ group, weeks: w, days: d }))}>
                {busy ? t('starting') : t('startConfirm')}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setStep('idle')}>
                {t('notYet')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {pickers}
            <Button className="self-start" onClick={() => setStep('start')}>
              {t('start')}
            </Button>
          </>
        )
      ) : step === 'edit' ? (
        <div className="flex flex-col gap-3">
          {pickers}
          <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('changeNote')}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => run(() => setPulseRhythm({ group, weeks: w, days: d }))}>
              {busy ? t('saving') : t('save')}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setW(weeks)
                setD(days)
                setStep('idle')
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : step === 'stop' ? (
        <div className="flex flex-col gap-3 rounded-option border-[1.5px] border-line-strong bg-surface-soft p-4">
          <p ref={ask} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
            {t('stopAsk')}
          </p>
          <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('stopAskBody')}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => run(() => stopPulses({ group }))}>
              {busy ? t('stopping') : t('stopConfirm')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setStep('idle')}>
              {t('notYet')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setStep('edit')}>
            {t('change')}
          </Button>
          <Button variant="secondary" onClick={() => setStep('stop')}>
            {t('stop')}
          </Button>
        </div>
      )}
    </Card>
  )
}
