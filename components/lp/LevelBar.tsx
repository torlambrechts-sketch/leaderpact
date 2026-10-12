import * as React from 'react'
import { cn } from '@/lib/cn'
import { levelText, levelWidth } from '@/components/lp/level'

/**
 * A scale's level (spec, level-bar): one grid row of label, bar, level and agreement. The bar is --track
 * filled with --accent-strong to (level − 1) ÷ 4, from the stored level at one decimal. Agreement is a word
 * only; its number is never shown (handoff section 7). No text sits on the fill. Below 768 px the label
 * takes its own line and the agreement a fixed 130 px column, so the bars of a card keep one width.
 *
 * | variant  | columns                 | gap | text | track | where                              |
 * |----------|-------------------------|-----|------|-------|------------------------------------|
 * | team     | 180 / 1fr / 34 / 130    | 14  | 13.5 | 9 (8 in Results, D-12) | team view, Home, Results |
 * | personal | 170 / 1fr / 34          | 14  | 13.5 | 9     | the personal view: no agreement    |
 * | sample   | 150 / 1fr / 30 / 110    | 12  | 12.5 | 8     | the landing page's sample card     |
 */
export function LevelBar({
  level,
  agreement,
  label,
  track,
  variant = 'team',
  valueNote,
  className,
}: {
  level: number
  agreement?: string
  label: string
  track?: 8 | 9
  variant?: 'team' | 'personal' | 'sample'
  /** said after the level to a screen reader, where the row carries no agreement (e.g. "indicative") */
  valueNote?: string
  className?: string
}) {
  const text = levelText(level)
  const height = track ?? (variant === 'sample' ? 8 : 9)
  const personal = variant === 'personal'
  return (
    <div
      className={cn(
        'grid items-center gap-y-1.5 max-md:text-[15px] md:gap-y-0',
        // below 768 px the agreement column keeps one width, so the bars of a card line up
        variant === 'team' && 'grid-cols-[1fr_34px_130px] gap-x-3.5 text-[13.5px] md:grid-cols-[180px_1fr_34px_130px]',
        personal && 'grid-cols-[1fr_34px] gap-x-3.5 text-[13.5px] md:grid-cols-[170px_1fr_34px]',
        variant === 'sample' && 'grid-cols-[1fr_30px_130px] gap-x-3 text-[12.5px] md:grid-cols-[150px_1fr_30px_110px]',
        className,
      )}
    >
      <span className={cn('font-semibold', personal ? 'max-md:col-span-2' : 'max-md:col-span-3')}>{label}</span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={Number(text)}
        aria-valuetext={[text, agreement ?? valueNote].filter(Boolean).join(', ')}
        data-part="track"
        className={cn('relative rounded-pill bg-track', height === 9 ? 'h-[9px]' : 'h-2')}
      >
        <div data-part="fill" className="absolute inset-y-0 left-0 rounded-pill bg-accent-strong" style={{ width: `${levelWidth(level) * 100}%` }} />
      </div>
      <span aria-hidden className="text-right font-bold">
        {text}
      </span>
      {!personal && (
        <span aria-hidden className="text-muted">
          {agreement}
        </span>
      )}
    </div>
  )
}
