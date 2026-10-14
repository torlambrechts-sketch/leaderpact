import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { LiveRoom } from '@/components/meetings/LiveRoom'
import { LiveSummary } from '@/components/meetings/LiveSummary'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { loadLive } from '@/lib/live/load'
import { SIGN_IN_PATH, meetingsPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('liveTitle', { product: PRODUCT_NAME }) }
}

/**
 * A meeting, live or held (handoff 6.15): while it is live, the live meeting; once held, its summary. A meeting
 * not yet started opens its agenda.
 */
export default async function LivePage({ params }: { params: Promise<{ group: string; meeting: string }> }) {
  const { group, meeting } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const agenda = `${meetingsPath(group)}?meeting=${meeting}`
  const access = await loadGroupPlan(group)
  if (access === null || access === 'none' || access.access === 'free') redirect(meetingsPath(group) as Route)

  const [t, tInvite] = await Promise.all([getTranslations('live'), getTranslations('invite')])
  const [shell, live] = await Promise.all([loadShell(group, user.id), loadLive(meeting)])
  if (shell === null || live === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />
  if (live === 'none') redirect(agenda as Route)

  return (
    <ClientMessages namespaces={['live']}>
      <AppPage>
        <PageTitle eyebrow={shell.current.name} title={live.meeting.status === 'live' ? t('title') : t('summaryTitle')} />
        {live.meeting.status === 'live' ? <LiveRoom initial={live} agendaHref={agenda} /> : <LiveSummary live={live} agendaHref={agenda} />}
      </AppPage>
    </ClientMessages>
  )
}
