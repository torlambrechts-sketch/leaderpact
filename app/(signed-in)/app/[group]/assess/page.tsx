import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Activity, ClipboardList } from 'lucide-react'
import { PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { IconTile } from '@/components/lp/IconTile'
import { Pill } from '@/components/lp/Pill'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { SamplePage } from '@/components/sample/SamplePage'
import { sampleDay } from '@/components/sample/format'
import { PRODUCT_NAME } from '@/lib/brand'
import { cn } from '@/lib/cn'
import { SAMPLE } from '@/lib/sample/load'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('assessTitle', { product: PRODUCT_NAME }) }
}

const PHASES = ['scheduled', 'answering', 'closed', 'released'] as const

/**
 * Assess on the Free plan (handoff 6.10 and 6.19, design `assess`): a plain list of the sample's rounds and
 * pulses, each with its name, phase, dates and count of answers. Section 11's corrections: four phases, not
 * six; one full diagnostic of 72 questions, never "standard" or "extensive"; no library, schedule or
 * coverage tabs; no team-leader feedback round; no picker for who takes part, and no "release results"
 * choice. Diagnostic rounds are built in milestone 10, pulses in 15.
 */
export default async function AssessPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const t = await getTranslations('sample')
  return (
    <SamplePage group={group}>
      <PageTitle eyebrow={t('eyebrow', { group: SAMPLE.group })} title={t('assess.title')} />
      <Card large>
        <SectionHeader title={t('assess.roundsTitle')} meta={t('assess.roundsMeta')} />
        <ul className="m-0 list-none p-0">
          {SAMPLE.rounds.map((round) => {
            const at = PHASES.indexOf(round.phase)
            const dates =
              round.opens && round.closes
                ? t('assess.dates', { from: sampleDay(round.opens), to: sampleDay(round.closes) })
                : round.opens
                  ? t('assess.opens', { date: sampleDay(round.opens) })
                  : null
            const count = round.answered === null ? t('assess.invited', { total: round.invited }) : t('assess.answered', { answered: round.answered, total: round.invited })
            return (
              <li key={round.name} className="flex flex-col gap-3.5 border-t border-divider py-4">
                <div className="flex items-start gap-3">
                  <IconTile icon={round.kind === 'pulse' ? Activity : ClipboardList} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h3 className="m-0 text-[15px] font-bold">{round.kind === 'diagnostic' ? t('assess.titleDiagnostic', { name: round.name }) : round.name}</h3>
                    <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{dates ? `${dates} · ${count}` : count}</p>
                  </div>
                  <Pill tone={round.phase === 'released' ? 'accent' : 'neutral'}>{t(`assess.phase_${round.phase}`)}</Pill>
                </div>
                <ol aria-label={t('assess.phasesLabel', { phase: t(`assess.phase_${round.phase}`) })} className="m-0 grid list-none grid-cols-4 gap-2 p-0">
                  {PHASES.map((phase, i) => (
                    <li key={phase} aria-current={i === at ? 'step' : undefined} className="flex flex-col gap-1.5">
                      <span aria-hidden className={cn('h-1.5 rounded-pill', i < at ? 'bg-ink' : i === at ? 'bg-accent-strong' : 'bg-track')} />
                      <span className={cn('min-w-0 text-[12px] [overflow-wrap:anywhere]', i <= at ? 'font-bold text-ink' : 'text-muted')}>{t(`assess.phase_${phase}`)}</span>
                    </li>
                  ))}
                </ol>
              </li>
            )
          })}
        </ul>
        <p className="m-0 border-t border-divider pt-3 text-[12.5px] text-muted max-md:text-[15px]">{t('assess.note')}</p>
      </Card>
    </SamplePage>
  )
}
