import * as React from 'react'
import { Hourglass } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A hint on the sunk surface with a dashed border (spec, hint-box). Compact: radius 12, padding 10 by 12,
 * 12.5 / 600 ink. Large, with a title: radius 14, padding 16 by 18, an hourglass, the title at 14.5 / 700
 * and the body at 13 in --text-2. The handoff gives radius 12; the large box in the design is 14.
 */
export function HintBox({ title, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  if (!title) {
    return (
      <div
        className={cn('rounded-btn border border-dashed border-line-dashed bg-surface-sunk px-3 py-2.5 text-[12.5px] font-semibold text-ink', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
  return (
    <div
      className={cn('flex items-center gap-3 rounded-option border border-dashed border-line-dashed bg-surface-sunk px-[18px] py-4', className)}
      {...props}
    >
      <Hourglass aria-hidden size={20} className="shrink-0 text-ink" />
      <div className="flex flex-col gap-0.5">
        <p className="text-[14.5px] font-bold">{title}</p>
        <div className="text-[13px] text-text-2 max-md:text-[15px]">{children}</div>
      </div>
    </div>
  )
}
