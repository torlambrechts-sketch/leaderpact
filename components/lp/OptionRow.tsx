'use client'
import * as React from 'react'
import { RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/cn'

/**
 * One answer option (spec, option-row): min-height 52, padding 0 by 16, gap 14, radius 14, a 1.5 px
 * border, 15 / 500, and a 26 px numbered circle whose border takes the row's. Off: white, --border. On:
 * --accent, an ink border. The design draws no hover. It is a Radix radio item inside a RadioGroup, so
 * arrow keys and the radio-group semantics come with it; the design's clickable div is not built.
 */
export function OptionRow({ value, number, label, className }: { value: string; number: number; label: string; className?: string }) {
  return (
    <RadioGroupItem
      value={value}
      className={cn(
        'group flex min-h-[52px] w-full items-center gap-3.5 rounded-option border-[1.5px] border-line bg-surface px-4 text-left text-[15px] font-medium text-ink',
        'data-[state=checked]:border-ink data-[state=checked]:bg-accent',
        className,
      )}
    >
      <span
        aria-hidden
        data-part="number"
        className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] border-line text-[12px] font-bold group-data-[state=checked]:border-ink"
      >
        {number}
      </span>
      <span>{label}</span>
    </RadioGroupItem>
  )
}
