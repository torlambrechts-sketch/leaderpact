import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { EvidenceChip } from '@/components/lp/EvidenceChip'
import { StandingLabel } from '@/components/lp/StandingLabel'
import { levelText, levelWidth } from '@/components/lp/level'
import { resultLabels } from '@/components/results/labels'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { changeFor, guidanceFor } from '@/lib/results/build'
import { loadComparable, loadCutoffsAt, loadDefinition, loadScaleResults } from '@/lib/results/load'
import { loadRounds } from '@/lib/rounds/load'
import { SIGN_IN_PATH, resultsPath, scaleItemsPath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('scaleTitle', { product: PRODUCT_NAME }) }
}

/**
 * One scale of a released round (handoff 6.12, the second depth): its definition, level, agreement label,
 * standing, change since the round before, the evidence behind it, and the guidance, whose tone follows the
 * scale's own evidence rating (handoff 7, Guidance wording). Its questions are the third depth. "Make this a
 * focus area" comes with the focus areas (milestone 12).
 */
export default async function ScalePage({ params, searchParams }: { params: Promise<{ group: string; scale: string }>; searchParams: Promise<{ round?: string }> }) {
  const { group, scale } = await params
  const query = await searchParams
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [{ t, rows: labels, change }, tInvite] = await Promise.all([resultLabels(), getTranslations('invite')])
  const notFound = <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />
  const plan = await loadGroupPlan(group)
  if (plan === null) return <PageProblem title={tInvite('readFailed')} />
  if (plan === 'none' || plan.access === 'free' || !/^[a-z][a-z_]*[a-z]$/.test(scale)) return notFound

  const [shell, data] = await Promise.all([loadShell(group, user.id), loadRounds(group)])
  if (shell === null || data === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || data === 'none') return notFound
  const released = data.rounds.filter((r) => r.kind === 'diagnostic' && r.phase === 'released')
  const chosen = released.find((r) => r.id === query.round)
  if (!chosen) return notFound
  const previous = released[released.indexOf(chosen) + 1] ?? null
  const at = chosen.closes_at && Date.parse(chosen.closes_at) < Date.now() ? chosen.closes_at : new Date().toISOString()

  const [current, before, cutoffs, comparable, definition] = await Promise.all([
    loadScaleResults(chosen.id),
    previous ? loadScaleResults(previous.id) : undefined,
    loadCutoffsAt(at),
    previous ? loadComparable(chosen.id, previous.id) : undefined,
    loadDefinition(scale),
  ])
  if (current === null || before === null || cutoffs === null || comparable === null) return <PageProblem title={t('readFailed')} />
  const s = current.find((r) => r.key === scale)
  if (!s) return notFound

  const levelTenths = Math.round(s.level * 10)
  const shift = changeFor(s.key, levelTenths, before ? new Map(before.map((b) => [b.key, b.level])) : null, !comparable || comparable.all ? null : comparable.keys, cutoffs)
  const guidance = guidanceFor(s)
  const back = resultsPath(group, chosen.id)
  const field = 'flex flex-col gap-1.5 border-t border-divider pt-3'
  const name = 'm-0 text-[12px] font-bold uppercase tracking-[0.04em] text-muted'

  return (
    <AppPage>
      <Link href={back as Route} className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-text-2 hover:text-ink max-md:min-h-[44px] max-md:text-[15px]">
        <ArrowLeft aria-hidden size={15} />
        {t('back')}
      </Link>
      <div className="flex flex-col gap-2">
        <PageTitle eyebrow={t('round', { group: shell.current.name, number: chosen.number })} title={s.name} />
        {definition && <p className="m-0 max-w-[720px] text-[15px] leading-[1.55] text-text-2">{definition}</p>}
        <p className="m-0 text-[13px] font-semibold text-ink max-md:text-[15px]">{t('label')}</p>
      </div>

      <div className="grid items-start gap-5 min-[960px]:grid-cols-[minmax(0,1fr)_380px]">
        <Card large className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className={name}>{t('colLevel')}</p>
            <div className="flex items-center gap-4">
              <span className="text-big-number">
                <span className="sr-only">{labels.levelWords(levelText(s.level))}</span>
                <span aria-hidden>{levelText(s.level)}</span>
              </span>
              <span aria-hidden className="relative h-2.5 max-w-[320px] flex-1 overflow-hidden rounded-pill bg-track">
                <span className="absolute inset-y-0 left-0 rounded-pill bg-accent-strong" style={{ width: `${levelWidth(s.level) * 100}%` }} />
              </span>
            </div>
            <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{labels.reading[s.readingType]}</p>
          </div>
          <div className={field}>
            <p className={name}>{t('colStanding')}</p>
            <StandingLabel standing={s.standing} label={labels.standing[s.standing]} className="whitespace-normal text-[14px]" />
          </div>
          <div className={field}>
            <p className={name}>{t('colAgreement')}</p>
            <p className="m-0 text-[14px] font-semibold max-md:text-[15px]">{labels.agreement[s.agreement]}</p>
          </div>
          <div className={field}>
            <p className={name}>{t('colChange')}</p>
            <p className="m-0 text-[14px] max-md:text-[15px]">
              {previous && shift.kind !== 'first' ? t('changeSince', { number: previous.number, change: change(shift) }) : change(shift)}
            </p>
          </div>
          <p className="m-0 border-t border-divider pt-3 text-[12.5px] text-text-2 max-md:text-[15px]">{t('basedOn', { n: s.n })}</p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card large className="flex flex-col gap-2">
            <h2 className="m-0 text-[16px] font-bold">{t('guidanceTitle')}</h2>
            <p className="m-0 text-[14px] leading-[1.55] text-text-2 max-md:text-[15px]">{t(`guide_${guidance}`, { scale: s.name, level: levelText(s.level) })}</p>
          </Card>
          <Card large className="flex flex-col gap-2">
            <h2 className="m-0 text-[16px] font-bold">{t('evidenceTitle')}</h2>
            <EvidenceChip
              rating={s.evidence === 'strong' ? 'strong' : s.evidence === 'moderate' ? 'moderate' : 'other'}
              label={labels.evidence(s.evidence)}
              className="self-start"
            />
            <p className="m-0 text-[13.5px] leading-[1.5] text-text-2 max-md:text-[15px]">{t(`why_${s.evidence ?? 'self_rated'}`)}</p>
          </Card>
          <Link
            href={scaleItemsPath(group, s.key, chosen.id) as Route}
            className="inline-flex items-center gap-1.5 self-start text-[14px] font-bold text-ink underline underline-offset-2 max-md:min-h-[44px] max-md:text-[15px]"
          >
            {t('questionsLink')}
            <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
      </div>
    </AppPage>
  )
}
