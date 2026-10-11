import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Above a paid page on the Free plan (spec, sample-banner; handoff 6.19): radius 18, padding 16 by 20,
 * gap 16, a SAMPLE chip and one line of text at 14 px. The leader sees it in ink with the price and
 * Upgrade; a member sees it white with a border, "Ask your team leader to upgrade" and no price. The page
 * below it shows seeded sample content, always marked Sample (handoff section 10).
 */
export function SampleBanner({
  audience,
  chip,
  text,
  action,
  className,
}: {
  audience: 'leader' | 'member'
  chip: string
  text: string
  action?: React.ReactNode
  className?: string
}) {
  const leader = audience === 'leader'
  return (
    <section
      className={cn(
        'flex flex-wrap items-center gap-4 rounded-card px-5 py-4',
        leader ? 'bg-ink text-white' : 'border border-line bg-surface text-ink',
        className,
      )}
    >
      <span
        data-part="chip"
        className={cn(
          'rounded-chip-lg px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.06em]',
          leader ? 'bg-surface text-accent-deep' : 'bg-ink text-white',
        )}
      >
        {chip}
      </span>
      <p data-part="text" className={cn('min-w-0 text-[14px] max-md:basis-full max-md:text-[15px]', leader && 'flex-1')}>{text}</p>
      {leader && action}
    </section>
  )
}
