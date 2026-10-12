'use client'
import * as React from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The group size control (design `personal`: "Members, including you"): a number field between a minus
 * and a plus button, in a translucent tray. The field is a real labelled input, so the size can be typed
 * as well as stepped; the buttons are 32 px, 44 px on phones. `tone="ink"` is the dark save card.
 */
export function SizeStepper({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
  fewerLabel,
  moreLabel,
  tone = 'surface',
}: {
  id: string
  label: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  fewerLabel: string
  moreLabel: string
  tone?: 'surface' | 'ink'
}) {
  const ink = tone === 'ink'
  const button = cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-r8 disabled:opacity-40 max-md:h-11 max-md:w-11',
    ink ? 'bg-white/20 text-white' : 'border border-line-strong bg-surface text-ink',
  )
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className={cn('text-[13px] font-semibold max-md:text-[15px]', ink ? 'text-white' : 'text-ink')}>
          {label}
        </label>
        <div className={cn('flex items-center gap-2.5 rounded-btn-sm p-1', ink ? 'bg-white/15' : 'bg-surface-soft')}>
          <button type="button" aria-label={fewerLabel} aria-controls={id} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={button}>
            <Minus aria-hidden size={16} />
          </button>
          <input
            id={id}
            name="size"
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={value}
            aria-describedby={`${id}-hint`}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isInteger(n)) onChange(Math.min(max, Math.max(min, n)))
            }}
            className={cn(
              'w-9 appearance-none bg-transparent text-center text-[15px] font-semibold [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              ink ? 'text-white' : 'text-ink',
            )}
          />
          <button type="button" aria-label={moreLabel} aria-controls={id} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={button}>
            <Plus aria-hidden size={16} />
          </button>
        </div>
      </div>
      <p id={`${id}-hint`} className={cn('text-[12px] max-md:text-[15px]', ink ? 'text-white/85' : 'text-text-2')}>
        {hint}
      </p>
    </div>
  )
}
