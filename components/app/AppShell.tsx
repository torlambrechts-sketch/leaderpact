import 'server-only'
import * as React from 'react'
import { getTranslations } from 'next-intl/server'
import type { NavKey } from '@/components/lp/nav'
import { PRODUCT_NAME } from '@/lib/brand'
import type { Shell } from '@/lib/groups/load'
import { AppTopBar } from '@/components/app/AppTopBar'

/**
 * The signed-in shell (handoff sections 4 and 5): the sticky top bar with the navigation, the group
 * switcher for anyone in more than one group, the plan and the avatar; below 768 px the bottom bar. Every
 * group is on the Free plan until plans exist (milestone 8). `active` names the entry for a page outside a
 * group's segment (Me).
 */
export async function AppShell({ shell, active, children }: { shell: Shell; active?: NavKey; children: React.ReactNode }) {
  const nav = await getTranslations('nav')
  const t = await getTranslations('appShell')
  const labels = {
    home: nav('home'), group: nav('group'), people: nav('people'), assess: nav('assess'), results: nav('results'),
    plan: nav('plan'), meetings: nav('meetings'), me: nav('me'), more: nav('more'), settings: nav('settings'),
    switchGroup: nav('switchGroup'), groups: nav('groups'), primary: nav('primary'), planAndBilling: nav('planAndBilling'),
  }
  return (
    <>
      <AppTopBar
        productName={PRODUCT_NAME}
        groups={shell.groups.map((g) => ({ slug: g.id, name: g.name }))}
        currentGroup={shell.current.id}
        labels={labels}
        plan={{ label: t('freePlan') }}
        person={{ id: shell.person.id, name: shell.person.name, title: t(shell.current.role === 'leader' ? 'titleLeader' : 'titleMember', { name: shell.person.name }) }}
        accountLabels={{ menu: t('account'), signOut: t('signOut') }}
        active={active}
      />
      {/* the bottom bar is fixed below 768 px; the page keeps clear of it */}
      <main id="main" className="pb-28 md:pb-12">
        {children}
      </main>
    </>
  )
}
