import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { AgendaArea, type ItemView } from '@/components/meetings/AgendaArea'
import { PlanMeeting } from '@/components/meetings/MeetingForm'
import { SampleMeetings } from '@/components/sample/SampleMeetings'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { dateFormat, isoDay } from '@/lib/i18n/dates'
import { chosenMeeting, missing } from '@/lib/meetings/build'
import { loadAgenda, loadMeetings } from '@/lib/meetings/load'
import { SIGN_IN_PATH, groupPath, meetingsPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('meetingsTitle', { product: PRODUCT_NAME }) }
}

/**
 * Meetings (handoff 6.14, design `meetings`, agenda tab): on the Free plan the sample (handoff 6.19); with the
 * Team plan or its trial, the group's own meetings (0018). The leader plans a meeting; its agenda opens at the
 * next one, or the one `?meeting=` names. The live meeting is milestone 14.
 */
export default async function MeetingsPage({ params, searchParams }: { params: Promise<{ group: string }>; searchParams: Promise<{ meeting?: string }> }) {
  const { group } = await params
  const query = await searchParams
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const access = await loadGroupPlan(group)
  if (access === null || access === 'none' || access.access === 'free') return <SampleMeetings group={group} />

  const [t, tInvite] = await Promise.all([getTranslations('meetings'), getTranslations('invite')])
  const [shell, data] = await Promise.all([loadShell(group, user.id), loadMeetings(group)])
  if (shell === null || data === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || data === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  const chosen = chosenMeeting(data.meetings, query.meeting)
  const agenda = chosen ? await loadAgenda(chosen.id) : undefined
  if (agenda === null) return <PageProblem title={tInvite('readFailed')} />

  const base = meetingsPath(group)
  const at = (on: string, time: string) => `${on}T${time}:00Z`
  const when = (on: string, time: string, minutes: number) =>
    t('when', {
      day: dateFormat({ locale: 'en', timeZone: 'UTC' }, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(at(on, time))),
      time,
      minutes,
    })
  const short = (on: string) =>
    dateFormat({ locale: 'en', timeZone: 'UTC' }, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(at(on, '12:00')))
  const due = (iso: string) =>
    dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T00:00:00Z`))
  const list = new Intl.ListFormat('en-GB', {
    style: 'long',
    type: 'conjunction',
  })
  const words = {
    type: t('need_type'),
    outcome: t('need_outcome'),
    owner: t('need_owner'),
    minutes: t('need_minutes'),
  }

  // the chips: the coming meetings soonest first, then the earlier ones, newest first
  const today = isoDay('UTC')
  const coming = data.meetings.filter((m) => m.status === 'planned' && m.meets_on >= today).reverse()
  const earlier = data.meetings.filter((m) => !coming.includes(m))

  return (
    <ClientMessages namespaces={['meetings']}>
      <AppPage>
        <PageTitle eyebrow={shell.current.name} title={t('title')} />

        {data.meetings.length > 0 && (
          <nav aria-label={t('meetingsLabel')} className="flex flex-wrap items-center gap-2">
            {[...coming, ...earlier].map((m) => (
              <Link
                key={m.id}
                href={`${base}?meeting=${m.id}` as Route}
                aria-current={chosen?.id === m.id ? 'page' : undefined}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-pill border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink hover:border-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-white max-md:min-h-[44px] max-md:text-[14px]"
              >
                {t('chip', { day: short(m.meets_on), title: m.title })}
                {m.next && <span className="sr-only">{t('nextWords')}</span>}
              </Link>
            ))}
          </nav>
        )}

        {data.can_plan && (
          <Card large className="flex flex-col gap-3">
            <PlanMeeting group={group} defaultMinutes={data.meeting_minutes} meetingsHref={base} />
          </Card>
        )}

        {!chosen || !agenda || agenda === 'none' ? (
          <Card large className="flex flex-col gap-2">
            <h2 className="m-0 text-[18px] font-bold">{t('noneTitle')}</h2>
            <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{data.leader ? t('noneLeader') : t('noneMember')}</p>
          </Card>
        ) : (
          <AgendaArea
            meeting={{
              id: agenda.meeting.id,
              title: agenda.meeting.title,
              when: when(agenda.meeting.meets_on, agenda.meeting.starts_at, agenda.meeting.minutes),
              values: {
                title: agenda.meeting.title,
                on: agenda.meeting.meets_on,
                at: agenda.meeting.starts_at,
                minutes: agenda.meeting.minutes,
              },
              next: agenda.meeting.next,
            }}
            items={agenda.items.map((i): ItemView => {
              const needs = missing(i)
              return {
                ...i,
                needs: needs.length ? list.format(needs.map((n) => words[n])) : null,
              }
            })}
            tasks={agenda.tasks}
            members={agenda.members}
            openActions={
              agenda.open_actions?.map((a) => ({
                id: a.id,
                title: a.title,
                owner: a.owner_name,
                due: due(a.due_on),
                focus: a.focus,
              })) ?? null
            }
            leader={agenda.leader}
            canPropose={agenda.can_propose}
            canManage={agenda.can_manage}
            charterHref={groupPath(group)}
            meetingsHref={base}
          />
        )}
      </AppPage>
    </ClientMessages>
  )
}
