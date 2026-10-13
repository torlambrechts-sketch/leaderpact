import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/cn'
import { tabClass, tabOnClass, tabStripClass } from '@/components/ui/tab-classes'

/**
 * Tabs that change the URL (Group, Results, Plan): links with aria-current, in the same segmented strip as
 * components/ui/tabs. In-page panels use the Radix tabs.
 */
export function LinkTabs({ tabs, label, prefetch, className }: { tabs: { href: string; label: string; active?: boolean }[]; label: string; prefetch?: boolean; className?: string }) {
  return (
    <nav aria-label={label} className={cn(tabStripClass, className)}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href as Route} prefetch={prefetch} aria-current={t.active ? 'page' : undefined} className={cn(tabClass, t.active ? tabOnClass : 'hover:text-ink')}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
