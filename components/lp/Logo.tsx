import * as React from 'react'
import { cn } from '@/lib/cn'

/** The design's logo mark (a black circle with a white dot) and the product name beside it. */
export function Logo({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-[17px] font-bold text-ink', className)}>
      <span aria-hidden className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ink">
        <span className="h-2.5 w-2.5 rounded-full bg-white" />
      </span>
      {name}
    </span>
  )
}
