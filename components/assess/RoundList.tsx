import 'server-only'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Activity, Check, ClipboardList } from 'lucide-react'
import { IconTile } from '@/components/lp/IconTile'
import { Pill } from '@/components/lp/Pill'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { PHASES, type Round } from '@/lib/rounds/schema'

export interface RoundRow extends Round {
  /** the opening and closing days, as the reader reads them */
  from: string
  to: string | null
  /** the questionnaire, for a member asked who has yet to answer */
  answerHref: string | null
  /** the round's results, once released (milestone 11) */
  resultsHref: string | null
}

/**
 * The group's rounds (handoff 6.10, design `assess` "Rounds and phases"): a plain list, each with its name,
 * phase, dates and the count of answers. Section 11's corrections: four phases, not six; no cancel, no
 * "advance" and no "release results", because results open at close; no simulated answers. While a round
 * is open it shows "5 of 8 answered", never a score and never a name; the reader sees only their own state.
 * A pulse with fewer answers than its threshold reads as missed (handoff 6.16).
 */
export async function RoundList({ rounds }: { rounds: RoundRow[] }) {
  const t = await getTranslations('assess')
  return (
    <ul aria-label={t('roundsTitle')} className="m-0 list-none p-0">
      {rounds.map((round) => {
        const at = PHASES.indexOf(round.phase)
        const phase = t(`phase_${round.phase}`)
        const title = round.kind === 'diagnostic' ? t('roundTitle', { number: round.number }) : t('pulseTitle', { number: round.number })
        const dates = round.to ? t('dates', { from: round.from, to: round.to }) : t('opens', { date: round.from })
        const line = round.invited === null ? dates : `${dates} · ${t('invited', { count: round.invited })}`
        return (
          <li key={round.id} className="flex flex-col gap-3.5 border-t border-divider py-4">
            <div className="flex items-start gap-3">
              <IconTile icon={round.kind === 'pulse' ? Activity : ClipboardList} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h3 className="m-0 text-[15px] font-bold">{title}</h3>
                <p className="m-0 text-[13px] text-muted max-md:text-[15px]">{line}</p>
              </div>
              <Pill tone={round.phase === 'released' ? 'accent' : round.phase === 'answering' ? 'pending' : 'neutral'}>{phase}</Pill>
            </div>
            <ol aria-label={t('phasesLabel', { phase })} className="m-0 grid list-none grid-cols-4 gap-2 p-0">
              {PHASES.map((p, i) => (
                <li key={p} aria-current={i === at ? 'step' : undefined} className="flex flex-col gap-1.5">
                  <span aria-hidden className={cn('h-1.5 rounded-pill', i < at ? 'bg-ink' : i === at ? 'bg-accent-strong' : 'bg-track')} />
                  <span className={cn('min-w-0 text-[12px] [overflow-wrap:anywhere]', i <= at ? 'font-bold text-ink' : 'text-muted')}>{t(`phase_${p}`)}</span>
                </li>
              ))}
            </ol>

            {round.phase === 'answering' && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
                {round.answered !== null && round.invited !== null && (
                  <p className="m-0 flex items-center gap-2.5 text-[13px] font-bold max-md:text-[15px]">
                    <span aria-hidden className="h-2 w-[120px] overflow-hidden rounded-pill bg-track">
                      <span className="block h-full bg-ink" style={{ width: `${round.invited ? (100 * round.answered) / round.invited : 0}%` }} />
                    </span>
                    {t('answered', { answered: round.answered, total: round.invited })}
                  </p>
                )}
                <span className="text-[12.5px] text-text-2 max-md:text-[15px]">{t('countsOnly')}</span>
                <span className="flex-1" />
                {round.me === 'answered' && (
                  <span className="flex items-center gap-1.5 text-[13px] font-bold max-md:text-[15px]">
                    <Check aria-hidden size={15} />
                    {t('youAnswered')}
                  </span>
                )}
                {round.me === 'to_answer' && round.answerHref && (
                  <Link href={round.answerHref as Route} className={buttonVariants({ size: 'compact' })}>
                    {t('answerNow')}
                  </Link>
                )}
              </div>
            )}
            {round.phase === 'answering' && round.me === null && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('notAsked')}</p>}
            {round.phase === 'answering' && round.extended && round.k !== null && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('extended', { k: round.k })}</p>}
            {round.phase === 'closed' && round.k !== null && (
              <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{round.kind === 'pulse' ? t('missed', { k: round.k }) : t('noResult', { k: round.k })}</p>
            )}
            {round.phase === 'released' && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('released')}</p>
                {round.resultsHref && (
                  <Link href={round.resultsHref as Route} className={buttonVariants({ variant: 'secondary', size: 'compact' })}>
                    {t('seeResults')}
                  </Link>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
