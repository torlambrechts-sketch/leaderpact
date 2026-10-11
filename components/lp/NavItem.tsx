import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A top-bar navigation link: 12.5 px, 600, a 16 px icon. Active: black fill, white text, radius 10
 * (handoff section 4). A real link with aria-current, never a clickable div.
 */
export function NavItem({ href, label, icon: Icon, active = false, prefetch, className }: { href: string; label: string; icon: LucideIcon; active?: boolean; prefetch?: boolean; className?: string }) {
  return (
    <Link
      href={href as Route}
      prefetch={prefetch}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-btn-sm px-2.5 py-2 text-[12.5px] font-semibold transition-colors',
        active ? 'bg-ink text-white hover:text-white' : 'text-nav-ink hover:bg-white/60 hover:text-ink',
        className,
      )}
    >
      <Icon aria-hidden size={16} strokeWidth={2} />
      {label}
    </Link>
  )
}
