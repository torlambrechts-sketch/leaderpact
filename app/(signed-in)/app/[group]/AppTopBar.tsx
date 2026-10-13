'use client'
import * as React from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { TopBar, type TopBarProps } from '@/components/lp/TopBar'
import { NAV, type NavKey } from '@/components/lp/nav'
import { signOut } from '@/lib/auth/actions'

/**
 * The app shell's top bar for a group (handoff sections 4 and 5), with the active entry read from the
 * page's own segment. It lists the pages that exist: Me waits for the Leader Profile (milestone 7), the
 * gear for Settings, and the plan pill links nowhere until plan and billing exist (milestone 8) (D-24, D-30).
 */
export const SHELL_ITEMS: readonly NavKey[] = ['home', 'group', 'people', 'assess', 'results', 'plan', 'meetings']

export function AppTopBar(props: Omit<TopBarProps, 'active' | 'items' | 'showSettings' | 'account' | 'homeHref'> & { accountLabels: { menu: string; signOut: string } }) {
  const segment = useSelectedLayoutSegment()
  const active = NAV.find((n) => n.segment === segment)?.key
  const { accountLabels, ...rest } = props
  return (
    <TopBar
      {...rest}
      active={active}
      items={SHELL_ITEMS}
      showSettings={false}
      homeHref={`/app/${props.currentGroup}/home`}
      account={{ ...accountLabels, action: signOut }}
    />
  )
}
