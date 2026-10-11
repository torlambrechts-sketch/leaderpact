import * as React from 'react'
import { CircleCheck } from 'lucide-react'
import { cn } from '@/lib/cn'

/** The toast's classes (spec, toast), shared by this static view and the live Sonner toaster. */
export const toastClass =
  'flex items-center gap-2.5 rounded-btn bg-ink px-4 py-3 text-[13.5px] font-medium text-white max-md:text-[15px] [box-shadow:0_20px_40px_-20px_rgba(0,0,0,.6)]'

/**
 * The toast's look, drawn in place. The live toast is Sonner (components/ui/sonner.tsx) with the same
 * classes; this static view lets the specimens page and the side-by-side check show it without a timer.
 */
export function ToastView({ message, className }: { message: string; className?: string }) {
  return (
    <div role="status" className={cn(toastClass, 'inline-flex', className)}>
      <CircleCheck aria-hidden size="1em" className="shrink-0 text-accent-mid" />
      {message}
    </div>
  )
}
