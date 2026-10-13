import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { SimpleBar } from '@/components/lp/SimpleBar'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadShell } from '@/lib/groups/load'
import { SIGN_IN_PATH } from '@/lib/routes'
import { AppTopBar } from './AppTopBar'

export const dynamic = 'force-dynamic'

/**
 * The app shell for a group (handoff sections 4 and 5): the sticky top bar with the navigation, the group
 * switcher for anyone in more than one group, the plan and the avatar; below 768 px the bottom bar. A
 * person who is not a current member of the group gets the simple bar, and the page says the group is
 * not theirs. Every group is on the Free plan until plans exist (milestone 8).
 */
export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const shell = await loadShell(group, user.id)
  if (shell === null || shell === 'none') {
    return (
      <>
        <SimpleBar />
        <main id="main">{children}</main>
      </>
    )
  }
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
      />
      {/* the bottom bar is fixed below 768 px; the page keeps clear of it */}
      <main id="main" className="pb-28 md:pb-12">
        {children}
      </main>
    </>
  )
}
