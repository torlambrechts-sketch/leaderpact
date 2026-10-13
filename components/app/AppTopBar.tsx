'use client'
import * as React from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { TopBar, type TopBarProps } from '@/components/lp/TopBar'
import { NAV, type NavKey } from '@/components/lp/nav'
import { signOut } from '@/lib/auth/actions'

/**
 * The app shell's top bar (handoff sections 4 and 5), with the active entry read from the page's own
 * segment, or given (Me, which is not per group). It lists the pages that exist; the gear leads to
 * Settings, whose one tab so far is Plan and billing (D-24, D-30, D-32, D-33).
 */
export const SHELL_ITEMS: readonly NavKey[] = ['home', 'group', 'people', 'assess', 'results', 'plan', 'meetings', 'me']

export function AppTopBar(
  props: Omit<TopBarProps, 'active' | 'items' | 'showSettings' | 'account' | 'homeHref'> & { accountLabels: { menu: string; signOut: string }; active?: NavKey },
) {
  const segment = useSelectedLayoutSegment()
  const { accountLabels, active: given, ...rest } = props
  const active = given ?? NAV.find((n) => n.segment === segment)?.key
  return (
    <TopBar
      {...rest}
      active={active}
      items={SHELL_ITEMS}
      showSettings
      homeHref={`/app/${props.currentGroup}/home`}
      account={{ ...accountLabels, action: signOut }}
    />
  )
}
