import * as React from 'react'
import { Check, Eye, Flag, Info, Link, Split, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A scale's standing, in words (handoff section 7; spec, standing-label): 12.5 / 600 ink, gap 6, with a
 * 15 px icon in --accent-strong. Every standing has the same icon colour, so colour never carries it; the
 * word is the information and the icon repeats it.
 */
export type Standing = 'priority' | 'watch' | 'strength' | 'views-differ' | 'fact' | 'read-with'

const ICON: Record<Standing, LucideIcon> = {
  strength: Check,
  watch: Eye,
  priority: Flag,
  'views-differ': Split,
  fact: Info,
  'read-with': Link,
}

export function StandingLabel({ standing, label, className }: { standing: Standing; label: string; className?: string }) {
  const Icon = ICON[standing]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-ink', className)}>
      <Icon aria-hidden size={15} className="shrink-0 text-accent-strong" />
      {label}
    </span>
  )
}
