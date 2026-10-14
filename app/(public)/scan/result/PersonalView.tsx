'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { LevelBar } from '@/components/lp/LevelBar'
import { buttonVariants } from '@/components/ui/button'
import { SCAN_PATH } from '@/lib/routes'
import { deviceStore, readDraft } from '@/lib/scan/draft'
import { personalView, type Scan, type ThemeScore } from '@/lib/scan/model'
import { SaveCard } from './SaveCard'

type State = { kind: 'reading' } | { kind: 'none'; started: boolean } | { kind: 'view'; scores: ThemeScore[] }

/**
 * The personal view (handoff 6.3, design `personal`): "One person's view", six theme scores, each the mean
 * of its two answers and called indicative, worked out on the device from the answers kept there, so it
 * shows as soon as the page does. Beside it, the one ask: email, group name and size, which signs the
 * leader in by email link; their answers stay here until the group exists (D-15).
 *
 * The design's "You rate highest / lowest" boxes are left out (D-24). Two columns from 900 px, one below.
 */
export function PersonalView({ scan }: { scan: Scan }) {
  const t = useTranslations('result')
  const [state, setState] = React.useState<State>({ kind: 'reading' })

  React.useEffect(() => {
    const draft = readDraft(deviceStore(), scan, new Date())
    const scores = draft ? personalView(scan, draft.answers) : null
    setState(scores ? { kind: 'view', scores } : { kind: 'none', started: !!draft && Object.keys(draft.answers).length > 0 })
  }, [scan])

  if (state.kind === 'reading') return <div aria-busy className="mx-auto mt-6 min-h-[480px] max-w-site px-4 md:px-gutter md:mt-9" />

  if (state.kind === 'none') {
    return (
      <div className="mx-auto mt-6 max-w-questionnaire px-4 md:mt-10 md:px-6">
        <section className="flex flex-col gap-3 rounded-card-lg border border-white bg-surface p-6 md:p-9">
          <h1 className="m-0 font-display text-sub-headline">{t('noneTitle')}</h1>
          <p className="m-0 text-[15px] leading-[1.55] text-text-2">{t('noneBody')}</p>
          <Link href={SCAN_PATH as Route} className={buttonVariants({ size: 'large', className: 'mt-2 gap-2 self-start' })}>
            {state.started ? t('resume') : t('start')}
            <ArrowRight aria-hidden size={16} />
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-6 grid max-w-site items-start gap-6 px-4 md:mt-9 md:px-gutter min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <PersonalCard scores={state.scores} />
      <SaveCard />
    </div>
  )
}

/** The left card: one person's six indicative theme scores, with the honest label every score carries */
export function PersonalCard({ scores, heading = 'h1' }: { scores: ThemeScore[]; heading?: 'h1' | 'h2' }) {
  const t = useTranslations('result')
  const Heading = heading
  return (
    <section className="flex flex-col gap-4 rounded-card-lg border border-white bg-surface p-6 md:p-8">
      <span className="self-start rounded-pill bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-ink">{t('pill')}</span>
      <Heading className="m-0 font-display text-[30px] font-medium tracking-[-0.02em] max-md:text-[26px]">{t('heading')}</Heading>
      <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('lead')}</p>
      {scores.map((score) => (
        <LevelBar key={score.key} variant="personal" label={score.name} level={score.tenths / 10} valueNote={t('indicativeWord')} />
      ))}
      <p className="m-0 border-t border-rule-softer pt-3 text-[12px] leading-[1.5] text-muted max-md:text-[15px]">
        {t('indicative')}
        <br />
        {t('label')}
      </p>
    </section>
  )
}
