import * as React from 'react'
import { cn } from '@/lib/cn'
import { avatarPair, initials } from '@/components/lp/avatar-colours'

/**
 * A 34 px circle with initials at 12 / 700, in the person's avatar pair (spec, avatar). The pair comes
 * from a stable hash of the person (handoff section 4); the design instead gives each seeded member a fixed
 * index, which a fixture can match by its choice of ids.
 */
export function Avatar({ personId, name, title, size = 34, className }: { personId: string; name: string; title?: string; size?: number; className?: string }) {
  const { background, color } = avatarPair(personId)
  return (
    <span
      role="img"
      aria-label={name}
      title={title}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-[12px] font-bold', className)}
      style={{ width: size, height: size, background, color }}
    >
      <span aria-hidden>{initials(name)}</span>
    </span>
  )
}
