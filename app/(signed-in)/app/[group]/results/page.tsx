import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { levelText } from '@/components/lp/level'
import { ScaleRows } from '@/components/results/ScaleRows'
import { resultLabels } from '@/components/results/labels'
import { SampleResults } from '@/components/sample/SampleResults'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { dateFormat } from '@/lib/i18n/dates'
import { LAYERS, overview } from '@/lib/results/build'
import { loadComparable, loadCutoffsAt, loadScaleResults } from '@/lib/results/load'
import { loadRounds } from '@/lib/rounds/load'
import { SIGN_IN_PATH, assessPath, resultsPath, scalePath } from '@/lib/routes'
import { cn } from '@/lib/cn'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('resultsTitle', { product: PRODUCT_NAME }) }
}

/**
 * Results (handoff 6.12, design `results`). On the Free plan it is the sample (handoff 6.19); with the Team
 * plan or its trial, the group's own: the newest released round of the Full diagnostic, or an earlier one by
 * `?round=`. The overview shows the three outcomes, marked self-rated, then the 21 scales by layer; each row
 * shows the scale, its evidence chip, level, change, agreement label and standing, read from the snapshot
 * written at close (0007). Change shows only between two released rounds, at the margin or more, and only
 * where the questions were the same (owner C5). A first round shows none. Nothing before close: while a round
 * is open the page shows its count, never a score (handoff 7).
 */
export default async function ResultsPage({ params, searchParams }: { params: Promise<{ group: string }>; searchParams: Promise<{ round?: string }> }) {
  const { group } = await params
  const query = await searchParams
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const plan = await loadGroupPlan(group)
  if (plan === null || plan === 'none' || plan.access === 'free') return <SampleResults group={group} />

  const [{ t, rows: labels, change }, tInvite] = await Promise.all([resultLabels(), getTranslations('invite')])
  const [shell, data] = await Promise.all([loadShell(group, user.id), loadRounds(group)])
  if (shell === null || data === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || data === 'none') return <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />

  const day = (iso: string) => dateFormat({ locale: 'en', timeZone: 'UTC' }, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  const diagnostics = data.rounds.filter((r) => r.kind === 'diagnostic')
  const released = diagnostics.filter((r) => r.phase === 'released')
  const chosen = released.find((r) => r.id === query.round) ?? released[0]

  if (!chosen) {
    const open = diagnostics.find((r) => r.phase === 'answering')
    const closed = diagnostics.find((r) => r.phase === 'closed')
    return (
      <AppPage>
        <PageTitle eyebrow={shell.current.name} title={t('title')} />
        <Card large className="flex flex-col gap-3">
          <h2 className="m-0 text-[17px] font-bold">{t('emptyTitle')}</h2>
          <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">
            {open && open.answered !== null && open.invited !== null && open.k !== null
              ? t('emptyOpen', { number: open.number, answered: open.answered, total: open.invited, k: open.k })
              : closed && closed.k !== null
                ? t('emptyClosed', { number: closed.number, k: closed.k })
                : t('emptyNone')}
          </p>
          {open && <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('countsOnly')}</p>}
          <Link href={assessPath(group) as Route} className="text-link self-start text-[14px] font-semibold text-ink underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center max-md:text-[15px]">
            {t('toAssess')}
          </Link>
        </Card>
      </AppPage>
    )
  }

  const previous = released[released.indexOf(chosen) + 1] ?? null
  const at = chosen.closes_at && Date.parse(chosen.closes_at) < Date.now() ? chosen.closes_at : new Date().toISOString()
  const [current, before, cutoffs, comparable] = await Promise.all([
    loadScaleResults(chosen.id),
    previous ? loadScaleResults(previous.id) : undefined,
    loadCutoffsAt(at),
    previous ? loadComparable(chosen.id, previous.id) : undefined,
  ])
  if (current === null || before === null || cutoffs === null || comparable === null || current.length === 0) {
    return <PageProblem title={t('readFailed')} />
  }
  const byLayer = overview(current, before ?? null, !comparable || comparable.all ? null : comparable.keys, cutoffs)

  return (
    <AppPage>
      <div className="flex flex-col gap-2">
        <PageTitle eyebrow={t('round', { group: shell.current.name, number: chosen.number })} title={t('title')} />
        <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">
          {t('summary', { opened: day(chosen.opens_at), answered: chosen.answered ?? 0, total: chosen.invited ?? 0 })}
        </p>
        <p className="m-0 text-[13px] font-semibold text-ink max-md:text-[15px]">{t('label')}</p>
        {released.length > 1 && (
          <nav aria-label={t('roundsLabel')} className="flex flex-wrap gap-2 pt-1">
            {released.map((r) => (
              <Link
                key={r.id}
                href={resultsPath(group, r.id) as Route}
                aria-current={r.id === chosen.id ? 'page' : undefined}
                className={cn(
                  'rounded-pill border px-3 py-1.5 text-[13px] font-semibold max-md:min-h-[44px] max-md:content-center',
                  r.id === chosen.id ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink',
                )}
              >
                {t('roundLink', { number: r.number })}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {LAYERS.map((layer) => {
        const rows = byLayer[layer].map((s) => ({ ...s, change: change(s.change), href: scalePath(group, s.key, chosen.id) }))
        return (
          <Card large key={layer}>
            <SectionHeader title={t(`layer_${layer}`)} meta={t('scaleCount', { count: rows.length })} className="mb-1" />
            <p className="m-0 mb-3 text-[13px] text-text-2 max-md:text-[15px]">{t(`layerMeta_${layer}`)}</p>
            <ScaleRows rows={rows} labels={labels} />
          </Card>
        )
      })}

      <div className="flex flex-col gap-1 text-[12.5px] text-text-2 max-md:text-[15px]">
        <p className="m-0">{previous ? t('changeRule', { number: previous.number, margin: levelText(cutoffs.changeMargin) }) : t('changeFirst')}</p>
        <p className="m-0">{t('footnote')}</p>
      </div>
    </AppPage>
  )
}
