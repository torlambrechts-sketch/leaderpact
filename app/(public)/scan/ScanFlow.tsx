'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { OptionRow } from '@/components/lp/OptionRow'
import { QuestionProgress } from '@/components/lp/QuestionProgress'
import { Button } from '@/components/ui/button'
import { RadioGroup } from '@/components/ui/radio-group'
import { LANDING_PATH, RESULT_PATH } from '@/lib/routes'
import { deviceStore, readDraft, writeDraft } from '@/lib/scan/draft'
import { firstUnanswered, isComplete, type Scan } from '@/lib/scan/model'

const VALUES = [1, 2, 3, 4, 5] as const

/**
 * The scan (handoff 6.2, design `scan`): one question per screen in a 640 px column, five options from
 * Strongly disagree to Strongly agree, Back and Next. Every answer is saved on the device as it is given,
 * so an abandoned scan resumes where it was left, for 7 days (lib/scan/draft.ts); nothing leaves the
 * device. The last question's button opens the personal view.
 *
 * The question is the page's heading, and the options a radio group labelled by it. When the question
 * changes, focus moves to the new heading, so a screen reader reads it and Tab reaches the options next.
 */
export function ScanFlow({ scan }: { scan: Scan }) {
  const t = useTranslations('scan')
  const router = useRouter()
  const [answers, setAnswers] = React.useState<Record<string, number>>({})
  const [position, setPosition] = React.useState(0)
  const [ready, setReady] = React.useState(false)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const moved = React.useRef(false)

  React.useEffect(() => {
    const draft = readDraft(deviceStore(), scan, new Date())
    if (draft) {
      setAnswers({ ...draft.answers })
      setPosition(draft.position)
    }
    setReady(true)
    router.prefetch(RESULT_PATH as Route)
  }, [scan, router])

  React.useEffect(() => {
    if (moved.current) heading.current?.focus()
  }, [position])

  const total = scan.items.length
  const item = scan.items[position] ?? scan.items[0]!
  const theme = scan.themes.find((th) => th.key === item.theme)
  const value = answers[item.id]
  const last = position === total - 1

  function save(nextAnswers: Record<string, number>, nextPosition: number) {
    writeDraft(deviceStore(), scan, { answers: nextAnswers, position: nextPosition }, new Date())
  }

  function choose(raw: string) {
    const v = Number(raw)
    if (!VALUES.includes(v as (typeof VALUES)[number])) return
    const nextAnswers = { ...answers, [item.id]: v }
    setAnswers(nextAnswers)
    save(nextAnswers, position)
  }

  function go(to: number) {
    moved.current = true
    setPosition(to)
    save(answers, to)
  }

  function next() {
    if (value === undefined) return
    if (!last) return go(position + 1)
    if (isComplete(scan, answers)) router.push(RESULT_PATH as Route)
    else go(firstUnanswered(scan, answers))
  }

  const done = position + (value !== undefined ? 1 : 0)
  return (
    <div className="mx-auto mt-6 flex max-w-questionnaire flex-col gap-[18px] px-4 md:mt-10 md:px-6">
      <QuestionProgress
        leaveHref={LANDING_PATH}
        leaveLabel={t('leave')}
        position={t('position', { n: position + 1, total })}
        value={(done / total) * 100}
        label={t('progress')}
      />
      <section
        aria-busy={!ready}
        className="flex flex-col gap-[22px] rounded-card-lg border border-white bg-surface p-6 shadow-[0_30px_60px_-40px_rgba(60,50,30,.18)] md:p-9"
      >
        {theme && <span className="self-start rounded-pill bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-ink">{theme.name}</span>}
        <h1
          ref={heading}
          id="question"
          tabIndex={-1}
          className="m-0 font-display text-card-headline leading-[1.25] focus-visible:outline-none max-md:text-[24px]"
          style={{ textWrap: 'pretty' }}
        >
          {item.text}
        </h1>
        <RadioGroup key={item.id} aria-labelledby="question" value={value === undefined ? '' : String(value)} onValueChange={choose} className="flex flex-col gap-2">
          {VALUES.map((n) => (
            <OptionRow key={n} value={String(n)} number={n} label={t(`options.${n}`)} />
          ))}
        </RadioGroup>
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="large" disabled={position === 0} onClick={() => go(position - 1)} className="disabled:opacity-[.35]">
            {t('back')}
          </Button>
          <Button size="large" disabled={value === undefined} onClick={next} className="gap-2">
            {last ? t('finish') : t('next')}
            <ArrowRight aria-hidden size={16} />
          </Button>
        </div>
      </section>
      <p className="m-0 text-center text-[12.5px] text-text-2 max-md:text-[15px]">{t('onDevice')}</p>
    </div>
  )
}
