import * as React from 'react'
import { CircleCheck } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The toast's look, drawn in place. The live toast is Sonner (components/ui/sonner.tsx) with the same
 * classes; this static view lets the specimens page and the side-by-side check show it without a timer.
 */
export function ToastView({ message, className }: { message: string; className?: string }) {
  return (
    <div role="status" className={cn('inline-flex items-center gap-2 rounded-btn bg-ink px-4 py-3 text-[13.5px] font-medium text-white shadow-lg', className)}>
      <CircleCheck aria-hidden size={16} />
      {message}
    </div>
  )
}
