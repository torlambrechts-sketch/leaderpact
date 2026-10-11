import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A card's title row (spec, section-header): title 18 / 700 with no tracking, an optional ink count pill
 * (12 / 700, padding 2 by 9), then the meta at 12.5 px in --muted on the right. Gap 10, 8 below.
 */
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
  /** read by a screen reader instead of the bare number, e.g. "4 items" */
  countLabel?: string
  meta?: React.ReactNode
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('mb-2 flex flex-wrap items-center gap-2.5', className)}>
      <Heading data-part="title" className="text-[18px] font-bold">{title}</Heading>
      {count !== undefined && (
        <span data-part="count" className="rounded-pill bg-ink px-[9px] py-0.5 text-[12px] font-bold text-white">
          <span aria-hidden>{count}</span>
          {countLabel && <span className="sr-only">{countLabel}</span>}
        </span>
      )}
      <span className="flex-1" />
      {meta && <div data-part="meta" className="text-[12.5px] text-muted">{meta}</div>}
    </div>
  )
}
