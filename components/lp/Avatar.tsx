import * as React from 'react'
import { cn } from '@/lib/cn'
import { avatarPair, initials } from '@/components/lp/avatar-colours'

/** A 34 px circle with initials, in the person's stable avatar pair (handoff section 4). */
export function Avatar({ personId, name, size = 34, className }: { personId: string; name: string; size?: number; className?: string }) {
  const { background, color } = avatarPair(personId)
  return (
    <span
      role="img"
      aria-label={name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-[12px] font-bold', className)}
      style={{ width: size, height: size, background, color }}
    >
      <span aria-hidden>{initials(name)}</span>
    </span>
  )
}
