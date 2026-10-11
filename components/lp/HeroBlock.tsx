import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * The greeting block on Home: --hero fill, radius 20, padding 28 by 32. A date, the greeting in Poppins,
 * a status line, and an optional action (handoff section 4). Text on --hero uses --text-2 or --text-3,
 * never --muted (contrast fix).
 */
export function HeroBlock({
  date,
  greeting,
  status,
  action,
  className,
}: {
  date: string
  greeting: string
  status?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-wrap items-end justify-between gap-6 rounded-card-lg border border-bar bg-hero px-8 py-7', className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[13px] text-text-2">{date}</p>
        <h1 className="font-display text-greeting">{greeting}</h1>
        {status && <p className="text-[14.5px] text-text-3">{status}</p>}
      </div>
      {action}
    </section>
  )
}
