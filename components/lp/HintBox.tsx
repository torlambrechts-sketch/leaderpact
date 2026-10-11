import * as React from 'react'
import { cn } from '@/lib/cn'

/** A hint: the sunk surface, a dashed border, radius 12 (handoff section 4). */
export function HintBox({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-btn border border-dashed border-line-dashed bg-surface-sunk px-4 py-3 text-[13px] text-text-2', className)} {...props} />
}
