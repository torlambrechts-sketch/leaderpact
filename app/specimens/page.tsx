import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Activity, ClipboardList, FileText } from 'lucide-react'
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
import { QuestionProgress } from '@/components/lp/QuestionProgress'
import { NavItem } from '@/components/lp/NavItem'
import { Pill } from '@/components/lp/Pill'
import { PlanPill } from '@/components/lp/PlanPill'
import { SampleBanner } from '@/components/lp/SampleBanner'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { StandingLabel } from '@/components/lp/StandingLabel'
import { ToastView } from '@/components/lp/ToastView'
import { TopBar } from '@/components/lp/TopBar'
import { WarningAction, WarningBox } from '@/components/lp/WarningBox'
import { NAV } from '@/components/lp/nav'
import { Button } from '@/components/ui/button'
import { OptionsSpecimen, TabsSpecimen, ToastTrigger } from './Interactive'

/**
 * Milestone 1: every component of /components/lp, once, for the side-by-side check against the design
 * (scripts/verify/side-by-side.mjs). Each specimen carries `data-specimen="<id>"`, the ids of
 * scripts/verify/claims.json. Not served in production.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * The Team plan's test price (handoff section 1, Plans), for the sample banner only. Prices are rows from
 * the plans milestone on; this page has no database, so the sample holds the number and formats it.
 */
const SAMPLE_TEAM_PRICE = { amount: 1800, currency: 'USD' } as const
const price = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: SAMPLE_TEAM_PRICE.currency,
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
}).format(SAMPLE_TEAM_PRICE.amount)

export default async function SpecimensPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const t = await getTranslations('specimens')
  const nav = await getTranslations('nav')
  const navLabels = {
    home: nav('home'), group: nav('group'), people: nav('people'), assess: nav('assess'), results: nav('results'),
    plan: nav('plan'), meetings: nav('meetings'), me: nav('me'), more: nav('more'), settings: nav('settings'),
    switchGroup: nav('switchGroup'), groups: nav('groups'), primary: nav('primary'), planAndBilling: nav('planAndBilling'),
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
          <p className="max-w-questionnaire text-[14px] text-text-2 max-md:text-[15px]">{t('intro')}</p>
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
          <HeroBlock date={t('heroDate')} greeting={t('heroGreeting')} status={t('heroStatus')} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div data-specimen="card">
            <Card>
              <div data-specimen="section-header">
                <SectionHeader title={t('needsYou')} count={4} countLabel={t('needsYouCount', { count: 4 })} meta={t('needsYouMeta')} />
              </div>
              <ul className="mt-2">
                <ListRow specimen="list-row" icon={Activity} kind={t('rowKindAssessment')} title={t('rowTitlePulse')} meta={t('rowMetaPulse')} action={<Button size="small">{t('rowActionAnswer')}</Button>} />
                <ListRow icon={FileText} kind={t('rowKindLeader')} kindTone="moderate" title={t('rowTitleLeader')} meta={t('rowMetaLeader')} action={<Button size="small">{t('rowActionOpen')}</Button>} />
                <ListRow icon={ClipboardList} kind={t('rowKindAction')} kindTone="other" title={t('rowTitleAction')} meta={t('rowMetaAction')} />
              </ul>
            </Card>
          </div>

          <Card>
            <SectionHeader title={t('cardTitle')} />
            <p className="mt-3 text-[14px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('cardBody')}</p>
          </Card>
        </div>

        <Specimen name={t('names.button')}>
          <div className="flex flex-wrap items-center gap-3">
            <span data-specimen="button-primary"><Button>{t('buttonPrimary')}</Button></span>
            <span data-specimen="button-secondary"><Button variant="secondary">{t('buttonSecondary')}</Button></span>
            <span data-specimen="button-small"><Button size="small">{t('buttonSmall')}</Button></span>
            <span data-specimen="button-danger"><Button variant="danger">{t('buttonDanger')}</Button></span>
            <Button variant="secondary" size="large">{t('buttonBack')}</Button>
            <Button size="large">{t('buttonNext')}</Button>
          </div>
        </Specimen>

        <Specimen name={t('names.pill')}>
          <div className="flex flex-wrap gap-2">
            <span data-specimen="pill"><Pill tone="accent">{t('pillAccent')}</Pill></span>
            <Pill tone="plan">{t('pillPlan')}</Pill>
            <Pill tone="ink">{t('pillInk')}</Pill>
            <Pill tone="ok">{t('pillOk')}</Pill>
            <Pill tone="pending">{t('pillPending')}</Pill>
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
          <div data-specimen="progress-bar" className="max-w-questionnaire">
            <QuestionProgress
              leaveHref="/"
              leaveLabel={t('leaveScan')}
              position={t('position', { n: 1, total: 12 })}
              value={(1 / 12) * 100}
              label={t('progressLabel', { n: 1, total: 12 })}
              prefetch={false}
            />
          </div>
        </Specimen>

        <Specimen name={t('names.levelBar')}>
          <div className="flex max-w-questionnaire flex-col gap-4">
            <p className="text-[12px] text-muted">{t('researchLabel')}</p>
            <div data-specimen="level-bar"><LevelBar level={3.9} agreement={t('levelAgreement')} label={t('levelTheme')} /></div>
            <div data-specimen="level-bar-results"><LevelBar level={3.4} agreement={t('levelAgreementMedium')} label={t('levelThemeResults')} track={8} /></div>
          </div>
        </Specimen>

        <Specimen name={t('names.countDots')}>
          <div data-specimen="count-dots" className="max-w-[440px]"><CountDots answered={1} total={8} caption={t('countCaption')} words={t('countWords', { answered: 1, total: 8 })} /></div>
        </Specimen>

        <Specimen name={t('names.hintBox')}>
          <div className="flex max-w-questionnaire flex-col gap-3">
            <div data-specimen="hint-box"><HintBox>{t('hint')}</HintBox></div>
            <HintBox title={t('hintTitle')}>{t('hintBody')}</HintBox>
          </div>
        </Specimen>

        <Specimen name={t('names.warningBox')}>
          <div data-specimen="warning-box" className="max-w-[420px]"><WarningBox action={<WarningAction>{t('warningAction')}</WarningAction>}>{t('warning')}</WarningBox></div>
        </Specimen>

        <div data-specimen="sample-banner">
          <SampleBanner audience="leader" chip={t('sample')} text={t('bannerLeader', { price })} action={<Button variant="on-ink">{t('bannerAction')}</Button>} />
        </div>
        <SampleBanner audience="member" chip={t('sample')} text={t('bannerMember')} />

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
            <StandingLabel standing="views_differ" label={t('standingViewsDiffer')} />
            <StandingLabel standing="fact" label={t('standingFact')} />
            <StandingLabel standing="read_with" label={t('standingReadWith')} />
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
