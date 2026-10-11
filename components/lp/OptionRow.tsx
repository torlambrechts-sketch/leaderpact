'use client'
import * as React from 'react'
import { RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/cn'

/**
 * One answer option: min-height 52, radius 14, a 1.5 px border, a 26 px numbered circle on the left. Off:
 * white with --border. On: --accent fill with an --ink border (handoff section 4). It is a Radix radio
 * item inside a RadioGroup, so arrow keys and the radio-group semantics come with it.
 */
export function OptionRow({ value, number, label, className }: { value: string; number: number; label: string; className?: string }) {
  return (
    <RadioGroupItem
      value={value}
      className={cn(
        'group flex min-h-[52px] w-full items-center gap-3 rounded-option border-[1.5px] border-line bg-surface px-3.5 py-2.5 text-left text-[14px] font-semibold text-ink transition-colors',
        'hover:border-accent-mid data-[state=checked]:border-ink data-[state=checked]:bg-accent',
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-[12px] font-bold text-text-2 group-data-[state=checked]:border-ink group-data-[state=checked]:bg-ink group-data-[state=checked]:text-white"
      >
        {number}
      </span>
      <span>{label}</span>
    </RadioGroupItem>
  )
}
