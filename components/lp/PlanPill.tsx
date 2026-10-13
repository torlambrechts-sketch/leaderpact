import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/cn'

/**
 * The plan (spec, plan-pill): --accent, --accent-ink, 11.5 / 700, padding 4 by 10, round. Links to plan and
 * billing; without an address (before that page exists) it is a label, not a link that leads nowhere.
 */
export function PlanPill({ href, label, title, prefetch, className }: { href?: string; label: string; title?: string; prefetch?: boolean; className?: string }) {
  if (!href) {
    return <span className={cn('inline-flex items-center whitespace-nowrap rounded-pill bg-accent px-2.5 py-1 text-[11.5px] font-bold text-accent-ink max-md:px-3', className)}>{label}</span>
  }
  return (
    <Link
      href={href as Route}
      prefetch={prefetch}
      title={title}
      className={cn('inline-flex items-center whitespace-nowrap rounded-pill bg-accent px-2.5 py-1 text-[11.5px] font-bold text-accent-ink hover:text-accent-ink max-md:min-h-[44px] max-md:px-3', className)}
    >
      {label}
    </Link>
  )
}
