import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/cn'

/** The plan, in --accent with --accent-ink text, linking to plan and billing (handoff section 4). */
export function PlanPill({ href, label, prefetch, className }: { href: string; label: string; prefetch?: boolean; className?: string }) {
  return (
    <Link
      href={href as Route}
      prefetch={prefetch}
      className={cn('inline-flex min-h-[28px] items-center whitespace-nowrap rounded-pill bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-ink hover:text-accent-ink', className)}
    >
      {label}
    </Link>
  )
}
