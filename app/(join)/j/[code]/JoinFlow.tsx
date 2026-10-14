'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, CircleCheck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScanFlow } from '@/app/(public)/scan/ScanFlow'
import { PersonalCard } from '@/app/(public)/scan/result/PersonalView'
import { readReplaceKey, writeReplaceKey } from '@/lib/scan/device'
import { deviceStore, forget, joinDraftKey, readDraft } from '@/lib/scan/draft'
import { isComplete, personalView, type Scan } from '@/lib/scan/model'
import { submitScan } from '@/lib/scan/post'

type Step =
  | { kind: 'reading' }
  | { kind: 'intro'; started: boolean; notice?: 'invalid' }
  | { kind: 'questions' }
  | { kind: 'review'; answers: Record<string, number>; sending?: boolean; failed?: boolean; wait?: number }
  | { kind: 'done'; closed: boolean }
  | { kind: 'refused'; reason: 'closed' | 'full' | 'not_found' }

/**
 * The member's way through the group's link (handoff 6.5): an intro that says how answers are kept and
 * when the team view opens, the 12 questions with their own draft on this device, the personal view with
 * "Submit anonymously", and then the confirmation.
 *
 * - **Submitting stores the answers under no person** (`submit_scan`, as a visitor: lib/scan/submit.ts).
 * - **The same browser replaces its answers** until the scan closes, with the random key the database
 *   returned, which this device keeps (owner C2). It is not a person id.
 * - **After submitting the device keeps only that key**: the draft is removed (REUSE 4.4 c).
 */
export function JoinFlow({
  code,
  scan,
  group,
  answered,
  total,
  closes,
}: {
  code: string
  scan: Scan
  group: string
  answered: number
  total: number
  closes: string
}) {
  const t = useTranslations('join')
  const [step, setStep] = React.useState<Step>({ kind: 'reading' })
  const draftKey = joinDraftKey(code)
  const heading = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    const store = deviceStore()
    const draft = readDraft(store, scan, new Date(), draftKey)
    if (draft && isComplete(scan, draft.answers)) setStep({ kind: 'review', answers: { ...draft.answers } })
    else if (!draft && readReplaceKey(store, code)) setStep({ kind: 'done', closed: false })
    else setStep({ kind: 'intro', started: !!draft && Object.keys(draft.answers).length > 0 })
  }, [scan, code, draftKey])

  // a new step's heading takes focus, so a screen reader starts there
  const stepKind = step.kind
  const moved = React.useRef(false)
  React.useEffect(() => {
    if (moved.current) heading.current?.focus()
    if (stepKind !== 'reading') moved.current = true
  }, [stepKind])

  async function submit(answers: Record<string, number>) {
    setStep({ kind: 'review', answers, sending: true })
    const store = deviceStore()
    const result = await submitScan({
      code,
      answers: scan.items.map((item) => ({ item: item.id, value: answers[item.id] as number })),
      replaceKey: readReplaceKey(store, code),
    }).catch(() => ({ ok: false as const, reason: 'failed' as const }))

    if (result.ok) {
      writeReplaceKey(store, code, result.replaceKey)
      forget(store, draftKey)
      return setStep({ kind: 'done', closed: result.replaceKey === null })
    }
    if (result.reason === 'invalid') {
      forget(store, draftKey)
      return setStep({ kind: 'intro', started: false, notice: 'invalid' })
    }
    if (result.reason === 'failed') return setStep({ kind: 'review', answers, failed: true })
    // past 60 an hour from this network (handoff 8): the answers stay on the device, and are sent later
    if (result.reason === 'rate_limited') return setStep({ kind: 'review', answers, wait: Math.max(1, Math.ceil(result.retry / 60)) })
    writeReplaceKey(store, code, null)
    setStep({ kind: 'refused', reason: result.reason })
  }

  if (step.kind === 'reading') return <div aria-busy className="mx-auto mt-6 min-h-[480px] max-w-questionnaire px-4 md:mt-10" />

  if (step.kind === 'questions') {
    return (
      <ScanFlow
        scan={scan}
        draftKey={draftKey}
        leaveHref={`/j/${code}`}
        onLeave={() => setStep({ kind: 'intro', started: true })}
        onFinish={(answers) => setStep({ kind: 'review', answers })}
      />
    )
  }

  if (step.kind === 'review') {
    const scores = personalView(scan, step.answers)
    return (
      <div className="mx-auto mt-6 grid max-w-[1040px] items-start gap-6 px-4 md:mt-9 min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {scores && <PersonalCard scores={scores} />}
        <section aria-labelledby="submit-title" className="flex flex-col gap-3.5 rounded-card-lg border border-white bg-surface p-6 md:p-8">
          <ShieldCheck aria-hidden size={28} className="text-ink" />
          <h2 id="submit-title" className="m-0 font-display text-sub-headline">
            {t('submitTitle')}
          </h2>
          <p className="m-0 text-[14px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('submitBody')}</p>
          {step.failed && (
            <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
              {t('failed')}
            </p>
          )}
          {step.wait !== undefined && (
            <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
              {t('rateLimited', { minutes: step.wait })}
            </p>
          )}
          <Button size="large" className="w-full font-bold" disabled={step.sending} onClick={() => submit(step.answers)}>
            {step.sending ? t('submitting') : t('submit')}
          </Button>
          <Button variant="secondary" className="self-start" disabled={step.sending} onClick={() => setStep({ kind: 'questions' })}>
            {t('change')}
          </Button>
        </section>
      </div>
    )
  }

  if (step.kind === 'done') {
    return (
      <Card>
        <CircleCheck aria-hidden size={28} className="text-ink" />
        <h1 ref={heading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {t('doneTitle')}
        </h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('doneBody')}</p>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{step.closed ? t('doneClosed') : t('doneReplace')}</p>
        {!step.closed && (
          <Button variant="secondary" className="mt-1 self-start" onClick={() => setStep({ kind: 'questions' })}>
            {t('again')}
          </Button>
        )}
      </Card>
    )
  }

  if (step.kind === 'refused') {
    const [title, body] =
      step.reason === 'full'
        ? [t('fullTitle'), t('fullBody', { total })]
        : step.reason === 'closed'
          ? [t('closedTitle'), t('closedNow')]
          : [t('notFoundTitle'), t('notFoundBody')]
    return (
      <Card>
        <h1 ref={heading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {title}
        </h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{body}</p>
      </Card>
    )
  }

  return (
    <Card>
      <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{t('eyebrow', { group })}</p>
      <h1 ref={heading} tabIndex={-1} className="-mt-1 mb-0 font-display text-page-title focus-visible:outline-none max-md:text-[28px]">
        {t('heading')}
      </h1>
      <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('lead', { count: scan.items.length })}</p>
      {step.notice === 'invalid' && (
        <p role="alert" className="m-0 text-[14px] font-semibold text-danger max-md:text-[15px]">
          {t('invalid')}
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-option bg-surface-sunk p-4">
        <h2 className="m-0 text-[14.5px] font-bold">{t('storedTitle')}</h2>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-[1.5] text-text-body max-md:text-[15px]">
          <li>{t('storedDevice')}</li>
          <li>{t('storedNoName')}</li>
          <li>{t('storedCount')}</li>
          <li>{t('storedOpens', { total, date: closes })}</li>
        </ul>
      </div>
      <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('count', { answered, total })}</p>
      <Button size="large" className="gap-2 self-start" onClick={() => setStep({ kind: 'questions' })}>
        {step.started ? t('resume') : t('start')}
        <ArrowRight aria-hidden size={16} />
      </Button>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-3.5 rounded-card-lg border border-white bg-surface p-6 md:p-9">{children}</section>
    </div>
  )
}
