import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconTile } from '@/components/lp/IconTile'

/**
 * A "Needs you" row (spec, list-row): padding 11 by 0, gap 12, a --divider rule above every row including
 * the first. An icon tile; a text column (gap 3) with the kind chip (10.5 / 700, radius 5, padding 2 by
 * 6) and the title (14 / 700) on one line (gap 8), and the meta (12 px, --muted) under it; the action on
 * the right. The kind chip takes an evidence pair: assessments strong, the leader's tasks moderate, the
 * person's own actions and profile other.
 */
const KIND = {
  strong: 'bg-evidence-strong-bg text-evidence-strong-ink',
  moderate: 'bg-evidence-moderate-bg text-evidence-moderate-ink',
  other: 'bg-evidence-other-bg text-evidence-other-ink',
} as const

export function ListRow({
  icon,
  kind,
  kindTone = 'strong',
  title,
  meta,
  action,
  className,
  specimen,
}: {
  icon: LucideIcon
  kind?: string
  kindTone?: keyof typeof KIND
  title: string
  meta?: string
  action?: React.ReactNode
  className?: string
  /** the specimens page's id for the side-by-side check */
  specimen?: string
}) {
  return (
    <li data-specimen={specimen} className={cn('flex items-center gap-3 border-t border-divider py-[11px]', className)}>
      <IconTile icon={icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <div className="flex flex-wrap items-center gap-2">
          {kind && <span data-part="kind" className={cn('whitespace-nowrap rounded-chip px-1.5 py-0.5 text-[10.5px] font-bold', KIND[kindTone])}>{kind}</span>}
          <span data-part="title" className="text-[14px] font-bold">{title}</span>
        </div>
        {meta && <p data-part="meta" className="text-[12px] text-muted">{meta}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  )
}
