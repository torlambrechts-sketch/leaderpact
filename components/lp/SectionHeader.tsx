import * as React from 'react'
import { cn } from '@/lib/cn'

/** A card's title row: 18 px 700, an optional count pill, and meta text on the right (handoff section 4). */
export function SectionHeader({
  title,
  count,
  countLabel,
  meta,
  as: Heading = 'h2',
  className,
}: {
  title: string
  count?: number
  /** read by a screen reader with the count, e.g. "6 items" */
  countLabel?: string
  meta?: React.ReactNode
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1', className)}>
      <div className="flex items-center gap-2">
        <Heading className="text-[18px] font-bold tracking-[-0.02em]">{title}</Heading>
        {count !== undefined && (
          <span className="inline-flex min-w-[22px] items-center justify-center rounded-pill bg-ink px-1.5 py-0.5 text-[11.5px] font-bold text-white">
            <span aria-hidden>{count}</span>
            {countLabel && <span className="sr-only">{countLabel}</span>}
          </span>
        )}
      </div>
      {meta && <div className="text-[12px] text-muted">{meta}</div>}
    </div>
  )
}
