import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Lock } from 'lucide-react'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { NextPulse } from '@/components/assess/NextPulse'
import { OpenRound } from '@/components/assess/OpenRound'
import { PulseRhythm } from '@/components/assess/PulseRhythm'
import { RoundList } from '@/components/assess/RoundList'
import { Card } from '@/components/lp/Card'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { SampleAssess } from '@/components/sample/SampleAssess'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { loadPulses } from '@/lib/pulses/load'
import { loadRounds } from '@/lib/rounds/load'
import { SIGN_IN_PATH, groupPath, resultsPath, roundPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('assessTitle', { product: PRODUCT_NAME }) }
}

/**
 * Assess (handoff 6.10, design `assess`). On the Free plan it is the sample page (handoff 6.19); with the
 * Team plan or its trial, the group's own rounds: a plain list with phase, dates and the count of answers,
 * and for the leader the Full diagnostic to open. Every current member is asked; there is no picker. Pulses
 * (handoff 6.16) share the list; beside it, the pulse rhythm and what the next pulse asks, in its order.
 * Section 11's corrections: no overview tiles, library, schedule or coverage tabs, and no "release results".
 */
export default async function AssessPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const plan = await loadGroupPlan(group)
  if (plan === null || plan === 'none' || plan.access === 'free') return <SampleAssess group={group} />

  const [t, tInvite] = await Promise.all([getTranslations('assess'), getTranslations('invite')])
  const [shell, data, pulses] = await Promise.all([loadShell(group, user.id), loadRounds(group), loadPulses(group)])
  if (shell === null || data === null || pulses === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || data === 'none' || pulses === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  const day = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  const rounds = data.rounds.map((r) => ({
    ...r,
    from: day(r.opens_at),
    to: r.closes_at ? day(r.closes_at) : null,
    answerHref: r.phase === 'answering' && r.me === 'to_answer' ? roundPath(group, r.id) : null,
    resultsHref: r.phase === 'released' ? resultsPath(group, r.id) : null,
  }))
  const open = data.rounds.some((r) => r.phase === 'answering')

  return (
    <ClientMessages namespaces={['assess', 'pulses']}>
      <AppPage>
        <PageTitle eyebrow={shell.current.name} title={t('title')} />
        <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_380px]">
          <Card large>
            <SectionHeader title={t('roundsTitle')} meta={t('roundsMeta')} />
            {rounds.length > 0 ? (
              <RoundList rounds={rounds} />
            ) : (
              <p className="m-0 border-t border-divider pt-3 text-[13.5px] text-text-2 max-md:text-[15px]">{data.leader ? t('emptyLeader') : t('emptyMember')}</p>
            )}
          </Card>
          <div className="flex flex-col gap-4">
            {data.can_open ? (
              <OpenRound
                group={group}
                members={data.members}
                k={data.k}
                questions={data.questions}
                days={data.window_days}
                membersHref={`${groupPath(group)}?tab=members`}
              />
            ) : data.leader && open ? (
              <p className="m-0 rounded-btn bg-surface px-3.5 py-3 text-[13px] text-text-2 max-md:text-[15px]">{t('oneAtATime')}</p>
            ) : data.leader ? (
              <p className="m-0 flex items-center gap-2 rounded-btn bg-surface px-3.5 py-3 text-[13px] text-text-2 max-md:text-[15px]">
                <Lock aria-hidden size={15} className="shrink-0 text-ink" />
                {t('openRefusedPlan')}
              </p>
            ) : null}
            <PulseRhythm
              group={group}
              running={pulses.running}
              next={pulses.running && pulses.next_at ? day(pulses.next_at) : null}
              weeks={pulses.weeks}
              days={pulses.days}
              weeksRange={[pulses.weeks_min, pulses.weeks_max]}
              daysRange={[pulses.days_min, pulses.days_max]}
              canManage={pulses.can_manage}
              leader={pulses.leader}
              members={data.members}
              k={data.k}
              open={open}
              membersHref={`${groupPath(group)}?tab=members`}
            />
            <NextPulse pulses={pulses} />
            <Card large className="flex flex-col gap-2">
              <h2 className="m-0 text-[16px] font-bold">{t('howTitle')}</h2>
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">
                <li>{t('howAsked')}</li>
                <li>{t('howStored')}</li>
                <li>{t('howOpens', { k: data.k })}</li>
              </ul>
            </Card>
          </div>
        </div>
      </AppPage>
    </ClientMessages>
  )
}
