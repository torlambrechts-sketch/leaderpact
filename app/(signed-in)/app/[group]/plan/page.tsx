import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { levelText } from '@/components/lp/level'
import { PlanArea, type CandidateView, type FocusAreaView } from '@/components/plan/PlanArea'
import { resultLabels } from '@/components/results/labels'
import { SamplePlan } from '@/components/sample/SamplePlan'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { candidates } from '@/lib/plan/build'
import { loadMeetingActions, loadPlan } from '@/lib/plan/load'
import type { FocusArea } from '@/lib/plan/schema'
import type { ScaleResult } from '@/lib/results/build'
import { loadScaleResults } from '@/lib/results/load'
import { loadRounds } from '@/lib/rounds/load'
import { SIGN_IN_PATH, assessPath, scalePath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('planTitle', { product: PRODUCT_NAME }) }
}

/**
 * Plan (handoff 6.13, design `develop`): on the Free plan the sample (handoff 6.19); with the Team plan or its
 * trial, the group's own focus areas and actions (0017). Each focus area says the round it was chosen from,
 * with the scale's level and agreement label there; the scales to consider come from the newest released
 * round. A read-only group shows its plan and changes nothing.
 */
export default async function PlanPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const access = await loadGroupPlan(group)
  if (access === null || access === 'none' || access.access === 'free') return <SamplePlan group={group} />

  const [t, tInvite, { rows: labels }] = await Promise.all([getTranslations('plan'), getTranslations('invite'), resultLabels()])
  const [shell, plan, rounds, fromMeetings] = await Promise.all([loadShell(group, user.id), loadPlan(group), loadRounds(group), loadMeetingActions(group)])
  if (shell === null || plan === null || rounds === null || fromMeetings === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || plan === 'none' || rounds === 'none' || fromMeetings === 'none')
    return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  const released = rounds.rounds.filter((r) => r.kind === 'diagnostic' && r.phase === 'released')
  const newest = released[0] ?? null
  // each round a focus area was chosen from, and the newest, read once
  const roundIds = [...new Set([...plan.focus_areas.map((f) => f.round), ...(newest ? [newest.id] : [])])].filter((id) => released.some((r) => r.id === id))
  const results = new Map<string, ScaleResult[]>()
  for (const [id, rows] of await Promise.all(roundIds.map(async (id) => [id, await loadScaleResults(id)] as const))) {
    if (rows === null) return <PageProblem title={tInvite('readFailed')} />
    results.set(id, rows)
  }

  const day = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  const view = (f: FocusArea): FocusAreaView => {
    const round = released.find((r) => r.id === f.round)
    const s = results.get(f.round)?.find((r) => r.key === f.scale)
    return {
      id: f.id,
      scale: f.scale,
      name: f.name,
      from: !round
        ? t('fromUnknown')
        : s
          ? t('fromResult', { number: round.number, level: levelText(s.level), agreement: labels.agreement[s.agreement] })
          : t('from', { number: round.number }),
      href: round && s ? scalePath(group, f.scale, round.id) : null,
      closed: f.closed_at ? day(f.closed_at) : null,
      actions: f.actions.map(toView),
    }
  }
  const toView = (a: FocusArea['actions'][number]) => ({
    id: a.id,
    title: a.title,
    owner: a.owner,
    ownerName: a.owner_name,
    ownerCurrent: a.owner_current,
    dueOn: a.due_on,
    due: day(`${a.due_on}T00:00:00Z`),
    done: a.status === 'done',
    canEdit: a.can_edit,
  })
  const active = plan.focus_areas.filter((f) => f.status === 'active')
  const offered = newest
    ? {
        round: newest.id,
        number: newest.number,
        scales: candidates(results.get(newest.id) ?? [], new Set(active.map((f) => f.scale))).map(
          (s): CandidateView => ({
            key: s.key,
            name: s.name,
            level: levelText(s.level),
            levelWords: labels.levelWords(levelText(s.level)),
            agreement: labels.agreement[s.agreement],
            standing: s.standing,
            standingLabel: labels.standing[s.standing],
            evidence: s.evidence === 'strong' ? 'strong' : s.evidence === 'moderate' ? 'moderate' : 'other',
            evidenceLabel: labels.evidence(s.evidence),
            href: scalePath(group, s.key, newest.id),
          }),
        ),
      }
    : null

  return (
    <ClientMessages namespaces={['plan']}>
      <AppPage>
        <PageTitle eyebrow={shell.current.name} title={t('title')} />
        <PlanArea
          group={group}
          max={plan.max}
          canEdit={plan.can_edit}
          canChoose={plan.can_choose}
          members={plan.members}
          active={active.map(view)}
          closed={plan.focus_areas.filter((f) => f.status === 'closed').map(view)}
          candidates={offered}
          meetingActions={
            fromMeetings.length
              ? { id: 'meetings', scale: '', name: t('meetingActions'), from: t('meetingActionsFrom'), href: null, closed: null, actions: fromMeetings.map(toView) }
              : null
          }
          assessHref={assessPath(group)}
        />
      </AppPage>
    </ClientMessages>
  )
}
