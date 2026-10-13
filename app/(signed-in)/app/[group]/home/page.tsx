import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Activity, ArrowRight, CalendarClock, ClipboardList, Target, Users, type LucideIcon } from 'lucide-react'
import { AppPage, PageProblem } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { CopyLink } from '@/components/lp/CopyLink'
import { CountDots } from '@/components/lp/CountDots'
import { HintBox } from '@/components/lp/HintBox'
import { LevelBar } from '@/components/lp/LevelBar'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { buttonVariants } from '@/components/ui/button'
import { PRODUCT_NAME } from '@/lib/brand'
import { requestOrigin } from '@/lib/auth/origin'
import { currentUser } from '@/lib/auth/session'
import { loadGroupTeamView } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { formatPrice, loadTeamPrice } from '@/lib/plans/load'
import { loadMyProfile } from '@/lib/profile/load'
import { SIGN_IN_PATH, joinPath, profileTestPath, teamPath } from '@/lib/routes'
import { HomeHero } from './HomeHero'
import { NeedsYou } from './NeedsYou'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('homeTitle', { product: PRODUCT_NAME }) }
}

/**
 * Home on the Free plan (handoff 6.7, design `home` with plan free): the greeting block, "Needs you" (the
 * scan, the link, and the Leader Profile while the person has none), the
 * scan's status card with the count, the dots, the closing date and the link, and one card on what the
 * Team plan adds, meetings included. Once the team view is open, "Where we stand" shows it.
 *
 * Section 11's corrections: no "Assessment schedule" button; no countdown to 4 and no "the team view opens
 * at 4"; the closing date is said once, in the scan card. The Upgrade button comes with the checkout
 * (milestone 8): the leader sees the price, a member is asked to ask their team leader (D-30).
 */
export default async function HomePage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const t = await getTranslations('home')
  const tInvite = await getTranslations('invite')
  const tTeam = await getTranslations('teamView')
  const tAgree = await getTranslations('agreement')
  const [data, profile] = await Promise.all([loadGroupTeamView(group, user.id), loadMyProfile(user.id)])

  if (data === null || data === 'none') {
    return <PageProblem title={data === null ? tInvite('readFailed') : tInvite('notFoundTitle')} body={data === 'none' ? tInvite('notFoundBody') : undefined} />
  }

  const { scan, code } = data
  const open = scan?.phase === 'open' && code ? code : null
  const origin = await requestOrigin()
  const link = open ? `${origin ?? ''}${joinPath(open)}` : null
  const price = data.role === 'leader' ? await loadTeamPrice() : null
  const date = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))

  const adds: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: ClipboardList, title: t('planDiagnostic'), body: t('planDiagnosticBody') },
    { icon: Activity, title: t('planPulses'), body: t('planPulsesBody') },
    { icon: Target, title: t('planFocus'), body: t('planFocusBody') },
    { icon: Users, title: t('planCharter'), body: t('planCharterBody') },
    { icon: CalendarClock, title: t('planMeetings'), body: t('planMeetingsBody') },
  ]

  return (
    <AppPage>
      <HomeHero
        labels={{ morning: t('greetingMorning'), afternoon: t('greetingAfternoon'), evening: t('greetingEvening'), any: t('greetingAny') }}
        status={t('status')}
      />

      <div className="grid items-start gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,462px)]">
        <NeedsYou
          code={open}
          link={link}
          profileHref={profile === 'none' ? profileTestPath('quick') : null}
          labels={{
            title: t('needsTitle'),
            counts: [0, 1, 2, 3].map((count) => t('needsCount', { count })),
            empty: t('needsEmpty'),
            kindScan: t('kindScan'),
            answerTitle: t('answerTitle'),
            answerMeta: t('answerMeta'),
            answerAction: t('answerAction'),
            shareTitle: t('shareTitle'),
            shareMeta: t('shareMeta'),
            shareAction: t('shareAction'),
            shareCopied: t('shareCopied'),
            shareFailed: t('shareFailed'),
            kindProfile: t('kindProfile'),
            profileTitle: t('profileTitle'),
            profileMeta: t('profileMeta'),
            profileAction: t('profileAction'),
          }}
        />

        <Card large className="flex flex-col gap-4">
          <SectionHeader title={t('scanTitle')} meta={t('scanMeta')} className="mb-0" />
          {!scan ? (
            <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{tInvite('noScan')}</p>
          ) : (
            <>
              <CountDots
                answered={scan.answered}
                total={scan.memberCount}
                caption={t('scanCaption')}
                words={tInvite('countWords', { answered: scan.answered, total: scan.memberCount })}
              />
              {scan.phase === 'open' && (
                <>
                  <HintBox title={tInvite('openTitle')}>
                    {tInvite('openBody', { total: scan.memberCount, date: date(scan.closesAt) })}
                    {scan.extended && ` ${tInvite('extended')}`}
                  </HintBox>
                  {link && (
                    <CopyLink
                      id="home-invite-link"
                      compact
                      link={link}
                      labels={{ field: tInvite('linkLabel'), copy: tInvite('copy'), copied: tInvite('copied'), failed: tInvite('copyFailed') }}
                    />
                  )}
                </>
              )}
              {scan.phase === 'released' && (
                <>
                  <HintBox title={tInvite('releasedTitle')}>{tInvite('releasedBody', { answered: scan.answered, total: scan.memberCount })}</HintBox>
                  <Link href={teamPath(data.group.id) as Route} className={buttonVariants({ size: 'large', className: 'w-full gap-2 font-bold' })}>
                    {tInvite('teamOpen')}
                    <ArrowRight aria-hidden size={16} />
                  </Link>
                </>
              )}
              {scan.phase === 'closed' && <HintBox title={tInvite('closedTitle')}>{tInvite('closedBody')}</HintBox>}
            </>
          )}
        </Card>

        {data.view && (
          <Card large className="flex flex-col gap-4">
            <SectionHeader title={t('standTitle')} meta={tTeam('label')} className="mb-0" />
            {data.view.themes.map((theme) => (
              <LevelBar key={theme.key} variant="team" label={theme.name} level={theme.tenths / 10} agreement={tAgree(theme.agreement)} />
            ))}
            <p className="m-0 text-[12px] leading-[1.5] text-muted max-md:text-[15px]">{tTeam('computed')}</p>
          </Card>
        )}

        <section className="flex flex-col gap-4 rounded-card-lg bg-ink px-6 py-6 text-white min-[900px]:col-start-2">
          <h2 className="m-0 text-[18px] font-bold">{t('planTitle')}</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {adds.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-2.5">
                <Icon aria-hidden size={18} className="mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <p className="m-0 text-[14px] font-bold">{title}</p>
                  <p className="m-0 text-[13px] text-white/85 max-md:text-[15px]">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          {data.role === 'leader' ? (
            price && <p className="m-0 text-[13.5px] font-semibold max-md:text-[15px]">{t('planPrice', { price: formatPrice(price) })}</p>
          ) : (
            <p className="m-0 text-[13.5px] max-md:text-[15px]">{t('planAsk')}</p>
          )}
          <p className="m-0 text-[12.5px] text-white/80 max-md:text-[15px]">{t('planSamples')}</p>
        </section>
      </div>
    </AppPage>
  )
}
