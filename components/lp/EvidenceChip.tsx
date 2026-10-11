import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A scale's evidence rating (spec, evidence-chip): 11 / 700, radius 6, padding 3 by 7, in one of the three
 * evidence pairs. "Strong" takes the strong pair, "Moderate" the moderate one, and anything else ("Mixed or
 * weak", "Not yet rated") the other pair. The label comes from the data.
 */
const TONES = {
  strong: 'bg-evidence-strong-bg text-evidence-strong-ink',
  moderate: 'bg-evidence-moderate-bg text-evidence-moderate-ink',
  other: 'bg-evidence-other-bg text-evidence-other-ink',
} as const

export function EvidenceChip({ rating, label, className }: { rating: keyof typeof TONES; label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-chip-lg px-[7px] py-[3px] text-[11px] font-bold', TONES[rating], className)}>
      {label}
    </span>
  )
}
