import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/cn'

/**
 * Tabs that change the URL (Group, Results, Plan, Settings): links with aria-current, styled as the tabs
 * are (active black with white text, others --text-2). In-page panels use components/ui/tabs (Radix).
 */
export function LinkTabs({ tabs, label, prefetch, className }: { tabs: { href: string; label: string; active?: boolean }[]; label: string; prefetch?: boolean; className?: string }) {
  return (
    <nav aria-label={label} className={cn('flex flex-wrap gap-1', className)}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href as Route}
          prefetch={prefetch}
          aria-current={t.active ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-[36px] items-center rounded-btn-sm px-3 py-[7px] text-[13px] font-semibold transition-colors',
            t.active ? 'bg-ink text-white hover:text-white' : 'text-text-2 hover:text-ink',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
