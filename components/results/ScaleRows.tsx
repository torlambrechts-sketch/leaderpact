import Link from 'next/link'
import type { Route } from 'next'
import { EvidenceChip } from '@/components/lp/EvidenceChip'
import { StandingLabel } from '@/components/lp/StandingLabel'
import { levelText, levelWidth } from '@/components/lp/level'
import type { Evidence } from '@/lib/results/build'
import type { ReadingType, Standing } from '@/lib/scoring'

export const RESULT_COLUMNS = 'md:grid md:grid-cols-[minmax(0,1.3fr)_100px_minmax(0,1fr)_130px_130px_minmax(0,1fr)] md:items-center md:gap-4'

export interface ScaleRowView {
  key: string
  name: string
  readingType: ReadingType
  evidence: Evidence
  levelTenths: number
  agreement: 'high' | 'medium' | 'low'
  standing: Standing
  /** the change column, in words or as a signed number */
  change: string
  /** the scale's own page, where there is one */
  href?: string
}

export interface ScaleRowLabels {
  reading: Record<ReadingType, string>
  evidence: (evidence: Evidence) => string
  agreement: Record<'high' | 'medium' | 'low', string>
  standing: Record<Standing, string>
  levelWords: (level: string) => string
  changeWords: (change: string) => string
  columns: { scale: string; evidence: string; level: string; change: string; agreement: string; standing: string }
}

/**
 * One layer's scales (handoff 6.12, design `results`): scale, evidence chip, level, change, agreement label,
 * standing, and nothing else (handoff 7, What a result may show). The level is a bar and its number to one
 * decimal; the agreement is a label, never a number; the standing is one word with its icon, never a colour
 * alone. The sample's overview (milestone 6) and the group's own (milestone 11) both draw it.
 */
export function ScaleRows({ rows, labels }: { rows: readonly ScaleRowView[]; labels: ScaleRowLabels }) {
  return (
    <>
      <div aria-hidden className={`hidden pb-2 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted ${RESULT_COLUMNS}`}>
        <span>{labels.columns.scale}</span>
        <span>{labels.columns.evidence}</span>
        <span>{labels.columns.level}</span>
        <span>{labels.columns.change}</span>
        <span>{labels.columns.agreement}</span>
        <span>{labels.columns.standing}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((s) => {
          const level = s.levelTenths / 10
          return (
            <li key={s.key} className={`flex flex-col gap-2 border-t border-divider py-3 ${RESULT_COLUMNS}`}>
              <div className="flex flex-col gap-0.5">
                <h3 className="m-0 text-[14px] font-semibold max-md:text-[15px]">
                  {s.href ? (
                    <Link href={s.href as Route} className="underline-offset-2 hover:underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
                      {s.name}
                    </Link>
                  ) : (
                    s.name
                  )}
                </h3>
                <p className="m-0 text-[12px] text-muted max-md:text-[13px]">{labels.reading[s.readingType]}</p>
              </div>
              <div>
                <EvidenceChip rating={s.evidence === 'strong' ? 'strong' : s.evidence === 'moderate' ? 'moderate' : 'other'} label={labels.evidence(s.evidence)} />
              </div>
              <div className="flex items-center gap-3">
                <span aria-hidden className="relative h-2 flex-1 overflow-hidden rounded-pill bg-track">
                  <span className="absolute inset-y-0 left-0 rounded-pill bg-accent-strong" style={{ width: `${levelWidth(level) * 100}%` }} />
                </span>
                <span className="w-8 text-right text-[14px] font-bold">
                  <span className="sr-only">{labels.levelWords(levelText(level))}</span>
                  <span aria-hidden>{levelText(level)}</span>
                </span>
              </div>
              <p className="m-0 text-[12.5px] text-text-2 max-md:text-[14px]">
                <span className="sr-only">{labels.changeWords(s.change)}</span>
                <span aria-hidden>{s.change}</span>
              </p>
              <p className="m-0 text-[12.5px] text-text-2 max-md:text-[14px]">{labels.agreement[s.agreement]}</p>
              <StandingLabel standing={s.standing} label={labels.standing[s.standing]} className="whitespace-normal" />
            </li>
          )
        })}
      </ul>
    </>
  )
}
