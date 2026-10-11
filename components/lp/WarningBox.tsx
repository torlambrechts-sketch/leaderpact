import * as React from 'react'
import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A warning (spec, warning-box): --flag-bg, a 1.5 px --flag border, radius 12, padding 12, 13 px at line
 * height 1.45. The sentence is ink and the action --flag-ink: the handoff says "text --flag-ink", but in
 * the design only the action is (D-12). The icon is --flag-icon, an icon beside words. --flag itself is a
 * border, never text. The action shows only when the reader may take it.
 */
export function WarningBox({
  action,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { action?: React.ReactNode }) {
  return (
    <div role="note" className={cn('flex items-start gap-2.5 rounded-btn border-[1.5px] border-flag bg-flag-bg p-3 text-[13px] leading-[1.45] text-ink max-md:text-[15px]', className)} {...props}>
      <TriangleAlert aria-hidden size={17} className="shrink-0 text-flag-icon" />
      <div className="flex flex-1 flex-col gap-2">
        <div>{children}</div>
        {action}
      </div>
    </div>
  )
}

/** The warning's action: 700 --flag-ink, a 1 px --flag border, radius 8, padding 5 by 10. */
export const WarningAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn('self-start rounded-r8 border border-flag px-2.5 py-[5px] font-bold text-flag-ink max-md:min-h-[44px]', className)}
      {...props}
    />
  ),
)
WarningAction.displayName = 'WarningAction'
