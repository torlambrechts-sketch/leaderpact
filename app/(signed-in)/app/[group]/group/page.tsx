import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Lock } from 'lucide-react'
import { PageTitle } from '@/components/app/AppPage'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { Pill } from '@/components/lp/Pill'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { SamplePage } from '@/components/sample/SamplePage'
import { sampleAvatarId, sampleDay, sampleMonth } from '@/components/sample/format'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PRODUCT_NAME } from '@/lib/brand'
import { SAMPLE, samplePerson } from '@/lib/sample/load'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('groupTitle', { product: PRODUCT_NAME }) }
}

/**
 * Group on the Free plan (handoff 6.8 and 6.19, design `group`): the sample charter and members, under the
 * sample banner. Section 11's corrections: no coach card and no composition; the member list carries no
 * counts of tasks or actions per person, which read as a ranking. The design's agenda time per task is left
 * out: the handoff does not ask for it. Members and the charter are built in milestone 9.
 */
export default async function GroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const t = await getTranslations('sample')
  const { charter, people } = SAMPLE
  return (
    <SamplePage group={group}>
      <Tabs defaultValue="charter" className="flex flex-col gap-5">
        <PageTitle
          eyebrow={t('eyebrow', { group: SAMPLE.group })}
          title={t('group.title')}
          aside={
            <TabsList aria-label={t('group.tabsLabel')}>
              <TabsTrigger value="charter">{t('group.tabCharter')}</TabsTrigger>
              <TabsTrigger value="members">{t('group.tabMembers')}</TabsTrigger>
            </TabsList>
          }
        />

        <TabsContent value="charter" className="mt-0">
          <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-2.5 rounded-card-lg bg-hero px-6 py-6 md:px-7">
                <h2 className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-text-2 max-md:text-[13px]">{t('group.purpose')}</h2>
                <p className="m-0 text-[19px] font-semibold leading-[1.45] max-md:text-[17px]">{charter.purpose}</p>
              </section>

              <Card large>
                <SectionHeader title={t('group.tasks')} meta={t('group.tasksMeta', { count: charter.tasks.length })} />
                <ul aria-label={t('group.tasksLabel')} className="m-0 list-none p-0">
                  {charter.tasks.map((task) => {
                    const owner = samplePerson(task.owner)
                    return (
                      <li key={task.key} className="grid items-center gap-x-4 gap-y-2 border-t border-divider py-3 sm:grid-cols-[minmax(0,1fr)_auto_200px]">
                        <span className="text-[14px] font-semibold max-md:text-[15px]">{task.title}</span>
                        <Pill tone="neutral" className="justify-self-start">{t(`group.right_${task.right}`)}</Pill>
                        <span className="flex items-center gap-2.5">
                          <Avatar personId={sampleAvatarId(owner.key)} name={owner.name} size={28} />
                          <span className="text-[13.5px] max-md:text-[15px]">
                            <span className="sr-only">{t('group.owner', { name: owner.name })}</span>
                            <span aria-hidden>{owner.name}</span>
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </Card>

              <Card large>
                <SectionHeader title={t('group.agreements')} />
                <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {charter.agreements.map((text, i) => (
                    <li key={text} className="flex items-center gap-3">
                      <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-chip bg-accent text-[12px] font-bold text-accent-ink">
                        {i + 1}
                      </span>
                      <span className="text-[14px] max-md:text-[15px]">{text}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <Card large className="flex flex-col gap-3">
              <Pill tone="ink" className="self-start">{t('group.inForce', { version: charter.version })}</Pill>
              <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('group.versionBody')}</p>
              <p className="m-0 flex items-center gap-2 rounded-btn bg-surface-soft px-3.5 py-2.5 text-[13px] text-text-2 max-md:text-[15px]">
                <Lock aria-hidden size={15} className="shrink-0 text-ink" />
                {t('group.locked')}
              </p>
              <h2 className="sr-only">{t('group.versionsLabel')}</h2>
              <ul className="m-0 flex list-none flex-col gap-1.5 border-t border-divider p-0 pt-3 text-[12.5px] text-text-2 max-md:text-[15px]">
                {charter.earlier.map((v) => (
                  <li key={v.version}>{t('group.agreed', { version: v.version, date: sampleDay(v.agreed) })}</li>
                ))}
                <li className="font-semibold text-ink">{t('group.current', { version: charter.version })}</li>
              </ul>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-0">
          <Card large>
            <SectionHeader title={t('group.membersTitle')} meta={t('group.membersMeta', { count: people.length })} />
            <ul className="m-0 list-none p-0">
              {people.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center gap-3 border-t border-divider py-3">
                  <Avatar personId={sampleAvatarId(p.key)} name={p.name} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[14px] font-bold max-md:text-[15px]">{p.name}</span>
                    <span className="text-[12.5px] text-muted max-md:text-[15px]">
                      {t('group.memberLine', {
                        job: p.job,
                        role: p.role === 'leader' ? t('group.leader') : t('group.member'),
                        since: p.state === 'invited' ? t('group.invitedOn', { date: sampleMonth(p.since) }) : t('group.since', { date: sampleMonth(p.since) }),
                      })}
                    </span>
                  </div>
                  <Pill tone={p.state === 'active' ? 'ok' : 'pending'}>{p.state === 'active' ? t('group.active') : t('group.invited')}</Pill>
                </li>
              ))}
            </ul>
            <p className="m-0 border-t border-divider pt-3 text-[12.5px] text-muted max-md:text-[15px]">{t('group.membersNote')}</p>
          </Card>
        </TabsContent>
      </Tabs>
    </SamplePage>
  )
}
