'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ChevronsUpDown, Settings } from 'lucide-react'
import { Avatar } from '@/components/lp/Avatar'
import { Logo } from '@/components/lp/Logo'
import { NavItem } from '@/components/lp/NavItem'
import { PlanPill } from '@/components/lp/PlanPill'
import { MoreIcon, NAV, PHONE_BAR, navHref, type NavKey } from '@/components/lp/nav'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'

/**
 * The app shell's top bar (handoff section 4): sticky, the page colour at 92% with a 10 px blur, and in
 * it a pill in --bar, min-height 58: logo, navigation, plan pill, settings, avatar. A group switcher shows
 * for anyone in more than one group (handoff section 5). Only the horizontal layout is built; the design's
 * sidebar and width switch are not (section 11).
 *
 * Below 768 px the bar keeps the logo, the plan pill and the avatar, and a bottom bar carries Home, Group,
 * Meetings, Plan and More.
 */
export interface TopBarProps {
  productName: string
  groups: { slug: string; name: string }[]
  currentGroup: string
  active?: NavKey
  labels: Record<NavKey, string> & { more: string; settings: string; switchGroup: string; groups: string; primary: string }
  plan: { label: string; href: string }
  person: { id: string; name: string }
  /** the specimens page draws the bar in place; the app makes it sticky */
  sticky?: boolean
  /** Next's link prefetching; off on the specimens page, whose links lead to screens not built yet */
  prefetch?: boolean
}

export function TopBar({ productName, groups, currentGroup, active, labels, plan, person, sticky = true, prefetch }: TopBarProps) {
  const group = groups.find((g) => g.slug === currentGroup) ?? groups[0]
  return (
    <>
      <header className={cn('z-40 bg-[var(--bg-veil)] px-4 pt-3 backdrop-blur-[10px] md:px-gutter md:pt-5', sticky && 'sticky top-0')}>
        <div className="mx-auto flex min-h-[58px] max-w-app items-center gap-3 rounded-pill border border-bar bg-bar py-2 pl-4 pr-2 md:gap-4">
          <Link href={'/' as Route} prefetch={prefetch} className="shrink-0 hover:text-ink">
            <Logo name={productName} />
          </Link>

          {groups.length > 1 && group && (
            <DropdownMenu>
              <DropdownMenuTrigger className="hidden min-h-[36px] items-center gap-1 rounded-btn-sm px-2 text-[12.5px] font-semibold text-nav-ink hover:bg-white/60 md:inline-flex">
                {group.name}
                <ChevronsUpDown aria-hidden size={14} />
                <span className="sr-only">{labels.switchGroup}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{labels.groups}</DropdownMenuLabel>
                {groups.map((g) => (
                  <DropdownMenuItem key={g.slug} asChild>
                    <Link href={navHref(g.slug, active ?? 'home') as Route} prefetch={prefetch}>{g.name}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <nav aria-label={labels.primary} className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex">
            {NAV.map((n) => (
              <NavItem key={n.key} href={navHref(currentGroup, n.key)} label={labels[n.key]} icon={n.icon} active={active === n.key} prefetch={prefetch} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <PlanPill href={plan.href} label={plan.label} prefetch={prefetch} />
            <Link
              href={`/app/${currentGroup}/settings` as Route}
              prefetch={prefetch}
              aria-label={labels.settings}
              className="hidden h-9 w-9 items-center justify-center rounded-btn-sm text-nav-ink hover:bg-white/60 hover:text-ink md:inline-flex"
            >
              <Settings aria-hidden size={17} />
            </Link>
            <Avatar personId={person.id} name={person.name} />
          </div>
        </div>
      </header>

      <PhoneBar currentGroup={currentGroup} active={active} labels={labels} sticky={sticky} prefetch={prefetch} />
    </>
  )
}

function PhoneBar({ currentGroup, active, labels, sticky, prefetch }: Pick<TopBarProps, 'currentGroup' | 'active' | 'labels' | 'sticky' | 'prefetch'>) {
  const more = NAV.filter((n) => !PHONE_BAR.includes(n.key))
  return (
    <nav
      aria-label={labels.primary}
      className={cn('z-40 border-t border-bar bg-[var(--bg-veil)] px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-[10px] md:hidden', sticky ? 'fixed inset-x-0 bottom-0' : 'relative')}
    >
      <ul className="mx-auto flex max-w-app items-stretch justify-around">
        {PHONE_BAR.map((key) => {
          const item = NAV.find((n) => n.key === key)!
          const Icon = item.icon
          const on = active === key
          return (
            <li key={key} className="flex-1">
              <Link
                href={navHref(currentGroup, key) as Route}
                prefetch={prefetch}
                aria-current={on ? 'page' : undefined}
                className={cn('flex min-h-[56px] flex-col items-center justify-center gap-1 text-[12px] font-semibold', on ? 'text-ink' : 'text-text-2')}
              >
                <Icon aria-hidden size={20} strokeWidth={on ? 2.4 : 2} />
                {labels[key]}
              </Link>
            </li>
          )
        })}
        <li className="flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-h-[56px] w-full flex-col items-center justify-center gap-1 text-[12px] font-semibold text-text-2">
              <MoreIcon aria-hidden size={20} />
              {labels.more}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              {more.map((n) => (
                <DropdownMenuItem key={n.key} asChild>
                  <Link href={navHref(currentGroup, n.key) as Route} prefetch={prefetch}>
                    <n.icon aria-hidden size={16} />
                    {labels[n.key]}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem asChild>
                <Link href={`/app/${currentGroup}/settings` as Route} prefetch={prefetch}>
                  <Settings aria-hidden size={16} />
                  {labels.settings}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ul>
    </nav>
  )
}
