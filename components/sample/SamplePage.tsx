import 'server-only'
import * as React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppPage, PageProblem } from '@/components/app/AppPage'
import { SampleBanner } from '@/components/lp/SampleBanner'
import { buttonVariants } from '@/components/ui/button'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { formatPrice, loadTeamPrice } from '@/lib/plans/load'
import { SIGN_IN_PATH, upgradePath } from '@/lib/routes'

/**
 * A paid area on the Free plan (handoff 6.19): the sample banner over seeded sample content, the whole page
 * marked Sample (handoff section 10). The leader sees the Team plan's price and Upgrade; a member is asked to
 * ask their team leader, with no price. Every paid area is built now (milestone 13), so a group with the Team
 * plan or its trial sees its own pages; the sample shows otherwise only when the plan cannot be read, and the
 * banner says so (D-33, D-48). A person who is not a current member of the group sees no sample, only that the
 * group is not theirs.
 */
export async function SamplePage({ group, children }: { group: string; children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const shell = await loadShell(group, user.id)
  if (shell === null || shell === 'none') {
    const t = await getTranslations('invite')
    return <PageProblem title={shell === null ? t('readFailed') : t('notFoundTitle')} body={shell === 'none' ? t('notFoundBody') : undefined} />
  }
  const t = await getTranslations('sample')
  const role = shell.current.role
  const plan = await loadGroupPlan(group)
  const free = plan !== null && plan !== 'none' && plan.access === 'free'
  if (!free) {
    return (
      <AppPage>
        <SampleBanner audience="member" chip={t('chip')} text={t('bannerUnknown')} />
        {children}
      </AppPage>
    )
  }
  const price = role === 'leader' ? await loadTeamPrice() : null
  const text = role === 'member' ? t('bannerMember') : price ? t('bannerLeader', { price: formatPrice(price) }) : t('bannerLeaderNoPrice')
  return (
    <AppPage>
      <SampleBanner
        audience={role}
        chip={t('chip')}
        text={text}
        action={
          <Link href={upgradePath(group) as Route} className={buttonVariants({ variant: 'on-ink' })}>
            {t('upgrade')}
          </Link>
        }
      />
      {children}
    </AppPage>
  )
}
