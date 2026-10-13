import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { Pill } from '@/components/lp/Pill'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadShell } from '@/lib/groups/load'
import { loadGroupProfiles } from '@/lib/profile/load'
import { ME_PATH, SIGN_IN_PATH } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('peopleTitle', { product: PRODUCT_NAME }) }
}

/**
 * People (handoff 6.9): each current member, their role, and their Leader Profile if they share it with
 * this group, at the level they share (0011, get_group_profiles): bands only, never a score. A profile
 * that is not shared and a member with no profile read the same, "Not shared", with no preview. No counts
 * of tasks or actions per person (section 11). It is real on the Free plan from milestone 7, since the
 * Leader Profile is free and sharing it needs a place to be read (D-32).
 */
export default async function PeoplePage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tp, tInvite, shell, people] = await Promise.all([
    getTranslations('people'),
    getTranslations('profile'),
    getTranslations('invite'),
    loadShell(group, user.id),
    loadGroupProfiles(group),
  ])
  if (shell === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />
  if (shell === null || people === null) return <PageProblem title={t('readFailed')} />

  const bandWord = { lower: tp('result.band_lower'), middle: tp('result.band_middle'), higher: tp('result.band_higher') }
  return (
    <AppPage>
      <PageTitle eyebrow={shell.current.name} title={t('title')} aside={<span className="text-[13px] text-text-2 max-md:text-[15px]">{t('meta', { count: people.length })}</span>} />
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => {
          const domains = p.traits?.filter((x) => x.kind === 'domain') ?? []
          const facets = p.traits?.filter((x) => x.kind === 'facet') ?? []
          return (
            <li key={p.person_id}>
              <Card large as="article" className="flex h-full flex-col gap-4">
                <div className="flex items-start gap-3">
                  <Avatar personId={p.person_id} name={p.display_name} size={46} className="text-[14px]" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 className="m-0 break-words text-[15px] font-bold">{p.display_name}</h2>
                    <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{p.role === 'leader' ? t('leader') : t('member')}</p>
                  </div>
                  {p.person_id === user.id && <Pill tone="ink">{t('you')}</Pill>}
                </div>
                <div className="flex flex-col gap-2 border-t border-divider pt-3">
                  <h3 className="m-0 text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">{t('profile')}</h3>
                  {p.level === 'nothing' || !p.test ? (
                    <p className="m-0 text-[14px] font-semibold max-md:text-[15px]">{t('notShared')}</p>
                  ) : (
                    <>
                      <p className="m-0 text-[13px] font-semibold max-md:text-[15px]">{t(`shares_${p.level}`, { test: t(`test_${p.test}`) })}</p>
                      <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13px] max-md:text-[15px]">
                        {domains.map((d) => (
                          <div key={d.key} className="contents">
                            <dt className="font-semibold">{d.name}</dt>
                            <dd className="m-0 text-right">{bandWord[d.band]}</dd>
                          </div>
                        ))}
                      </dl>
                      {facets.length > 0 && (
                        <details className="text-[13px] max-md:text-[15px]">
                          <summary className="cursor-pointer font-semibold max-md:min-h-[44px] max-md:leading-[44px]">{tp('result.facets')}</summary>
                          <dl className="m-0 mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                            {facets.map((f) => (
                              <div key={f.key} className="contents">
                                <dt>{f.name}</dt>
                                <dd className="m-0 text-right">{bandWord[f.band]}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                    </>
                  )}
                  {p.person_id === user.id && (
                    <Link href={ME_PATH as Route} className="text-link self-start text-[13px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center max-md:text-[15px]">
                      {t('own')}
                    </Link>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('note')}</p>
    </AppPage>
  )
}
