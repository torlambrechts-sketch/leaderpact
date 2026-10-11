import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Answers so far as 16 px squares, radius 5: --ink for each answer, --border for the rest. Always with the
 * count in words (handoff section 4), and never a name: "Counts only, never names".
 */
export function CountDots({ answered, total, words, className }: { answered: number; total: number; words: string; className?: string }) {
  const on = Math.max(0, Math.min(answered, total))
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div aria-hidden className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn('h-4 w-4 rounded-chip', i < on ? 'bg-ink' : 'bg-line')} />
        ))}
      </div>
      <span className="text-[13px] font-semibold text-ink">{words}</span>
    </div>
  )
}
