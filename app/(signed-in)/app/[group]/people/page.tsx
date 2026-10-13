import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageTitle } from '@/components/app/AppPage'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { Pill } from '@/components/lp/Pill'
import { SamplePage } from '@/components/sample/SamplePage'
import { sampleAvatarId, sampleMonth } from '@/components/sample/format'
import { PRODUCT_NAME } from '@/lib/brand'
import { SAMPLE } from '@/lib/sample/load'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('peopleTitle', { product: PRODUCT_NAME }) }
}

/**
 * People on the Free plan (handoff 6.9 and 6.19, design `people`): a simple list of the sample members,
 * each with their role and their Leader Profile's sharing level. Section 11's corrections: no team map, no
 * person pages, no contribution feedback, and no counts of tasks or actions per person. A shared profile
 * shows its level only: the profile's scores need the test items and the norm table, which are not
 * supplied (handoff 6.17), so nothing stands in for them.
 */
export default async function PeoplePage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const t = await getTranslations('sample')
  return (
    <SamplePage group={group}>
      <PageTitle eyebrow={t('eyebrow', { group: SAMPLE.group })} title={t('people.title')} />
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
        {SAMPLE.people.map((p) => (
          <li key={p.key}>
            <Card large as="article" className="flex h-full flex-col gap-4">
              <div className="flex items-start gap-3">
                <Avatar personId={sampleAvatarId(p.key)} name={p.name} size={46} className="text-[14px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h2 className="m-0 text-[15px] font-bold">{p.name}</h2>
                  <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{p.job}</p>
                </div>
                <Pill tone={p.state === 'active' ? 'ok' : 'pending'}>{p.state === 'active' ? t('group.active') : t('group.invited')}</Pill>
              </div>
              <dl className="m-0 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px] max-md:text-[15px]">
                <dt className="text-muted">{t('people.inGroup')}</dt>
                <dd className="m-0 font-semibold">
                  {t('people.inGroupValue', {
                    role: p.role === 'leader' ? t('group.leader') : t('group.member'),
                    since: p.state === 'invited' ? t('group.invitedOn', { date: sampleMonth(p.since) }) : t('group.since', { date: sampleMonth(p.since) }),
                  })}
                </dd>
                <dt className="text-muted">{t('people.profile')}</dt>
                <dd className="m-0 font-semibold">{t(`people.profile_${p.profile}`)}</dd>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('people.note')}</p>
    </SamplePage>
  )
}
