import 'server-only'
import { getTranslations } from 'next-intl/server'
import { PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { levelText } from '@/components/lp/level'
import { ScaleRows, type ScaleRowLabels } from '@/components/results/ScaleRows'
import { SamplePage } from '@/components/sample/SamplePage'
import { sampleDay } from '@/components/sample/format'
import { LAYERS } from '@/lib/sample/results'
import { SAMPLE, SAMPLE_CHANGE_MARGIN, SAMPLE_RESULTS } from '@/lib/sample/load'
import { STANDINGS } from '@/lib/scoring'

/**
 * Results on the Free plan (handoff 6.12 and 6.19, design `results`): the overview of a sample round, the
 * three outcomes first and marked self-rated, then the 21 scales by layer, drawn with the group's own rows
 * (components/results/ScaleRows.tsx). Standing and change follow section 7, from the version 1 cut-offs;
 * every change in the sample is within normal variation, so none shows as a number. With the Team plan or
 * its trial, the group's own results show instead (app/(signed-in)/app/[group]/results).
 *
 * Section 11 leaves out: the dots per answer and confidence bands, SD and the agreement number, lowest,
 * median and highest, histograms, the priority matrix, the radar chart, the reliability and response
 * tiles, the results session, pattern cards and the plan column.
 */
export async function SampleResults({ group }: { group: string }) {
  const [t, tAgree, tStanding, tEvidence] = await Promise.all([
    getTranslations('sample'),
    getTranslations('agreement'),
    getTranslations('standing'),
    getTranslations('evidence'),
  ])
  const r = SAMPLE.results
  const roundName = t('results.roundName', { number: r.round })
  const previousName = t('results.roundName', { number: r.previous })
  const labels: ScaleRowLabels = {
    reading: {
      higher: t('results.reading_higher'),
      lower: t('results.reading_lower'),
      descriptive: t('results.reading_descriptive'),
      conditional: t('results.reading_conditional'),
    },
    evidence: (e) => tEvidence(e ?? 'self_rated'),
    agreement: { high: tAgree('high'), medium: tAgree('medium'), low: tAgree('low') },
    standing: Object.fromEntries(STANDINGS.map((s) => [s, tStanding(s)])) as ScaleRowLabels['standing'],
    levelWords: (level) => t('results.levelWords', { level }),
    changeWords: (change) => t('results.changeWords', { round: previousName, change }),
    columns: {
      scale: t('results.colScale'),
      evidence: t('results.colEvidence'),
      level: t('results.colLevel'),
      change: t('results.colChange'),
      agreement: t('results.colAgreement'),
      standing: t('results.colStanding'),
    },
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
        const rows = SAMPLE_RESULTS[layer].map((s) => ({
          ...s,
          change:
            s.change.kind === 'within' ? t('results.within') : `${s.change.deltaTenths > 0 ? '+' : '−'}${levelText(Math.abs(s.change.deltaTenths) / 10)}`,
        }))
        return (
          <Card large key={layer}>
            <SectionHeader title={t(`results.layer_${layer}`)} meta={t('results.scaleCount', { count: rows.length })} className="mb-1" />
            <p className="m-0 mb-3 text-[13px] text-text-2 max-md:text-[15px]">{t(`results.layerMeta_${layer}`)}</p>
            <ScaleRows rows={rows} labels={labels} />
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
