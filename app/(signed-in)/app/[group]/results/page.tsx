import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { EvidenceChip } from '@/components/lp/EvidenceChip'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { StandingLabel } from '@/components/lp/StandingLabel'
import { levelText, levelWidth } from '@/components/lp/level'
import { SamplePage } from '@/components/sample/SamplePage'
import { sampleDay } from '@/components/sample/format'
import { PRODUCT_NAME } from '@/lib/brand'
import { LAYERS, type SampleScaleRow } from '@/lib/sample/results'
import { SAMPLE, SAMPLE_CHANGE_MARGIN, SAMPLE_RESULTS } from '@/lib/sample/load'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('resultsTitle', { product: PRODUCT_NAME }) }
}

const COLUMNS = 'md:grid md:grid-cols-[minmax(0,1.3fr)_100px_minmax(0,1fr)_130px_130px_minmax(0,1fr)] md:items-center md:gap-4'

/**
 * Results on the Free plan (handoff 6.12 and 6.19, design `results`): the overview of a sample round, the
 * three outcomes first and marked self-rated, then the 21 scales by layer. Each row: scale, evidence
 * chip, level, change, agreement label, standing. Standing and change follow section 7, from the
 * version 1 cut-offs; every change in the sample is within normal variation, so none shows as a number.
 *
 * Section 11 leaves out: the dots per answer and confidence bands, SD and the agreement number, lowest,
 * median and highest, histograms, the priority matrix, the radar chart, the reliability and response
 * tiles, the results session, pattern cards and the plan column. Results are built in milestone 11.
 */
export default async function ResultsPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params
  const t = await getTranslations('sample')
  const tAgree = await getTranslations('agreement')
  const tStanding = await getTranslations('standing')
  const tEvidence = await getTranslations('evidence')
  const r = SAMPLE.results
  const roundName = t('results.roundName', { number: r.round })
  const previousName = t('results.roundName', { number: r.previous })

  const row = (s: SampleScaleRow) => {
    const level = s.levelTenths / 10
    const change =
      s.change.kind === 'within' ? t('results.within') : `${s.change.deltaTenths > 0 ? '+' : '−'}${levelText(Math.abs(s.change.deltaTenths) / 10)}`
    return (
      <li key={s.key} className={`flex flex-col gap-2 border-t border-divider py-3 ${COLUMNS}`}>
        <div className="flex flex-col gap-0.5">
          <h3 className="m-0 text-[14px] font-semibold max-md:text-[15px]">{s.name}</h3>
          <p className="m-0 text-[12px] text-muted max-md:text-[13px]">{t(`results.reading_${s.readingType}`)}</p>
        </div>
        <div>
          <EvidenceChip
            rating={s.evidence === 'strong' ? 'strong' : s.evidence === 'moderate' ? 'moderate' : 'other'}
            label={tEvidence(s.evidence ?? 'self_rated')}
          />
        </div>
        <div className="flex items-center gap-3">
          <span aria-hidden className="relative h-2 flex-1 overflow-hidden rounded-pill bg-track">
            <span className="absolute inset-y-0 left-0 rounded-pill bg-accent-strong" style={{ width: `${levelWidth(level) * 100}%` }} />
          </span>
          <span className="w-8 text-right text-[14px] font-bold">
            <span className="sr-only">{t('results.levelWords', { level: levelText(level) })}</span>
            <span aria-hidden>{levelText(level)}</span>
          </span>
        </div>
        <p className="m-0 text-[12.5px] text-text-2 max-md:text-[14px]">
          <span className="sr-only">{t('results.changeWords', { round: previousName, change })}</span>
          <span aria-hidden>{change}</span>
        </p>
        <p className="m-0 text-[12.5px] text-text-2 max-md:text-[14px]">{tAgree(s.agreement)}</p>
        <StandingLabel standing={s.standing} label={tStanding(s.standing)} className="whitespace-normal" />
      </li>
    )
  }

  return (
    <SamplePage group={group}>
      <div className="flex flex-col gap-2">
        <PageTitle eyebrow={t('results.round', { round: roundName })} title={t('results.title')} />
        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">
          {t('results.summary', { answered: r.answered, total: r.invited, closed: sampleDay(r.closed), released: sampleDay(r.released) })}
        </p>
        <p className="m-0 text-[13px] font-semibold text-ink max-md:text-[15px]">{t('results.label')}</p>
      </div>

      {LAYERS.map((layer) => {
        const rows = SAMPLE_RESULTS[layer]
        return (
          <Card large key={layer}>
            <SectionHeader title={t(`results.layer_${layer}`)} meta={t('results.scaleCount', { count: rows.length })} className="mb-1" />
            <p className="m-0 mb-3 text-[13px] text-text-2 max-md:text-[15px]">{t(`results.layerMeta_${layer}`)}</p>
            <div aria-hidden className={`hidden pb-2 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted ${COLUMNS}`}>
              <span>{t('results.colScale')}</span>
              <span>{t('results.colEvidence')}</span>
              <span>{t('results.colLevel')}</span>
              <span>{t('results.colChange')}</span>
              <span>{t('results.colAgreement')}</span>
              <span>{t('results.colStanding')}</span>
            </div>
            <ul className="m-0 list-none p-0">{rows.map(row)}</ul>
          </Card>
        )
      })}

      <div className="flex flex-col gap-1 text-[12.5px] text-text-2 max-md:text-[15px]">
        <p className="m-0">{t('results.changeRule', { round: previousName, margin: levelText(SAMPLE_CHANGE_MARGIN) })}</p>
        <p className="m-0">{t('results.footnote')}</p>
      </div>
    </SamplePage>
  )
}
