import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, ClipboardList, SquareCheck } from 'lucide-react'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { ClientMessages } from '@/components/lp/ClientMessages'
import { ListRow } from '@/components/lp/ListRow'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { TraitBars, type TraitLabels } from '@/components/profile/TraitBars'
import { buttonVariants } from '@/components/ui/button'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadMyGroups } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { loadPlan } from '@/lib/plan/load'
import { loadMyProfile, loadMyShares, loadPersonName } from '@/lib/profile/load'
import { loadRounds } from '@/lib/rounds/load'
import { SIGN_IN_PATH, planPath, profileTestPath, roundPath } from '@/lib/routes'
import { DeleteProfile, PendingProfile, ShareChoice } from './MeActions'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('meTitle', { product: PRODUCT_NAME }) }
}

/**
 * Me (handoff 6.17, design `me`): the person's Leader Profile, private to them; what each of their groups
 * sees of it, which applies at once; a retake; and delete. With section 11 and the MVP in mind it leaves
 * out the design's team map, conversation prompt, modules and contribution feedback, and the per-domain
 * descriptions, which no source supplies. Above it, what waits for the person in each of their groups: the
 * Full diagnostic while it asks them, and their own open actions (handoff 6.17; D-46), read through each
 * group's own readers, so nothing new reads who answered.
 */
export default async function MePage() {
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tp, profile, shares, name] = await Promise.all([
    getTranslations('me'),
    getTranslations('profile'),
    loadMyProfile(user.id),
    loadMyShares(user.id),
    loadPersonName(user.id),
  ])
  if (profile === null) return <PageProblem title={t('readFailed')} />
  const day = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

  // what waits for the person: per group, the round asking them and their own open actions
  const groups = await loadMyGroups(user.id)
  const reads = groups ? await Promise.all(groups.map(async (g) => ({ g, rounds: await loadRounds(g.id), plan: await loadPlan(g.id) }))) : null
  const workFailed = !reads || reads.some((r) => r.rounds === null || r.plan === null)
  const work = (reads ?? []).flatMap(({ g, rounds, plan }) => [
    ...(rounds && rounds !== 'none' ? rounds.rounds : [])
      .filter((r) => r.phase === 'answering' && r.me === 'to_answer')
      .map((r) => ({ key: r.id, kind: 'round' as const, title: t('workRound'), meta: t('workRoundMeta', { group: g.name, date: r.closes_at ? day(r.closes_at) : '' }), href: roundPath(g.id, r.id) })),
    ...(plan && plan !== 'none' ? plan.focus_areas.flatMap((f) => f.actions) : [])
      .filter((a) => a.mine && a.status === 'open')
      .map((a) => ({ key: a.id, kind: 'action' as const, title: a.title, meta: t('workActionMeta', { group: g.name, date: day(`${a.due_on}T00:00:00Z`) }), href: planPath(g.id) })),
  ])

  const labels: TraitLabels = {
    bands: { lower: tp('result.band_lower'), middle: tp('result.band_middle'), higher: tp('result.band_higher') },
    words: (n, b) => tp('result.traitWords', { name: n, band: b }),
    bandsLabel: tp('result.bandsLabel'),
    facetsOf: (domain) => tp('result.facetsOf', { domain }),
  }
  const tests = (
    <div className="flex flex-wrap gap-2">
      <Link href={profileTestPath('quick') as Route} className={buttonVariants({ variant: 'secondary', className: 'gap-2' })}>
        {tp('startQuick')}
        <ArrowRight aria-hidden size={15} />
      </Link>
      <Link href={profileTestPath('full') as Route} className={buttonVariants({ variant: 'secondary', className: 'gap-2' })}>
        {tp('startFull')}
        <ArrowRight aria-hidden size={15} />
      </Link>
    </div>
  )

  return (
    <ClientMessages namespaces={['me']}>
      <AppPage>
        <PendingProfile />
        <PageTitle eyebrow={t('eyebrow')} title={name ?? t('title')} />

        {groups && groups.length > 0 && (
          <Card large>
            <SectionHeader title={t('workTitle')} />
            {workFailed ? (
              <p role="alert" className="m-0 border-t border-divider pt-3 text-[14px] max-md:text-[15px]">
                {t('workFailed')}
              </p>
            ) : work.length === 0 ? (
              <p className="m-0 border-t border-divider pt-3 text-[14px] text-text-2 max-md:text-[15px]">{t('workEmpty')}</p>
            ) : (
              <ul aria-label={t('workTitle')} className="m-0 list-none p-0">
                {work.map((w) => (
                  <ListRow
                    key={w.key}
                    icon={w.kind === 'round' ? ClipboardList : SquareCheck}
                    kind={w.kind === 'round' ? t('workKindRound') : t('workKindAction')}
                    kindTone={w.kind === 'round' ? 'strong' : 'other'}
                    title={w.title}
                    meta={w.meta}
                    action={
                      <Link href={w.href as Route} className={buttonVariants({ size: 'xsmall' })}>
                        {w.kind === 'round' ? t('workAnswer') : t('workOpen')}
                      </Link>
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        )}

        {profile === 'none' ? (
          <Card large className="flex flex-col gap-3">
            <h2 className="m-0 text-[18px] font-bold">{t('noneTitle')}</h2>
            <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('noneBody')}</p>
            {tests}
          </Card>
        ) : (
          <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_360px]">
            <Card large className="flex flex-col gap-4 md:px-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="m-0 text-[18px] font-bold">{tp('result.domains')}</h2>
                <p className="m-0 text-[12.5px] text-muted max-md:text-[15px]">
                  {t('testTaken', {
                    test: tp(profile.test.key === 'quick' ? 'result.testQuick' : 'result.testFull', { name: profile.test.name, items: profile.test.items }),
                    date: dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(profile.takenAt)),
                  })}
                </p>
              </div>
              <TraitBars domains={profile.domains} facets={profile.facets} labels={labels} />
              <div className="flex flex-col gap-1 border-t border-rule-softer pt-3 text-[12.5px] leading-[1.5] text-muted max-md:text-[15px]">
                <p className="m-0">{tp('result.scaleNote')}</p>
                <p className="m-0">{tp('result.notGrade')}</p>
                <p className="m-0">{tp('label')}</p>
              </div>
            </Card>

            <div className="flex flex-col gap-4">
              <Card large className="flex flex-col gap-3">
                <h2 className="m-0 text-[16px] font-bold">{t('shareTitle')}</h2>
                {shares === null ? (
                  <p role="alert" className="m-0 text-[14px] max-md:text-[15px]">
                    {t('shareFailed')}
                  </p>
                ) : shares.length === 0 ? (
                  <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{t('noGroups')}</p>
                ) : (
                  shares.map((s) => <ShareChoice key={s.group.id} group={s.group} level={s.level} />)
                )}
                <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('shareNote')}</p>
              </Card>
              <Card large className="flex flex-col gap-3">
                <h2 className="m-0 text-[16px] font-bold">{t('retakeTitle')}</h2>
                <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('retakeBody')}</p>
                {tests}
              </Card>
              <Card large className="flex flex-col gap-3">
                <h2 className="m-0 text-[16px] font-bold">{t('deleteTitle')}</h2>
                <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t('deleteBody')}</p>
                <DeleteProfile />
              </Card>
            </div>
          </div>
        )}
        <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{tp('purpose')}</p>
      </AppPage>
    </ClientMessages>
  )
}
