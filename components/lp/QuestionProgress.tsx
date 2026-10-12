import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { X } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

/**
 * The questionnaire's header (spec, progress-bar): "Leave the scan" with a cross on the left, "1 of 12"
 * on the right, the 6 px bar 18 px under them (the design's column gap). On the page background the leave link is --text-2, not the
 * design's --muted (contrast fix). The bar counts the current question as done once it has an answer.
 * With `onLeave` the way out is a button that stays on the page (the invite link's intro), not a link.
 */
export function QuestionProgress({
  leaveHref,
  onLeave,
  leaveLabel,
  position,
  value,
  label,
  prefetch,
}: {
  leaveHref: string
  onLeave?: () => void
  leaveLabel: string
  position: string
  value: number
  label: string
  prefetch?: boolean
}) {
  const leave = 'inline-flex items-center gap-1.5 text-text-2 hover:text-ink max-md:min-h-[44px]'
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-center justify-between text-[13px] text-text-2">
        {onLeave ? (
          <button type="button" onClick={onLeave} className={leave}>
            <X aria-hidden size={14} />
            {leaveLabel}
          </button>
        ) : (
          <Link href={leaveHref as Route} prefetch={prefetch} className={leave}>
            <X aria-hidden size={14} />
            {leaveLabel}
          </Link>
        )}
        <span className="font-semibold text-ink">{position}</span>
      </div>
      <Progress value={value} aria-label={label} />
    </div>
  )
}
