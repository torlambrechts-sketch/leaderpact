import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * The greeting block on Home (spec, hero-block): --hero fill, a 1 px --bar border, radius 20, padding 28 by
 * 32, text aligned to the bottom, gap 20. The date is 13 px in --text-2 (the design's --muted fails on
 * --hero, 3.39:1); the greeting is Poppins 34 / 500 / -0.03em; the status line 15 px in --text-3. The
 * design's "Assessment schedule" button is not built (section 11); `action` stays for later screens.
 */
export function HeroBlock({ date, greeting, status, action, className }: { date: string; greeting: string; status?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-wrap items-end justify-between gap-5 rounded-card-lg border border-bar bg-hero px-5 py-6 md:px-8 md:py-7', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p data-part="date" className="text-[13px] text-text-2 max-md:text-[15px]">{date}</p>
        <h1 data-part="greeting" className="m-0 font-display text-greeting max-md:leading-[1.15]">{greeting}</h1>
        {status && <p data-part="status" className="text-[15px] text-text-3">{status}</p>}
      </div>
      {action}
    </section>
  )
}
