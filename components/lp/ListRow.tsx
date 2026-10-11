import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconTile } from '@/components/lp/IconTile'

/**
 * A "Needs you" row: an icon tile, a kind chip, the title (14 px 700), meta (12 px), the action on the
 * right, a divider above (handoff section 4).
 */
export function ListRow({
  icon,
  kind,
  title,
  meta,
  action,
  className,
  specimen,
}: {
  /** the specimens page's id for the side-by-side check */
  specimen?: string
  icon: LucideIcon
  kind?: string
  title: string
  meta?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <li data-specimen={specimen} className={cn('flex items-center gap-3.5 border-t border-divider py-3.5 first:border-t-0', className)}>
      <IconTile icon={icon} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {kind && <span className="rounded-chip-lg bg-surface-soft px-1.5 py-0.5 text-[11px] font-semibold text-chip-off-ink">{kind}</span>}
          <span className="text-[14px] font-bold">{title}</span>
        </div>
        {meta && <p className="mt-0.5 text-[12px] text-muted">{meta}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  )
}
