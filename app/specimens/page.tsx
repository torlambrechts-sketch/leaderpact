import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { CalendarCheck, ClipboardList } from 'lucide-react'
import { PRODUCT_NAME } from '@/lib/brand'
import { Avatar } from '@/components/lp/Avatar'
import { Card } from '@/components/lp/Card'
import { CountDots } from '@/components/lp/CountDots'
import { EvidenceChip } from '@/components/lp/EvidenceChip'
import { HeroBlock } from '@/components/lp/HeroBlock'
import { HintBox } from '@/components/lp/HintBox'
import { IconTile } from '@/components/lp/IconTile'
import { LevelBar } from '@/components/lp/LevelBar'
import { ListRow } from '@/components/lp/ListRow'
import { NavItem } from '@/components/lp/NavItem'
import { Pill } from '@/components/lp/Pill'
import { PlanPill } from '@/components/lp/PlanPill'
import { SampleBanner } from '@/components/lp/SampleBanner'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { StandingLabel } from '@/components/lp/StandingLabel'
import { ToastView } from '@/components/lp/ToastView'
import { TopBar } from '@/components/lp/TopBar'
import { WarningBox } from '@/components/lp/WarningBox'
import { NAV } from '@/components/lp/nav'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { OptionsSpecimen, TabsSpecimen, ToastTrigger } from './Interactive'

/**
 * Milestone 1: every component of /components/lp, once, for the side-by-side check against the design
 * (scripts/verify/side-by-side.mjs). Each specimen carries `data-specimen="<id>"`, the ids of
 * scripts/verify/claims.json. Not served in production.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SpecimensPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const t = await getTranslations('specimens')
  const nav = await getTranslations('nav')
  const navLabels = {
    home: nav('home'), group: nav('group'), people: nav('people'), assess: nav('assess'), results: nav('results'),
    plan: nav('plan'), meetings: nav('meetings'), me: nav('me'), more: nav('more'), settings: nav('settings'),
    switchGroup: nav('switchGroup'), groups: nav('groups'), primary: nav('primary'),
  }
  const home = NAV[0]!
  const group = NAV[1]!

  return (
    <div className="pb-24">
      <div data-specimen="topbar">
        <TopBar
          productName={PRODUCT_NAME}
          groups={[{ slug: 'lumio', name: t('groupLumio') }, { slug: 'lumio-product', name: t('groupSecond') }]}
          currentGroup="lumio"
          active="home"
          labels={navLabels}
          plan={{ label: t('planTeam'), href: '/app/lumio/settings' }}
          person={{ id: 'kari', name: t('personName') }}
          sticky={false}
          prefetch={false}
        />
      </div>

      <main id="main" className="mx-auto flex max-w-app flex-col gap-5 px-4 py-8 md:px-gutter">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-section-headline">{t('title')}</h1>
            <Pill tone="ink">{t('sample')}</Pill>
          </div>
          <p className="max-w-questionnaire text-[14px] text-text-2">{t('intro')}</p>
        </header>

        <Specimen name={t('names.navItem')}>
          <div className="flex flex-wrap gap-2 rounded-pill bg-bar p-2">
            <div data-specimen="nav-item-active"><NavItem href="/app/lumio/home" label={navLabels.home} icon={home.icon} active prefetch={false} /></div>
            <div data-specimen="nav-item"><NavItem href="/app/lumio/group" label={navLabels.group} icon={group.icon} prefetch={false} /></div>
          </div>
        </Specimen>

        <Specimen name={t('names.planPill')}>
          <div className="flex gap-2 rounded-pill bg-bar p-2">
            <span data-specimen="plan-pill"><PlanPill href="/app/lumio/settings" label={t('planTeam')} prefetch={false} /></span>
            <PlanPill href="/app/lumio/settings" label={t('planFree')} prefetch={false} />
          </div>
        </Specimen>

        <div data-specimen="hero-block">
          <HeroBlock date={t('heroDate')} greeting={t('heroGreeting')} status={t('heroStatus')} action={<Button>{t('rowActionAnswer')}</Button>} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div data-specimen="card">
            <Card>
              <div data-specimen="section-header">
                <SectionHeader title={t('needsYou')} count={2} countLabel={t('needsYouCount', { count: 2 })} meta={t('needsYouMeta')} />
              </div>
              <ul className="mt-2">
                <ListRow specimen="list-row" icon={ClipboardList} kind={t('rowKindQuestionnaire')} title={t('rowTitlePulse')} meta={t('rowMetaPulse')} action={<Button size="small">{t('rowActionAnswer')}</Button>} />
                <ListRow icon={CalendarCheck} kind={t('rowKindAction')} title={t('rowTitleAction')} meta={t('rowMetaAction')} action={<Button size="small">{t('rowActionDone')}</Button>} />
              </ul>
            </Card>
          </div>

          <Card>
            <SectionHeader title={t('cardTitle')} />
            <p className="mt-3 text-[14px] leading-[1.55] text-text-2">{t('cardBody')}</p>
          </Card>
        </div>

        <Specimen name={t('names.button')}>
          <div className="flex flex-wrap items-center gap-3">
            <span data-specimen="button-primary"><Button>{t('buttonPrimary')}</Button></span>
            <span data-specimen="button-secondary"><Button variant="secondary">{t('buttonSecondary')}</Button></span>
            <span data-specimen="button-small"><Button size="small">{t('buttonSmall')}</Button></span>
            <span data-specimen="button-danger"><Button variant="danger">{t('buttonDanger')}</Button></span>
          </div>
        </Specimen>

        <Specimen name={t('names.pill')}>
          <div className="flex flex-wrap gap-2">
            <span data-specimen="pill"><Pill tone="accent">{t('pillAccent')}</Pill></span>
            <Pill tone="ok">{t('pillOk')}</Pill>
            <Pill tone="pending">{t('pillPending')}</Pill>
            <Pill tone="neutral">{t('pillNeutral')}</Pill>
          </div>
        </Specimen>

        <Specimen name={t('names.tabs')}>
          <TabsSpecimen
            label={t('tabsLabel')}
            tabs={[
              { value: 'charter', label: t('tabCharter'), body: t('tabCharterBody') },
              { value: 'members', label: t('tabMembers'), body: t('tabMembersBody') },
            ]}
          />
        </Specimen>

        <Specimen name={t('names.optionRow')}>
          <OptionsSpecimen question={t('question')} options={{ 1: t('options.1'), 2: t('options.2'), 3: t('options.3'), 4: t('options.4'), 5: t('options.5') }} />
        </Specimen>

        <Specimen name={t('names.progressBar')}>
          <div data-specimen="progress-bar" className="flex max-w-questionnaire flex-col gap-2">
            <p className="text-[12.5px] text-text-2">{t('progress', { n: 4, total: 12 })}</p>
            <Progress value={(4 / 12) * 100} aria-label={t('progress', { n: 4, total: 12 })} />
          </div>
        </Specimen>

        <Specimen name={t('names.levelBar')}>
          <div className="flex max-w-questionnaire flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold">{t('levelTheme')}</span>
              <span className="text-[12px] text-muted">{t('researchLabel')}</span>
            </div>
            <div data-specimen="level-bar"><LevelBar level={3.9} agreement={t('levelAgreement')} label={t('levelTheme')} /></div>
          </div>
        </Specimen>

        <Specimen name={t('names.countDots')}>
          <div data-specimen="count-dots"><CountDots answered={5} total={8} words={t('countWords', { answered: 5, total: 8 })} /></div>
        </Specimen>

        <Specimen name={t('names.hintBox')}>
          <div data-specimen="hint-box"><HintBox>{t('hint')}</HintBox></div>
        </Specimen>

        <Specimen name={t('names.warningBox')}>
          <div data-specimen="warning-box"><WarningBox>{t('warning')}</WarningBox></div>
        </Specimen>

        <div data-specimen="sample-banner">
          <SampleBanner chip={t('sample')} title={t('bannerTitle')} body={t('bannerBody')} action={<Button variant="secondary" size="small">{t('bannerAction')}</Button>} />
        </div>

        <Specimen name={t('names.evidenceChip')}>
          <div className="flex flex-wrap gap-2">
            <span data-specimen="evidence-chip-strong"><EvidenceChip rating="strong" label={t('evidenceStrong')} /></span>
            <span data-specimen="evidence-chip-moderate"><EvidenceChip rating="moderate" label={t('evidenceModerate')} /></span>
            <span data-specimen="evidence-chip-other"><EvidenceChip rating="other" label={t('evidenceOther')} /></span>
          </div>
        </Specimen>

        <Specimen name={t('names.standingLabel')}>
          <div className="flex flex-wrap gap-4">
            <span data-specimen="standing-label"><StandingLabel standing="strength" label={t('standingStrength')} /></span>
            <StandingLabel standing="watch" label={t('standingWatch')} />
            <StandingLabel standing="priority" label={t('standingPriority')} />
            <StandingLabel standing="views-differ" label={t('standingViewsDiffer')} />
          </div>
        </Specimen>

        <Specimen name={t('names.avatar')}>
          <div className="flex gap-2">
            <span data-specimen="avatar"><Avatar personId="kari" name={t('personName')} /></span>
          </div>
        </Specimen>

        <Specimen name={t('names.iconTile')}>
          <span data-specimen="icon-tile" className="inline-flex"><IconTile icon={ClipboardList} /></span>
        </Specimen>

        <Specimen name={t('names.toast')}>
          <div className="flex flex-wrap items-center gap-4">
            <span data-specimen="toast"><ToastView message={t('toast')} /></span>
            <ToastTrigger label={t('toastTry')} message={t('toast')} />
          </div>
        </Specimen>
      </main>
    </div>
  )
}

function Specimen({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <Card compact>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.05em] text-muted">{name}</h2>
      {children}
    </Card>
  )
}
