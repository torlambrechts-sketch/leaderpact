import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { CharterArea, type CharterProps } from '@/components/group/CharterArea'
import { MembersArea } from '@/components/group/MembersArea'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { SampleGroup } from '@/components/sample/SampleGroup'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PRODUCT_NAME } from '@/lib/brand'
import { requestOrigin } from '@/lib/auth/origin'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadCharter, loadCharterVersion, loadMembers } from '@/lib/group/load'
import { loadShell } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { SIGN_IN_PATH, groupPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('groupTitle', { product: PRODUCT_NAME }) }
}

/**
 * Group (handoff 6.8, design `group`): two tabs, Charter and Members. On the Free plan it is the sample page
 * (handoff 6.19); with the Team plan or its trial, the group's own: the charter in force with its versions
 * and the draft, and the members with the leader's invitations. A read-only group shows both and changes
 * neither. `?version=n` opens an agreed version; `?tab=members` opens Members.
 */
export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>
  searchParams: Promise<{ version?: string; tab?: string }>
}) {
  const { group } = await params
  const query = await searchParams
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const plan = await loadGroupPlan(group)
  if (plan === null || plan === 'none' || plan.access === 'free') return <SampleGroup group={group} />

  const [t, tInvite] = await Promise.all([getTranslations('group'), getTranslations('invite')])
  const version = query.version && /^[1-9][0-9]{0,4}$/.test(query.version) ? Number(query.version) : null
  const [shell, charter, members, earlier, origin] = await Promise.all([
    loadShell(group, user.id),
    loadCharter(group),
    loadMembers(group),
    version ? loadCharterVersion(group, version) : undefined,
    requestOrigin(),
  ])
  if (shell === null || charter === null || members === null || earlier === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || charter === 'none' || members === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  const day = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  const leader = shell.current.role === 'leader'
  const base = groupPath(group)
  const current = charter.in_force?.version ?? null
  const props: CharterProps = {
    group,
    inForce: charter.in_force && { version: charter.in_force.version, purpose: charter.in_force.purpose, tasks: charter.in_force.tasks, agreements: charter.in_force.agreements },
    draft: charter.draft && {
      purpose: charter.draft.purpose,
      tasks: charter.draft.tasks,
      agreements: charter.draft.agreements,
      basedOn: charter.draft.based_on,
      updated: day(charter.draft.updated_at),
    },
    versions: charter.versions.map((v) => ({
      version: v.version,
      agreed: day(v.agreed_at),
      href: v.version === current ? base : `${base}?version=${v.version}`,
      current: v.version === current,
    })),
    earlier:
      earlier && earlier !== 'none' && earlier.version !== current
        ? { version: earlier.version, agreed: day(earlier.agreed_at), purpose: earlier.purpose, tasks: earlier.tasks, agreements: earlier.agreements }
        : null,
    limits: {
      maxTasks: charter.template.max_tasks,
      maxAgreements: charter.template.max_agreements,
      purposeLength: charter.template.purpose_length,
      itemLength: charter.template.item_length,
    },
    canEdit: charter.can_edit,
    leader,
    currentHref: base,
  }

  return (
    <ClientMessages namespaces={['group']}>
      <AppPage>
        <Tabs defaultValue={query.tab === 'members' ? 'members' : 'charter'} className="flex flex-col gap-5">
          <PageTitle
            eyebrow={shell.current.name}
            title={t('title')}
            aside={
              <TabsList aria-label={t('tabsLabel')}>
                <TabsTrigger value="charter">{t('tabCharter')}</TabsTrigger>
                <TabsTrigger value="members">{t('tabMembers')}</TabsTrigger>
              </TabsList>
            }
          />
          <TabsContent value="charter" className="mt-0">
            <CharterArea {...props} />
          </TabsContent>
          <TabsContent value="members" className="mt-0">
            <MembersArea
              group={{ id: group, name: shell.current.name }}
              members={members.members.map((m) => ({ ...m, since: day(m.since) }))}
              invitations={members.invitations?.map((i) => ({ id: i.id, name: i.name, email: i.email, invited: day(i.invited_at), expired: i.expired })) ?? null}
              max={members.max}
              invitationDays={members.invitation_days}
              canInvite={members.can_invite}
              canManage={members.can_manage}
              origin={origin ?? ''}
            />
          </TabsContent>
        </Tabs>
      </AppPage>
    </ClientMessages>
  )
}
