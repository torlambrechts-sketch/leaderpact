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
  labels: Record<NavKey, string> & { more: string; settings: string; switchGroup: string; groups: string; primary: string; planAndBilling: string }
  plan: { label: string; href: string }
  /** title: the design's tooltip, e.g. 'Kari Nordmann · Leader' */
  person: { id: string; name: string; title?: string }
  /** the specimens page draws the bar in place; the app makes it sticky */
  sticky?: boolean
  /** Next's link prefetching; off on the specimens page, whose links lead to screens not built yet */
  prefetch?: boolean
}

export function TopBar({ productName, groups, currentGroup, active, labels, plan, person, sticky = true, prefetch }: TopBarProps) {
  const group = groups.find((g) => g.slug === currentGroup) ?? groups[0]
  return (
    <>
      <header className={cn('z-20 bg-[var(--bg-veil)] px-4 py-3 backdrop-blur-[10px] md:px-gutter md:py-3.5', sticky && 'sticky top-0')}>
        <div data-part="bar" className="mx-auto flex min-h-[58px] max-w-app items-center gap-3.5 rounded-pill border border-bar bg-bar py-2 pl-3.5 pr-2.5">
          <Link href={'/' as Route} prefetch={prefetch} className="shrink-0 hover:text-ink max-md:min-h-[44px] max-md:inline-flex max-md:items-center">
            <Logo name={productName} />
          </Link>

          {groups.length > 1 && group && (
            <DropdownMenu>
              <DropdownMenuTrigger className="hidden items-center gap-1 whitespace-nowrap rounded-btn-sm px-2 py-[7px] text-[12.5px] font-semibold text-nav-ink md:inline-flex">
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

          <div className="ml-auto flex items-center gap-3.5 md:ml-0">
            <PlanPill href={plan.href} label={plan.label} title={labels.planAndBilling} prefetch={prefetch} />
            {/* the design's tray holds settings, a layout switch and a width switch; section 11 keeps settings */}
            <div className="hidden rounded-btn-sm bg-rule-soft p-[3px] md:flex">
              <Link
                href={`/app/${currentGroup}/settings` as Route}
                prefetch={prefetch}
                aria-label={labels.settings}
                title={labels.settings}
                className="inline-flex h-[30px] w-8 items-center justify-center rounded-r8 bg-surface text-accent-deep hover:text-accent-deep"
              >
                <Settings aria-hidden size={15} />
              </Link>
            </div>
            <Avatar personId={person.id} name={person.name} title={person.title} />
          </div>
        </div>
      </header>

      <PhoneBar currentGroup={currentGroup} active={active} labels={labels} sticky={sticky} prefetch={prefetch} />
    </>
  )
}

function PhoneBar({ currentGroup, active, labels, sticky, prefetch }: Pick<TopBarProps, 'currentGroup' | 'active' | 'labels' | 'sticky' | 'prefetch'>) {
  // The design has no phone layout (spec, phone bottom bar). This reuses the nav-item tokens on a --bar
  // surface: 12.5 / 600, a 16 px icon, the active item in ink, radius 10, every target 44 px or more.
  const more = NAV.filter((n) => !PHONE_BAR.includes(n.key))
  const item = 'flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 rounded-btn-sm text-[12.5px] font-semibold'
  return (
    <nav
      aria-label={labels.primary}
      className={cn('z-20 border-t border-bar bg-bar px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 md:hidden', sticky ? 'fixed inset-x-0 bottom-0' : 'relative')}
    >
      <ul className="mx-auto flex max-w-app items-stretch gap-1">
        {PHONE_BAR.map((key) => {
          const nav = NAV.find((n) => n.key === key)!
          const Icon = nav.icon
          const on = active === key
          return (
            <li key={key} className="flex-1">
              <Link
                href={navHref(currentGroup, key) as Route}
                prefetch={prefetch}
                aria-current={on ? 'page' : undefined}
                className={cn(item, on ? 'bg-ink text-white hover:text-white' : 'text-nav-ink hover:text-nav-ink')}
              >
                <Icon aria-hidden size={16} />
                {labels[key]}
              </Link>
            </li>
          )
        })}
        <li className="flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(item, 'text-nav-ink')}>
              <MoreIcon aria-hidden size={16} />
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
