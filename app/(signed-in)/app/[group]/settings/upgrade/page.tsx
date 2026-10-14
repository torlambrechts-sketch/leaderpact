import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageProblem } from '@/components/app/AppPage'
import { SettingsFrame } from '@/components/app/SettingsFrame'
import { UpgradeFlow } from '@/components/billing/UpgradeFlow'
import { TEAM_ITEMS } from '@/components/billing/plan-items'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { countries } from '@/lib/billing/countries'
import { loadGroupPlan } from '@/lib/billing/load'
import { paymentProvider } from '@/lib/billing/provider'
import { loadShell } from '@/lib/groups/load'
import { formatPrice, loadTeamPrices } from '@/lib/plans/load'
import { SIGN_IN_PATH } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('upgradeTitle', { product: PRODUCT_NAME }) }
}

/**
 * The Team plan's checkout (handoff 6.18: billing period; company details and payment method; review),
 * for the group's leader on Free or on the trial. The prices come from the plan rows, the countries from
 * the runtime, and the payment from the database's adapter (lib/billing/provider.ts). The flow stays on
 * the page after paying, so its last step can say what carried over.
 */
export default async function UpgradePage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tInvite] = await Promise.all([getTranslations('billing'), getTranslations('invite')])
  const [shell, plan, prices] = await Promise.all([loadShell(group, user.id), loadGroupPlan(group), loadTeamPrices()])
  if (shell === null || plan === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || plan === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />
  if (shell.current.role !== 'leader') return <PageProblem title={t('onlyLeaderTitle')} body={t('onlyLeader')} />
  if (prices === null) return <PageProblem title={t('pricesFailed')} />

  return (
    <ClientMessages namespaces={['billing']}>
      <SettingsFrame group={{ id: group, name: shell.current.name }} active="plan">
        <UpgradeFlow
          group={{ id: group, name: shell.current.name }}
          already={plan.access !== 'free' && plan.access !== 'trial'}
          prices={{ year: formatPrice(prices.year), month: formatPrice(prices.month) }}
          canPay={paymentProvider(plan.adapter).canPay}
          development={plan.adapter === 'development'}
          countries={countries()}
          teamItems={TEAM_ITEMS.map((k) => t(k))}
        />
      </SettingsFrame>
    </ClientMessages>
  )
}
