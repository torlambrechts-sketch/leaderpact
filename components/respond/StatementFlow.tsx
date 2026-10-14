'use client'
import * as React from 'react'
import { ArrowRight } from 'lucide-react'
import { OptionRow } from '@/components/lp/OptionRow'
import { QuestionProgress } from '@/components/lp/QuestionProgress'
import { Button } from '@/components/ui/button'
import { RadioGroup } from '@/components/ui/radio-group'
import type { Draft } from '@/lib/scan/draft'

const VALUES = [1, 2, 3, 4, 5] as const

export interface Statement {
  id: string
  text: string
  /** a label over the question, such as the scan's theme; none for the diagnostic, which is not grouped */
  chip?: string
}

export interface StatementLabels {
  leave: string
  progress: string
  position: (n: number, total: number) => string
  options: Record<(typeof VALUES)[number], string>
  back: string
  next: string
  finish: string
  footnote: string
}

/**
 * The renderer of the five-point statement (handoff section 7, Answer format), the one question kind of the
 * scan and of the diagnostic (CLAUDE.md, Model as data: one renderer per question kind). One question per
 * screen in a 640 px column, five options from Strongly disagree to Strongly agree, Back and Next. Every
 * answer is saved through `draft` as it is given, so a person who stops resumes where they were.
 *
 * The question is the page's heading, and the options a radio group labelled by it. When the question
 * changes, focus moves to the new heading, so a screen reader reads it and Tab reaches the options next.
 *
 * - **Without `allowSkip`** (the scan) Next waits for an answer, and the last question leads to the first
 *   gap before `onFinish`.
 * - **With `allowSkip`** (the diagnostic) Next moves on without one, and the last question hands the answers
 *   to a review page that lists the gaps and waits for them (owner C8). Opened at a gap from that page
 *   (`gapToGap`), Next goes to the next gap, and back to the review when none is left.
 */
export function StatementFlow({
  items,
  draft,
  leaveHref,
  onLeave,
  onFinish,
  labels,
  allowSkip = false,
  startAt,
  gapToGap = false,
}: {
  items: readonly Statement[]
  draft: { read: () => Draft | null; write: (draft: Draft) => void }
  leaveHref: string
  onLeave?: () => void
  onFinish: (answers: Record<string, number>) => void
  labels: StatementLabels
  allowSkip?: boolean
  /** open at this question (0-based), such as a gap chosen on the review page */
  startAt?: number
  /** from the review page's list of gaps: Next leads to the next gap, then back to the review */
  gapToGap?: boolean
}) {
  const [answers, setAnswers] = React.useState<Record<string, number>>({})
  const [position, setPosition] = React.useState(0)
  const [ready, setReady] = React.useState(false)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const moved = React.useRef(false)

  React.useEffect(() => {
    const saved = draft.read()
    if (saved) setAnswers({ ...saved.answers })
    const at = startAt ?? saved?.position ?? 0
    setPosition(Math.min(Math.max(at, 0), items.length - 1))
    if (startAt !== undefined) moved.current = true
    setReady(true)
  }, [draft, items.length, startAt])

  React.useEffect(() => {
    if (moved.current) heading.current?.focus()
  }, [position, ready])

  const total = items.length
  const item = items[position] ?? items[0]!
  const value = answers[item.id]
  const last = position === total - 1

  function choose(raw: string) {
    const v = Number(raw)
    if (!VALUES.includes(v as (typeof VALUES)[number])) return
    const nextAnswers = { ...answers, [item.id]: v }
    setAnswers(nextAnswers)
    draft.write({ answers: nextAnswers, position })
  }

  function go(to: number) {
    moved.current = true
    setPosition(to)
    draft.write({ answers, position: to })
  }

  function next() {
    if (value === undefined && !allowSkip) return
    if (gapToGap) {
      const after = items.findIndex((it, i) => i > position && answers[it.id] === undefined)
      const before = items.findIndex((it, i) => i < position && answers[it.id] === undefined)
      const gapAt = after !== -1 ? after : before
      return gapAt === -1 ? onFinish(answers) : go(gapAt)
    }
    if (!last) return go(position + 1)
    const gap = items.findIndex((it) => answers[it.id] === undefined)
    if (gap !== -1 && !allowSkip) return go(gap)
    onFinish(answers)
  }

  const done = items.filter((it) => answers[it.id] !== undefined).length
  return (
    <div className="mx-auto mt-6 flex max-w-questionnaire flex-col gap-[18px] px-4 md:mt-10 md:px-6">
      <QuestionProgress
        leaveHref={leaveHref}
        onLeave={onLeave}
        leaveLabel={labels.leave}
        position={labels.position(position + 1, total)}
        value={(allowSkip ? done / total : (position + (value !== undefined ? 1 : 0)) / total) * 100}
        label={labels.progress}
      />
      <section
        aria-busy={!ready}
        className="flex flex-col gap-[22px] rounded-card-lg border border-white bg-surface p-6 shadow-[0_30px_60px_-40px_rgba(60,50,30,.18)] md:p-9"
      >
        {item.chip && <span className="self-start rounded-pill bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-ink">{item.chip}</span>}
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
            <OptionRow key={n} value={String(n)} number={n} label={labels.options[n]} />
          ))}
        </RadioGroup>
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="large" disabled={position === 0} onClick={() => go(position - 1)} className="disabled:opacity-[.35]">
            {labels.back}
          </Button>
          <Button size="large" disabled={value === undefined && !allowSkip} onClick={next} className="gap-2">
            {last || (gapToGap && items.every((it, i) => i === position || answers[it.id] !== undefined)) ? labels.finish : labels.next}
            <ArrowRight aria-hidden size={16} />
          </Button>
        </div>
      </section>
      <p className="m-0 text-center text-[12.5px] text-text-2 max-md:text-[15px]">{labels.footnote}</p>
    </div>
  )
}
