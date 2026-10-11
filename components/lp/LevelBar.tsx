import * as React from 'react'
import { cn } from '@/lib/cn'
import { levelText, levelWidth } from '@/components/lp/level'

/**
 * A scale's level (spec, level-bar): one grid row of label, bar, level and agreement, columns
 * 180 / 1fr / 34 / 130 at gap 14, 13.5 px. The bar is --track filled with --accent-strong to
 * (level − 1) ÷ 4, from the stored level at one decimal. It is 9 px in the team view and on Home, 8 px in
 * Results (D-12). Agreement is a word only; its number is never shown (handoff section 7). No text sits on
 * the fill. Below 768 px the label takes its own line, so the bar keeps its width.
 */
export function LevelBar({
  level,
  agreement,
  label,
  track = 9,
  className,
}: {
  level: number
  agreement?: string
  label: string
  track?: 8 | 9
  className?: string
}) {
  const text = levelText(level)
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_34px_auto] items-center gap-x-3.5 gap-y-1.5 text-[13.5px] max-md:text-[15px] md:grid-cols-[180px_1fr_34px_130px] md:gap-y-0',
        className,
      )}
    >
      <span className="font-semibold max-md:col-span-3">{label}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={Number(text)}
        aria-valuetext={agreement ? `${text}, ${agreement}` : text}
        data-part="track"
        className={cn('relative rounded-pill bg-track', track === 9 ? 'h-[9px]' : 'h-2')}
      >
        <div data-part="fill" className="absolute inset-y-0 left-0 rounded-pill bg-accent-strong" style={{ width: `${levelWidth(level) * 100}%` }} />
      </div>
      <span aria-hidden className="text-right font-bold">
        {text}
      </span>
      <span aria-hidden className="text-muted">
        {agreement}
      </span>
    </div>
  )
}
