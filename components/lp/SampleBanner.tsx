import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Above a paid page on the Free plan: black, white text, radius 18, a white SAMPLE chip. The leader sees
 * the price and Upgrade; a member sees "Ask your team leader to upgrade", with no price (handoff 6.19).
 * The page below it shows seeded sample content, always marked Sample (handoff section 10).
 */
export function SampleBanner({
  chip,
  title,
  body,
  action,
  className,
}: {
  chip: string
  title: string
  body: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-wrap items-center gap-4 rounded-card bg-ink px-6 py-4 text-white', className)}>
      <span className="rounded-chip-lg bg-white px-2 py-0.5 text-micro uppercase text-ink">{chip}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold">{title}</p>
        <p className="text-[13px] text-white/80">{body}</p>
      </div>
      {action}
    </section>
  )
}
