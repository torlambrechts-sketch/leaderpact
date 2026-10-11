import * as React from 'react'
import { cn } from '@/lib/cn'
import { levelText, levelWidth } from '@/components/lp/level'

/**
 * A level on the five-point scale: an 8 px bar on --track filled with --accent-strong to (level − 1) ÷ 4,
 * the level in 700 beside it, then the agreement label (handoff section 4). Agreement is a word only;
 * its number is never shown (handoff section 7). No text sits on the fill (contrast fix).
 */
export function LevelBar({ level, agreement, label, className }: { level: number; agreement?: string; label: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={Number(levelText(level))}
        aria-valuetext={agreement ? `${levelText(level)}, ${agreement}` : levelText(level)}
        className="h-2 flex-1 overflow-hidden rounded-pill bg-track"
      >
        <div className="h-full rounded-pill bg-accent-strong" style={{ width: `${levelWidth(level) * 100}%` }} />
      </div>
      <span aria-hidden className="w-7 text-right text-[13px] font-bold tabular-nums">
        {levelText(level)}
      </span>
      {agreement && (
        <span aria-hidden className="w-[120px] text-[12px] text-muted">
          {agreement}
        </span>
      )}
    </div>
  )
}
