import * as React from 'react'
import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A warning: --flag-bg, a 1.5 px --flag border, radius 12, --flag-ink text (handoff section 4). The flag
 * colour is a border and a mark, never text (contrast fix). The icon is decorative; the words carry it.
 */
export function WarningBox({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="note" className={cn('flex gap-2.5 rounded-btn border-[1.5px] border-flag bg-flag-bg px-4 py-3 text-[13px] text-flag-ink', className)} {...props}>
      <TriangleAlert aria-hidden size={16} className="mt-px shrink-0 text-flag" />
      <div>{children}</div>
    </div>
  )
}
