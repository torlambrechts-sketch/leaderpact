import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A top-bar navigation link (spec, nav-item): padding 7 by 8, gap 5, radius 10, 12.5 / 600, a 16 px icon.
 * Active: ink fill, white text. Inactive: --nav-ink on no fill. The design styles no hover. A real link
 * with aria-current, never a clickable div; 44 px high on a phone.
 */
export function NavItem({ href, label, icon: Icon, active = false, prefetch, className }: { href: string; label: string; icon: LucideIcon; active?: boolean; prefetch?: boolean; className?: string }) {
  return (
    <Link
      href={href as Route}
      prefetch={prefetch}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-[5px] whitespace-nowrap rounded-btn-sm px-2 py-[7px] text-[12.5px] font-semibold max-md:min-h-[44px]',
        active ? 'bg-ink text-white hover:text-white' : 'text-nav-ink hover:text-nav-ink',
        className,
      )}
    >
      <Icon aria-hidden size={16} strokeWidth={2} />
      {label}
    </Link>
  )
}
