import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * How many have answered (spec, count-dots): the count at 40 / 700 with " / total" at 18 in --muted and a
 * caption at 12.5 in --text-2, and beside it one 16 px square per seat, radius 5, gap 4, wrapping within
 * 170 px. The first n are ink, the rest --border: the dots never say who. Always with the count in words
 * (handoff section 4), which is what a screen reader hears.
 */
export function CountDots({
  answered,
  total,
  caption,
  words,
  className,
}: {
  answered: number
  total: number
  caption: string
  words: string
  className?: string
}) {
  const on = Math.max(0, Math.min(answered, total))
  return (
    <div className={cn('flex items-end justify-between gap-3', className)}>
      <p className="sr-only">{words}</p>
      <div aria-hidden className="flex flex-col gap-0.5">
        <span className="text-big-number">
          {on}
          <span className="text-[18px] text-muted">{` / ${total}`}</span>
        </span>
        <span className="text-[12.5px] text-text-2">{caption}</span>
      </div>
      <div aria-hidden data-part="dots" className="flex max-w-[170px] shrink-0 flex-wrap justify-end gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} data-part={i < on ? 'dot-on' : 'dot-off'} className={cn('h-4 w-4 rounded-chip', i < on ? 'bg-ink' : 'bg-line')} />
        ))}
      </div>
    </div>
  )
}
