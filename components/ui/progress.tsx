'use client'
// Origin: shadcn/ui progress (MIT), restyled as the scan's bar (spec, progress-bar): 6 px, track --border,
// fill --ink, both round.
import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/cn'

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root ref={ref} value={value} className={cn('relative h-1.5 w-full overflow-hidden rounded-pill bg-line', className)} {...props}>
    <ProgressPrimitive.Indicator data-part="fill" className="h-full rounded-pill bg-ink transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName
