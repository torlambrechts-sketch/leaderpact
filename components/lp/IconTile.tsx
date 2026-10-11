import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** An icon tile (spec, icon-tile): 36 px, radius 11, --accent fill, a 17 px icon in ink. Decorative. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-icon-tile bg-accent text-ink', className)}>
      <Icon size={17} strokeWidth={2} />
    </span>
  )
}
