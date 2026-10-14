import 'server-only'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import type { NavKey } from '@/components/lp/nav'
import { PRODUCT_NAME } from '@/lib/brand'
import type { Shell } from '@/lib/groups/load'
import { loadGroupPlan, type GroupPlan } from '@/lib/billing/load'
import { dateFormat } from '@/lib/i18n/dates'
import { planBillingPath } from '@/lib/routes'
import { AppTopBar } from '@/components/app/AppTopBar'
import { HideOn } from '@/components/app/HideOn'
import { WarningBox } from '@/components/lp/WarningBox'

/**
 * The signed-in shell (handoff sections 4 and 5): the sticky top bar with the navigation, the group
 * switcher for anyone in more than one group, the plan and the avatar; below 768 px the bottom bar. The
 * plan pill names the group's plan and leads to Plan and billing. While a payment has failed, every page
 * says so, the grace and then read-only (handoff 6.18), except Plan and billing, which says it in its own
 * card. `active` names the entry for a page outside a group's segment (Me).
 */
const PILL = { free: 'freePlan', trial: 'trialPlan', team: 'teamPlan', grace: 'teamPlan', read_only: 'readOnlyPlan' } as const

async function PlanNotice({ plan, group, leader }: { plan: GroupPlan; group: { id: string; name: string }; leader: boolean }) {
  const t = await getTranslations('appShell')
  const date = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long' }).format(new Date(iso))
  const text =
    plan.access === 'grace' && plan.graceEndsAt
      ? t('graceNotice', { group: group.name, date: date(plan.graceEndsAt) })
      : plan.access === 'read_only'
        ? t('readOnlyNotice', { group: group.name })
        : null
  if (!text) return null
  return (
    <div className="mx-auto mt-4 max-w-[1280px] px-4 md:mt-5 md:px-8 xl:px-[52px]">
      <WarningBox
        action={
          leader ? (
            <Link href={planBillingPath(group.id) as Route} className="self-start rounded-r8 border border-flag px-2.5 py-[5px] font-bold text-flag-ink max-md:min-h-[44px]">
              {t('planAndBilling')}
            </Link>
          ) : undefined
        }
      >
        {text}
      </WarningBox>
    </div>
  )
}
export async function AppShell({ shell, active, children }: { shell: Shell; active?: NavKey; children: React.ReactNode }) {
  const nav = await getTranslations('nav')
  const t = await getTranslations('appShell')
  const plan = await loadGroupPlan(shell.current.id)
  const known = plan !== null && plan !== 'none' ? plan : null
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
        plan={known ? { label: t(PILL[known.access]), href: planBillingPath(shell.current.id) } : undefined}
        person={{ id: shell.person.id, name: shell.person.name, title: t(shell.current.role === 'leader' ? 'titleLeader' : 'titleMember', { name: shell.person.name }) }}
        accountLabels={{ menu: t('account'), signOut: t('signOut') }}
        active={active}
      />
      {/* the bottom bar is fixed below 768 px; the page keeps clear of it */}
      <main id="main" className="pb-28 md:pb-12">
        {known && (
          <HideOn suffix="/settings/plan">
            <PlanNotice plan={known} group={shell.current} leader={shell.current.role === 'leader'} />
          </HideOn>
        )}
        {children}
      </main>
    </>
  )
}
