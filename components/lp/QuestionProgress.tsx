import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { X } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

/**
 * The questionnaire's header (spec, progress-bar): "Leave the scan" with a cross on the left, "1 of 12"
 * on the right, the 6 px bar under them. On the page background the leave link is --text-2, not the
 * design's --muted (contrast fix). The bar counts the current question as done once it has an answer.
 */
export function QuestionProgress({ leaveHref, leaveLabel, position, value, label, prefetch }: { leaveHref: string; leaveLabel: string; position: string; value: number; label: string; prefetch?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-[13px] text-text-2">
        <Link href={leaveHref as Route} prefetch={prefetch} className="inline-flex items-center gap-1.5 text-text-2 hover:text-ink max-md:min-h-[44px]">
          <X aria-hidden size={14} />
          {leaveLabel}
        </Link>
        <span className="font-semibold text-ink">{position}</span>
      </div>
      <Progress value={value} aria-label={label} />
    </div>
  )
}
