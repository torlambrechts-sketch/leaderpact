import 'server-only'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { Pill } from '@/components/lp/Pill'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { levelText, levelWidth } from '@/components/lp/level'
import { ScaleRows } from '@/components/results/ScaleRows'
import { resultLabels } from '@/components/results/labels'
import { dateFormat } from '@/lib/i18n/dates'
import { pulseChange } from '@/lib/pulses/build'
import { loadPulseResult } from '@/lib/pulses/load'
import type { Round } from '@/lib/rounds/schema'
import { assessPath } from '@/lib/routes'

/**
 * A pulse's result (handoff 6.16 and 7), once it has closed with at least its threshold of answers: each focus
 * scale's level, agreement label and standing, each working agreement's level, and each question's mean,
 * read from the snapshot written at close (0020). Change compares a focus scale or an agreement with the last
 * pulse that asked the same thing, and shows only at the margin (0.6) or more; a smaller one reads "within
 * normal variation", and a question not asked before shows none. Items show their mean and nothing else. While
 * the pulse is open the page shows its count, never a score; a pulse with too few answers reads as missed.
 */
export async function PulseResult({ group, groupName, round }: { group: string; groupName: string; round: Round }) {
  const [{ t, rows: labels, change }, tp] = await Promise.all([resultLabels(), getTranslations('pulses')])
  const day = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  const eyebrow = tp('resultEyebrow', { group: groupName, number: round.number })

  if (round.phase !== 'released') {
    return (
      <AppPage>
        <PageTitle eyebrow={eyebrow} title={t('title')} />
        <Card large className="flex flex-col gap-3">
          <h2 className="m-0 text-[17px] font-bold">{round.phase === 'closed' ? tp('missedTitle') : t('emptyTitle')}</h2>
          <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">
            {round.phase === 'closed' && round.k !== null
              ? tp('missedBody', { k: round.k })
              : round.answered !== null && round.invited !== null && round.k !== null
                ? tp('openBody', { answered: round.answered, total: round.invited, k: round.k })
                : tp('resultNotYet')}
          </p>
          {round.phase === 'answering' && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('countsOnly')}</p>}
          <Link href={assessPath(group) as Route} className="text-link self-start text-[14px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center max-md:text-[15px]">
            {t('toAssess')}
          </Link>
        </Card>
      </AppPage>
    )
  }

  const result = await loadPulseResult(round.id)
  if (result === null || result === 'none') return <PageProblem title={t('readFailed')} />
  const words = (c: ReturnType<typeof pulseChange>) => (c.kind === 'first' ? tp('notAskedBefore') : change(c))
  const scales = result.scales.map((s) => ({
    key: s.key,
    name: s.name,
    readingType: s.reading_type,
    evidence: s.evidence,
    levelTenths: Math.round(s.level * 10),
    agreement: s.agreement,
    standing: s.standing,
    change: words(pulseChange(s.before, s.level, result.margin)),
  }))

  return (
    <AppPage>
      <div className="flex flex-col gap-2">
        <PageTitle eyebrow={eyebrow} title={t('title')} />
        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">
          {tp('resultSummary', { opened: day(result.opens_at), answered: result.answered, total: result.invited })}
        </p>
        <p className="m-0 text-[13px] font-semibold text-ink max-md:text-[15px]">{t('label')}</p>
      </div>

      {scales.length > 0 && (
        <Card large>
          <SectionHeader title={tp('focusTitle')} meta={tp('focusMeta', { count: scales.length })} className="mb-3" />
          <ScaleRows rows={scales} labels={labels} />
        </Card>
      )}

      {result.agreements.length > 0 && (
        <Card large>
          <SectionHeader title={tp('agreementsTitle')} meta={tp('agreementsMeta', { count: result.agreements.length })} className="mb-3" />
          <div aria-hidden className={`hidden pb-2 text-[11.5px] font-bold uppercase tracking-[0.04em] text-muted ${AGREEMENT_COLUMNS}`}>
            <span>{tp('colAgreement')}</span>
            <span>{labels.columns.level}</span>
            <span>{labels.columns.change}</span>
          </div>
          <ul className="m-0 list-none p-0">
            {result.agreements.map((a, i) => {
              const c = words(pulseChange(a.before, a.level, result.margin))
              return (
                <li key={i} className={`flex flex-col gap-2 border-t border-divider py-3 ${AGREEMENT_COLUMNS}`}>
                  <p className="m-0 text-[14px] [overflow-wrap:anywhere] max-md:text-[15px]">{a.text}</p>
                  <Level level={a.level} words={labels.levelWords(levelText(a.level))} />
                  <p className="m-0 text-[12.5px] text-text-2 max-md:text-[14px]">
                    <span className="sr-only">{labels.changeWords(c)}</span>
                    <span aria-hidden>{c}</span>
                  </p>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {result.items.length > 0 && (
        <Card large>
          <SectionHeader title={tp('itemsTitle')} meta={tp('itemsMeta')} className="mb-3" />
          <ul className="m-0 list-none p-0">
            {result.items.map((item, i) => (
              <li key={i} className="flex flex-col gap-2 border-t border-divider py-3 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-center md:gap-4">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="m-0 text-[14px] [overflow-wrap:anywhere] max-md:text-[15px]">{item.text}</p>
                  <Pill tone={item.source === 'focus' ? 'accent' : 'neutral'} className="self-start whitespace-normal">
                    {item.source === 'focus' ? tp('fromFocus', { scale: item.scale }) : tp('fromRotating', { scale: item.scale })}
                  </Pill>
                </div>
                <Level level={item.level} words={labels.levelWords(levelText(item.level))} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-col gap-1 text-[12.5px] text-text-2 max-md:text-[15px]">
        <p className="m-0">{tp('changeRule', { margin: levelText(result.margin) })}</p>
        <p className="m-0">{t('footnote')}</p>
      </div>
    </AppPage>
  )
}

const AGREEMENT_COLUMNS = 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-4'

/** A level as a bar and its number to one decimal, with the words for a screen reader */
function Level({ level, words }: { level: number; words: string }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="relative h-2 flex-1 overflow-hidden rounded-pill bg-track">
        <span className="absolute inset-y-0 left-0 rounded-pill bg-accent-strong" style={{ width: `${levelWidth(level) * 100}%` }} />
      </span>
      <span className="w-8 text-right text-[14px] font-bold">
        <span className="sr-only">{words}</span>
        <span aria-hidden>{levelText(level)}</span>
      </span>
    </div>
  )
}
