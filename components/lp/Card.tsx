import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A card: white, radius 18, padding 22 by 24; `compact` is 20 by 22; `large` has radius 20. Cards carry a
 * white border so they read as flat shapes on cream; shadows are rare (handoff section 4).
 */
export function Card({
  className,
  compact = false,
  large = false,
  as: Tag = 'section',
  ...props
}: React.HTMLAttributes<HTMLElement> & { compact?: boolean; large?: boolean; as?: 'section' | 'div' | 'article' }) {
  return (
    <Tag
      className={cn(
        'border border-white bg-surface',
        large ? 'rounded-card-lg' : 'rounded-card',
        compact ? 'px-[22px] py-5' : 'px-6 py-[22px]',
        className,
      )}
      {...props}
    />
  )
}
