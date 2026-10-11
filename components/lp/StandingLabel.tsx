import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A scale's standing, in words (handoff section 7). Never colour alone: the word is the information; the
 * mark beside it repeats it for a quick scan.
 */
export type Standing = 'priority' | 'watch' | 'strength' | 'views-differ' | 'fact' | 'read-with'

const MARK: Record<Standing, string> = {
  priority: 'bg-danger',
  watch: 'bg-flag',
  strength: 'bg-ok-ink',
  'views-differ': 'bg-accent-strong',
  fact: 'bg-line-dashed',
  'read-with': 'bg-line-dashed',
}

export function StandingLabel({ standing, label, className }: { standing: Standing; label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-ink', className)}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', MARK[standing])} />
      {label}
    </span>
  )
}
