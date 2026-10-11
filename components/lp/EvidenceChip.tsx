import * as React from 'react'
import { cn } from '@/lib/cn'

/** A scale's evidence rating, as a chip in one of the three evidence pairs (handoff section 4). */
const TONES = {
  strong: 'bg-evidence-strong-bg text-evidence-strong-ink',
  moderate: 'bg-evidence-moderate-bg text-evidence-moderate-ink',
  other: 'bg-evidence-other-bg text-evidence-other-ink',
} as const

export function EvidenceChip({ rating, label, className }: { rating: keyof typeof TONES; label: string; className?: string }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-chip-lg px-2 py-0.5 text-[11.5px] font-semibold', TONES[rating], className)}>{label}</span>
}
