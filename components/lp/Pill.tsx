import * as React from 'react'
import { cn } from '@/lib/cn'

/** A pill: 11.5 to 12 px, 600, padding 4 by 10, round (handoff section 4). Colour carries meaning only with a word. */
const TONES = {
  accent: 'bg-accent text-accent-ink',
  ok: 'bg-ok-bg text-ok-ink',
  pending: 'bg-pending-bg text-pending-ink',
  neutral: 'bg-surface-soft text-chip-off-ink',
  ink: 'bg-ink text-white',
} as const

export type PillTone = keyof typeof TONES

export function Pill({ tone = 'accent', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: PillTone }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-1 text-[12px] font-semibold', TONES[tone], className)} {...props} />
}
