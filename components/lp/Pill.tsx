import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A pill, round, no border (spec, pill). The handoff's "11.5 to 12 px, 600, padding 4 by 10" is the accent
 * pill; status, plan and count pills are 700. Colour carries meaning only beside a word.
 *
 * | tone    | colours           | font       | padding |
 * |---------|-------------------|------------|---------|
 * | accent  | accent / ink      | 12 / 600   | 4 / 10  |
 * | plan    | accent / ink      | 11.5 / 700 | 4 / 10  |
 * | ink     | ink / white       | 12 / 700   | 4 / 10 (a count: 2 / 9) |
 * | ok      | ok pair           | 11.5 / 700 | 4 / 9   |
 * | pending | pending pair      | 11.5 / 700 | 4 / 9   |
 * | neutral | rule-soft / ink   | 11.5 / 700 | 3 / 9   |
 */
const TONES = {
  accent: 'bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-ink',
  plan: 'bg-accent px-2.5 py-1 text-[11.5px] font-bold text-accent-ink',
  ink: 'bg-ink px-2.5 py-1 text-[12px] font-bold text-white',
  ok: 'bg-ok-bg px-[9px] py-1 text-[11.5px] font-bold text-ok-ink',
  pending: 'bg-pending-bg px-[9px] py-1 text-[11.5px] font-bold text-pending-ink',
  neutral: 'bg-rule-soft px-[9px] py-[3px] text-[11.5px] font-bold text-ink',
} as const

export type PillTone = keyof typeof TONES

export function Pill({
  tone = 'accent',
  count = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: PillTone; count?: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-pill', TONES[tone], count && 'px-[9px] py-0.5', className)}
      {...props}
    />
  )
}
