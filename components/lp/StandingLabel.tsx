import * as React from 'react'
import { Check, Eye, Flag, Info, Link, Split, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Standing } from '@/lib/scoring/standing'

// one set of keys with the data: the snapshot stores these, and lib/scoring computes them
export type { Standing }

/**
 * A scale's standing, in words (handoff section 7; spec, standing-label): 12.5 / 600 ink, gap 6, with a
 * 15 px icon in --accent-strong. Every standing has the same icon colour, so colour never carries it; the
 * word is the information and the icon repeats it.
 */

const ICON: Record<Standing, LucideIcon> = {
  strength: Check,
  watch: Eye,
  priority: Flag,
  views_differ: Split,
  fact: Info,
  read_with: Link,
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
