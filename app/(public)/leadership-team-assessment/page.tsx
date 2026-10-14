import type { Metadata } from 'next'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, BookOpen, Eye, ListChecks, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import { PRODUCT_NAME } from '@/lib/brand'
import { LevelBar } from '@/components/lp/LevelBar'
import { cn } from '@/lib/cn'
import { LANDING_PATH, SCAN_PATH } from '@/lib/routes'
import { pageCard } from '@/lib/site/cards'
import { pageMeta } from '@/lib/site/meta'
import { graph, organization, software, website } from '@/lib/site/schema'
import { JsonLd } from '@/components/site/JsonLd'
import { loadScan } from '@/lib/scan/load'

/** The scan is read on each request, from a ten-minute cache (lib/scan/load.ts) */
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return pageMeta({ title: t('landingTitle', { product: PRODUCT_NAME }), description: t('landingDescription'), path: LANDING_PATH, image: pageCard('leadership-team-assessment') })
}

/**
 * The sample team view on the landing page (handoff 6.1): the design's own figures, shown as a sample and
 * labelled so. They are no group's results. The theme names come from the published scan, so a renamed
 * theme is renamed here too; a theme the scan no longer has is left out.
 */
const SAMPLE = {
  answered: 6,
  members: 8,
  rows: [
    { theme: 'purpose_and_priorities', level: 3.9, agreement: 'high' },
    { theme: 'meetings', level: 2.8, agreement: 'low' },
    { theme: 'dialogue_and_conflict', level: 3.1, agreement: 'medium' },
    { theme: 'safety_and_trust', level: 4.1, agreement: 'high' },
  ],
} as const

/**
 * The landing page (handoff 6.1, design `landing`), with section 11's corrections: no Research,
 * Templates or For coaches, no demo group, and "the team view opens when the scan closes". The title
 * and first heading say "leadership team assessment" (handoff section 5), as the heading's first line.
 */
export default async function LandingPage() {
  const [t, tAgreement, tMeta, scan] = await Promise.all([getTranslations('landing'), getTranslations('agreement'), getTranslations('meta'), loadScan()])
  const themes = new Map(scan?.themes.map((theme) => [theme.key, theme.name]))
  const sampleRows = SAMPLE.rows.flatMap((row) => {
    const name = themes.get(row.theme)
    return name ? [{ ...row, name }] : []
  })
  const count = scan?.items.length

  return (
    <div className="mx-auto mt-4 flex max-w-site flex-col gap-6 px-4 md:mt-6 md:px-gutter">
      <JsonLd data={graph(organization(), website(tMeta('description', { product: PRODUCT_NAME })), software(tMeta('landingDescription')))} />
      <section className="grid items-center gap-10 overflow-hidden rounded-hero border border-bar bg-hero px-5 py-8 md:min-h-[580px] md:px-16 md:py-14 min-[900px]:grid-cols-[minmax(0,500px)_minmax(0,1fr)] min-[900px]:gap-14">
        <div className="flex flex-col gap-6">
          <p className="inline-flex items-center gap-2 self-start rounded-pill border border-bar bg-white-veil py-[5px] pl-1.5 pr-3 text-[13px] font-semibold text-landing-pill-ink">
            <span className="rounded-pill bg-ink px-[9px] py-0.5 text-[11px] text-white">{t('free')}</span>
            {count ? t('factsWithCount', { count }) : t('facts')}
          </p>
          <h1 className="m-0 flex flex-col gap-3">
            <span className="text-[14px] font-semibold text-text-2">{t('eyebrow')}</span>
            <span className="font-display text-landing-headline max-md:text-[40px] max-md:leading-[1.06]">{t('headline')}</span>
          </h1>
          <p className="m-0 text-[18px] leading-[1.55] text-text-3 max-md:text-[17px]" style={{ textWrap: 'pretty' }}>
            {t('lead')}
          </p>
          <Link
            href={SCAN_PATH as Route}
            className="inline-flex items-center gap-2 self-start rounded-btn bg-ink px-[22px] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,.35)] hover:text-white"
          >
            {t('start')}
            <ArrowRight aria-hidden size={16} />
          </Link>
          <ul className="m-0 flex list-none flex-wrap gap-x-[22px] gap-y-2 p-0 text-[13px] text-text-2 max-md:text-[15px]">
            <li className="flex items-center gap-1.5">
              <BookOpen aria-hidden size={15} className="text-ink" />
              {t('researchBased')}
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden size={15} className="text-ink" />
              {t('countsOnly')}
            </li>
          </ul>
        </div>

        {sampleRows.length > 0 && (
          <section
            aria-label={t('sample.label')}
            className="flex flex-col gap-3.5 rounded-card border border-bar bg-surface px-6 py-[22px] shadow-[0_40px_70px_-36px_rgba(60,50,30,.22)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 className="m-0 text-[15px] font-bold">{t('sample.title')}</h2>
                <p className="m-0 text-[12px] text-muted max-md:text-[15px]">{t('sample.subtitle')}</p>
              </div>
              <span className="whitespace-nowrap rounded-pill bg-accent px-2.5 py-1 text-[11.5px] font-semibold text-accent-ink">
                {t('sample.answered', { answered: SAMPLE.answered, members: SAMPLE.members })}
              </span>
            </div>
            {sampleRows.map((row) => (
              <LevelBar key={row.theme} variant="sample" label={row.name} level={row.level} agreement={tAgreement(row.agreement)} />
            ))}
            <p className="m-0 border-t border-rule-softer pt-3 text-[12px] text-muted max-md:text-[15px]">{t('sample.footer')}</p>
          </section>
        )}
      </section>

      <section className="flex flex-col items-center gap-3.5 rounded-hero border border-white bg-surface px-5 py-10 md:px-14 md:py-12">
        <span className="rounded-pill bg-accent px-3 py-[5px] text-[12.5px] font-semibold text-accent-ink">{t('how.pill')}</span>
        <h2 className="m-0 text-center font-display text-section-headline max-md:text-[28px]">{t('how.heading')}</h2>
        <ol className="m-0 mt-5 grid w-full list-none gap-5 p-0 min-[900px]:grid-cols-3">
          <Step icon={ListChecks} tone="bg-accent" title={count ? t('how.answerTitleWithCount', { count }) : t('how.answerTitle')} body={t('how.answerBody')} />
          <Step icon={Users} tone="bg-step-teal" ink title={t('how.inviteTitle')} body={t('how.inviteBody')} />
          <Step icon={Eye} tone="bg-step-yellow" title={t('how.readTitle')} body={t('how.readBody')} />
        </ol>
      </section>
    </div>
  )
}

/** A step tile: radius 18, padding 24, gap 10, a white 40 px icon box (radius 12), 18 / 700, 14.5 / 1.55 */
function Step({ icon: Icon, tone, title, body, ink = false }: { icon: LucideIcon; tone: string; title: string; body: string; ink?: boolean }) {
  return (
    <li className={cn('flex flex-col gap-2.5 rounded-card p-6', tone)}>
      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-btn bg-surface text-ink">
        <Icon size={20} />
      </span>
      <h3 className="m-0 text-[18px] font-bold">{title}</h3>
      <p className={cn('m-0 text-[14.5px] leading-[1.55] max-md:text-[15px]', ink ? 'text-text-body' : 'text-text-2')}>{body}</p>
    </li>
  )
}
