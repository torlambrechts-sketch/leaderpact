'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { ArrowRight, CircleCheck, ShieldCheck } from 'lucide-react'
import { StatementFlow, type StatementLabels } from '@/components/respond/StatementFlow'
import { Button, buttonVariants } from '@/components/ui/button'
import { submitDiagnostic } from '@/lib/rounds/actions'
import { ROUND_DRAFT_DAYS, roundDraftKey } from '@/lib/rounds/draft'
import type { FormState } from '@/lib/rounds/schema'
import { deviceStore, forget, readDraft, writeDraft, type Draft } from '@/lib/scan/draft'

type Step =
  | { kind: 'reading' }
  | { kind: 'intro'; started: boolean; notice?: 'invalid' }
  | { kind: 'questions'; startAt?: number; gaps?: boolean }
  | { kind: 'review'; answers: Record<string, number>; sending?: boolean; failed?: boolean }
  | { kind: 'done' }
  | { kind: 'refused'; reason: Exclude<FormState, 'open'> }

/**
 * Answering the Full diagnostic or a pulse (handoff 6.11 and 6.16): an intro that names the round, its purpose, the number of
 * questions and how answers are kept; one question per screen in the round's mixed order; progress saved on
 * this device; a review page that lists the questions still without an answer and waits for them (owner
 * C8); then "Submit anonymously".
 *
 * - **Submitting stores the answers under a random id** and marks the person as having answered; the two
 *   are never linked (`submit_response`, lib/rounds/actions.ts). The payload is the round and the answers.
 * - **The device keeps the draft** under a key for this round and person (lib/rounds/draft.ts) until the
 *   answers are in, then removes it.
 */
export function RoundFlow({
  round,
  kind,
  number,
  person,
  version,
  state,
  items,
  group,
  closes,
  k,
  backHref,
}: {
  round: string
  /** a pulse names itself and says it is short (handoff 6.16); the Full diagnostic as before */
  kind: 'diagnostic' | 'pulse'
  number: number | null
  person: string
  version: string
  state: FormState
  items: { id: string; text: string }[]
  group: string
  closes: string | null
  k: number | null
  backHref: string
}) {
  const t = useTranslations('round')
  const ts = useTranslations('scan')
  const [step, setStep] = React.useState<Step>({ kind: 'reading' })
  const heading = React.useRef<HTMLHeadingElement>(null)
  const key = roundDraftKey(round, person)
  const form = React.useMemo(() => ({ versionId: version, items }), [version, items])
  const draft = React.useMemo(
    () => ({
      read: () => readDraft(deviceStore(), form, new Date(), key, ROUND_DRAFT_DAYS),
      write: (d: Draft) => void writeDraft(deviceStore(), form, d, new Date(), key),
    }),
    [form, key],
  )

  React.useEffect(() => {
    if (state !== 'open') {
      forget(deviceStore(), key)
      return setStep({ kind: 'refused', reason: state })
    }
    const saved = draft.read()
    setStep({ kind: 'intro', started: !!saved && Object.keys(saved.answers).length > 0 })
  }, [state, draft, key])

  // a new step's heading takes focus, so a screen reader starts there
  const stepKind = step.kind
  const moved = React.useRef(false)
  React.useEffect(() => {
    // each step starts at the top of the page, under the app's bar
    if (moved.current) window.scrollTo({ top: 0 })
    if (moved.current && stepKind !== 'questions') heading.current?.focus()
    if (stepKind !== 'reading') moved.current = true
  }, [stepKind])

  async function submit(answers: Record<string, number>) {
    setStep({ kind: 'review', answers, sending: true })
    const result = await submitDiagnostic({ round, answers: items.map((item) => ({ item: item.id, value: answers[item.id] as number })) }).catch(() => ({
      ok: false as const,
      reason: 'failed' as const,
    }))
    if (result.ok || result.reason === 'already_answered') {
      forget(deviceStore(), key)
      return setStep(result.ok ? { kind: 'done' } : { kind: 'refused', reason: 'answered' })
    }
    if (result.reason === 'failed') return setStep({ kind: 'review', answers, failed: true })
    forget(deviceStore(), key)
    if (result.reason === 'invalid') return setStep({ kind: 'intro', started: false, notice: 'invalid' })
    setStep({ kind: 'refused', reason: result.reason })
  }

  const labels: StatementLabels = {
    leave: t('leave'),
    progress: t('progress'),
    position: (n, total) => ts('position', { n, total }),
    options: { 1: ts('options.1'), 2: ts('options.2'), 3: ts('options.3'), 4: ts('options.4'), 5: ts('options.5') },
    back: ts('back'),
    next: ts('next'),
    finish: t('toReview'),
    footnote: t('onDevice'),
  }

  if (step.kind === 'reading') return <div aria-busy className="mx-auto mt-6 min-h-[480px] max-w-questionnaire px-4 md:mt-10" />

  if (step.kind === 'questions') {
    return (
      <StatementFlow
        items={items}
        draft={draft}
        leaveHref={backHref}
        onLeave={() => setStep({ kind: 'intro', started: true })}
        onFinish={(answers) => setStep({ kind: 'review', answers })}
        labels={labels}
        allowSkip
        startAt={step.startAt}
        gapToGap={step.gaps}
      />
    )
  }

  if (step.kind === 'review') {
    const gaps = items.map((item, i) => ({ ...item, n: i + 1 })).filter((item) => step.answers[item.id] === undefined)
    return (
      <Frame>
        <ShieldCheck aria-hidden size={28} className="text-ink" />
        <h1 ref={heading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {t('reviewTitle')}
        </h1>
        {gaps.length > 0 ? (
          <>
            <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('gaps', { count: gaps.length })}</p>
            <ul aria-label={t('gapsLabel')} className="m-0 flex list-none flex-col gap-2 p-0">
              {gaps.map((gap) => (
                <li key={gap.id}>
                  <button
                    type="button"
                    onClick={() => setStep({ kind: 'questions', startAt: gap.n - 1, gaps: true })}
                    className="flex w-full items-start gap-3 rounded-option border-[1.5px] border-line bg-surface px-4 py-3 text-left text-[14px] hover:border-line-strong max-md:min-h-[44px] max-md:text-[15px]"
                  >
                    <span className="shrink-0 font-bold">{gap.n}</span>
                    <span className="flex-1">{gap.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('allAnswered', { total: items.length })}</p>
            <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('submitBody')}</p>
          </>
        )}
        {step.failed && (
          <p role="alert" className="m-0 text-[14px] font-semibold text-danger max-md:text-[15px]">
            {t('failed')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="large" className="font-bold" disabled={step.sending || gaps.length > 0} onClick={() => submit(step.answers)}>
            {step.sending ? t('submitting') : t('submit')}
          </Button>
          <Button variant="secondary" size="large" disabled={step.sending} onClick={() => setStep({ kind: 'questions', startAt: 0 })}>
            {t('change')}
          </Button>
        </div>
      </Frame>
    )
  }

  if (step.kind === 'done' || step.kind === 'refused') {
    const [title, body] =
      step.kind === 'done'
        ? [t('doneTitle'), t('doneBody')]
        : step.reason === 'answered'
          ? [t('answeredTitle'), t('answeredBody')]
          : step.reason === 'closed'
            ? [t('closedTitle'), t('closedBody')]
            : [t('notInvitedTitle'), t('notInvitedBody')]
    return (
      <Frame>
        {step.kind === 'done' && <CircleCheck aria-hidden size={28} className="text-ink" />}
        <h1 ref={heading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {title}
        </h1>
        <p className="m-0 text-[15px] leading-[1.55] text-text-2">{body}</p>
        <Link href={backHref as Route} className={buttonVariants({ variant: 'secondary', className: 'self-start' })}>
          {t('back')}
        </Link>
      </Frame>
    )
  }

  return (
    <Frame>
      <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{group}</p>
      <h1 ref={heading} tabIndex={-1} className="-mt-1 mb-0 font-display text-page-title focus-visible:outline-none max-md:text-[28px]">
        {kind === 'pulse' ? (number ? t('pulseHeading', { number }) : t('pulseHeadingPlain')) : t('heading')}
      </h1>
      <p className="m-0 text-[15px] leading-[1.55] text-text-2">{kind === 'pulse' ? t('pulsePurpose') : t('purpose')}</p>
      <p className="m-0 text-[15px] leading-[1.55] text-text-2">{kind === 'pulse' ? t('pulseLead', { count: items.length }) : t('lead', { count: items.length })}</p>
      {step.notice === 'invalid' && (
        <p role="alert" className="m-0 text-[14px] font-semibold text-danger max-md:text-[15px]">
          {t('invalid')}
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-option bg-surface-sunk p-4">
        <h2 className="m-0 text-[14.5px] font-bold">{t('storedTitle')}</h2>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-[1.5] text-text-body max-md:text-[15px]">
          <li>{t('storedNoName')}</li>
          <li>{t('storedCount')}</li>
          {closes && k !== null && <li>{t('storedOpens', { date: closes, k })}</li>}
          <li>{t('storedDevice')}</li>
        </ul>
      </div>
      <Button size="large" className="gap-2 self-start" onClick={() => setStep({ kind: 'questions' })}>
        {step.started ? t('resume') : t('start')}
        <ArrowRight aria-hidden size={16} />
      </Button>
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
      <section className="flex flex-col gap-3.5 rounded-card-lg border border-white bg-surface p-6 md:p-9">{children}</section>
    </div>
  )
}
