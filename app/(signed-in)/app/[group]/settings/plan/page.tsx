import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import { PageProblem } from '@/components/app/AppPage'
import { SettingsFrame } from '@/components/app/SettingsFrame'
import { DevEvents, KeepTeam, StartTrial, SwitchToFree, type DevEvent } from '@/components/billing/BillingActions'
import { PlanCards, type PlanCard } from '@/components/billing/PlanCards'
import { FREE_ITEMS, TEAM_ITEMS } from '@/components/billing/plan-items'
import { Card } from '@/components/lp/Card'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { WarningBox } from '@/components/lp/WarningBox'
import { buttonVariants } from '@/components/ui/button'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { countryName } from '@/lib/billing/countries'
import { loadBilling, loadBillingRules, loadGroupPlan, type GroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { formatPrice, loadTeamPrices } from '@/lib/plans/load'
import { SIGN_IN_PATH, upgradePath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('planBillingTitle', { product: PRODUCT_NAME }) }
}

/** The development adapter's events that apply to the plan as it is now */
function devEvents(plan: GroupPlan): DevEvent[] {
  if (plan.access === 'trial') return ['trial_ended']
  if (plan.access === 'team' && plan.state === 'active') return ['payment_failed']
  if (plan.access === 'grace') return ['grace_ended', 'payment_received']
  if (plan.access === 'read_only') return ['payment_received']
  return []
}

/**
 * Plan and billing (handoff 6.18, design `settings` plan tab). Every member sees the group's plan and its
 * state; the leader alone sees the billing details, changes the plan, starts the one trial (owner D2a) and
 * cancels. A member sees no price (handoff 6.19, D-30). A failed payment shows its grace and then
 * read-only; a cancel or an unpaid trial shows how long the Team data is kept. With the development
 * adapter the leader can make its later events happen. Section 11: no fixed card number, no "VAT 25%", and
 * no invoice list, since no invoice exists until a vendor makes one (D-33).
 */
export default async function PlanBillingPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tInvite] = await Promise.all([getTranslations('billing'), getTranslations('invite')])
  const [shell, plan] = await Promise.all([loadShell(group, user.id), loadGroupPlan(group)])
  if (shell === null || plan === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || plan === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  const leader = shell.current.role === 'leader'
  const [prices, billing, rules] = await Promise.all([
    leader ? loadTeamPrices() : null,
    leader && plan.state ? loadBilling(group) : null,
    loadBillingRules(),
  ])
  const date = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  const groupName = shell.current.name
  const free = plan.access === 'free'
  const canBuy = leader && (free || plan.access === 'trial')
  const offerTrial = leader && free && plan.trialAvailable && rules !== null

  // the plan as it stands, in one card for everyone
  const status = (() => {
    if (plan.access === 'trial' && plan.trialEndsAt) {
      return { title: t('statusTrial'), body: t('trialEnds', { date: date(plan.trialEndsAt) }), note: rules ? t('trialKept', { days: rules.retentionDays }) : null }
    }
    if (plan.access === 'grace' && plan.graceEndsAt) return { title: t('statusTeam'), warning: t('graceBody', { date: date(plan.graceEndsAt) }) }
    if (plan.access === 'read_only') return { title: t('statusReadOnly'), warning: t('readOnlyBody') }
    if (plan.access === 'team' && plan.state === 'cancelled' && plan.cancelEffectiveAt && plan.deletionDueAt) {
      return { title: t('statusTeam'), warning: t('cancelledBody', { date: date(plan.cancelEffectiveAt), deletion: date(plan.deletionDueAt) }) }
    }
    if (plan.access === 'team') return { title: t('statusTeam'), body: leader && plan.periodEnd ? t('renews', { date: date(plan.periodEnd) }) : t('teamBody') }
    // Free: after an unpaid trial or an ended plan, the Team data waits for its deletion date
    if (plan.deletionDueAt) {
      const ended = plan.trialEndsAt ? t('trialEnded', { date: date(plan.trialEndsAt) }) : plan.cancelEffectiveAt ? t('teamEnded', { date: date(plan.cancelEffectiveAt) }) : null
      return { title: t('statusFree'), warning: [ended, t('keptUntil', { date: date(plan.deletionDueAt) })].filter(Boolean).join(' ') }
    }
    return { title: t('statusFree'), body: t('freeBody') }
  })()

  const plans: PlanCard[] = [
    { key: 'free', name: t('free'), per: t('freePer'), items: FREE_ITEMS.map((k) => t(k)), current: free },
    {
      key: 'team',
      name: t('team'),
      price: leader && prices ? formatPrice(prices.year) : undefined,
      per: leader && prices ? t('teamPer', { month: formatPrice(prices.month) }) : undefined,
      items: TEAM_ITEMS.map((k) => t(k)),
      current: !free,
      action: canBuy ? (
        <>
          <Link href={upgradePath(group) as Route} className={buttonVariants({ className: 'gap-2' })}>
            {t('upgrade')}
            <ArrowRight aria-hidden size={15} />
          </Link>
          {offerTrial && (
            <>
              <StartTrial group={group} days={rules.trialDays} />
              <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('trialNote', { days: rules.trialDays })}</p>
            </>
          )}
        </>
      ) : !leader && free ? (
        <p className="m-0 text-[13.5px] font-semibold max-md:text-[15px]">{t('askLeader')}</p>
      ) : undefined,
    },
  ]
  const events = leader && plan.adapter === 'development' ? devEvents(plan) : []

  return (
    <ClientMessages namespaces={['billing']}>
      <SettingsFrame group={{ id: group, name: groupName }} active="plan">
        <Card large className="flex flex-col gap-3">
          <SectionHeader title={status.title} meta={t('planMeta')} className="mb-0" />
          {status.body && <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{status.body}</p>}
          {status.warning && <WarningBox>{status.warning}</WarningBox>}
          {status.note && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{status.note}</p>}
          {leader && plan.access === 'trial' && (
            <Link href={upgradePath(group) as Route} className={buttonVariants({ className: 'gap-2 self-start' })}>
              {t('upgrade')}
              <ArrowRight aria-hidden size={15} />
            </Link>
          )}
          {leader && plan.access === 'team' && plan.state === 'cancelled' && <KeepTeam group={group} />}
          {!leader && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('onlyLeader')}</p>}
        </Card>

        {(free || plan.access === 'trial') && (
          <Card large className="flex flex-col gap-4">
            <SectionHeader title={t('plansTitle')} meta={t('plansMeta')} className="mb-0" />
            <PlanCards plans={plans} currentLabel={t('current')} label={t('plansTitle')} />
          </Card>
        )}

        {leader && billing && billing !== 'none' && (
          <Card large className="flex flex-col gap-3">
            <SectionHeader title={t('billingTitle')} meta={t('billingMeta')} className="mb-0" />
            <dl className="m-0 grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13.5px] max-md:text-[15px]">
              <dt className="text-text-2">{t('rowPrice')}</dt>
              <dd className="m-0 font-semibold">
                {t(billing.interval === 'year' ? 'pricePerYear' : 'pricePerMonth', { price: formatPrice({ amountMinor: billing.amountMinor, currency: billing.currency, interval: billing.interval }) })}
              </dd>
              <dt className="text-text-2">{t('rowPayment')}</dt>
              <dd className="m-0">{billing.method === 'card' ? t('methodCard') : t('methodInvoiceTo', { email: billing.invoiceEmail ?? '' })}</dd>
              <dt className="text-text-2">{t('rowCompany')}</dt>
              <dd className="m-0 break-words">{billing.company}</dd>
              {billing.orgNumber && (
                <>
                  <dt className="text-text-2">{t('rowOrgNumber')}</dt>
                  <dd className="m-0">{billing.orgNumber}</dd>
                </>
              )}
              <dt className="text-text-2">{t('rowCountry')}</dt>
              <dd className="m-0">{countryName(billing.country)}</dd>
              {billing.reference && (
                <>
                  <dt className="text-text-2">{t('rowReference')}</dt>
                  <dd className="m-0 break-words">{billing.reference}</dd>
                </>
              )}
              <dt className="text-text-2">{t('rowSince')}</dt>
              <dd className="m-0">{date(billing.startedAt)}</dd>
            </dl>
            <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('taxNote')}</p>
            {(plan.state === 'active' || plan.state === 'past_due') && rules && (
              <SwitchToFree group={group} groupName={groupName} until={plan.state === 'active' ? date(billing.periodEnd) : null} retentionDays={rules.retentionDays} />
            )}
          </Card>
        )}

        {events.length > 0 && (
          <Card large className="flex flex-col gap-3">
            <SectionHeader title={t('devTitle')} className="mb-0" />
            <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('devBody')}</p>
            <DevEvents group={group} events={events} />
          </Card>
        )}
      </SettingsFrame>
    </ClientMessages>
  )
}
