import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { AppPage, PageProblem, PageTitle } from '@/components/app/AppPage'
import { Card } from '@/components/lp/Card'
import { levelText } from '@/components/lp/level'
import { PRODUCT_NAME } from '@/lib/brand'
import { currentUser } from '@/lib/auth/session'
import { loadGroupPlan } from '@/lib/billing/load'
import { loadShell } from '@/lib/groups/load'
import { loadItemResults, loadScaleResults } from '@/lib/results/load'
import { loadRounds } from '@/lib/rounds/load'
import { SIGN_IN_PATH, scalePath } from '@/lib/routes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta')
  return { title: t('scaleItemsTitle', { product: PRODUCT_NAME }) }
}

/**
 * A scale's questions in a released round (handoff 6.12, the third depth): each question's text and its mean
 * to one decimal. Nothing else: no spread, no share who agree, no answers per option (handoff section 11).
 */
export default async function ScaleItemsPage({ params, searchParams }: { params: Promise<{ group: string; scale: string }>; searchParams: Promise<{ round?: string }> }) {
  const { group, scale } = await params
  const query = await searchParams
  const user = await currentUser()
  if (!user) redirect(SIGN_IN_PATH as Route)
  const [t, tInvite] = await Promise.all([getTranslations('results'), getTranslations('invite')])
  const notFound = <PageProblem title={tInvite('notFoundTitle')} body={tInvite('notFoundBody')} />
  const plan = await loadGroupPlan(group)
  if (plan === null) return <PageProblem title={tInvite('readFailed')} />
  if (plan === 'none' || plan.access === 'free' || !/^[a-z][a-z_]*[a-z]$/.test(scale)) return notFound

  const [shell, data] = await Promise.all([loadShell(group, user.id), loadRounds(group)])
  if (shell === null || data === null) return <PageProblem title={tInvite('readFailed')} />
  if (shell === 'none' || data === 'none') return notFound
  const chosen = data.rounds.find((r) => r.kind === 'diagnostic' && r.phase === 'released' && r.id === query.round)
  if (!chosen) return notFound

  const [scales, items] = await Promise.all([loadScaleResults(chosen.id), loadItemResults(chosen.id, scale)])
  if (scales === null || items === null) return <PageProblem title={t('readFailed')} />
  const s = scales.find((r) => r.key === scale)
  if (!s || items.length === 0) return notFound

  return (
    <AppPage>
      <Link
        href={scalePath(group, s.key, chosen.id) as Route}
        className="inline-flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-text-2 hover:text-ink max-md:min-h-[44px] max-md:text-[15px]"
      >
        <ArrowLeft aria-hidden size={15} />
        {t('backToScale', { scale: s.name })}
      </Link>
      <div className="flex flex-col gap-2">
        <PageTitle eyebrow={t('round', { group: shell.current.name, number: chosen.number })} title={t('itemsTitle', { scale: s.name })} />
        <p className="m-0 text-[14px] text-text-2 max-md:text-[15px]">{t('itemsLead')}</p>
      </div>
      <Card large>
        <ul aria-label={t('itemsTitle', { scale: s.name })} className="m-0 list-none p-0">
          {items.map((item) => (
            <li key={item.code} className="flex items-start justify-between gap-4 border-t border-divider py-3 first:border-t-0">
              <span className="text-[14.5px] leading-[1.5] max-md:text-[15px]">{item.text}</span>
              <span className="shrink-0 text-[15px] font-bold">
                <span className="sr-only">{t('itemMean', { level: levelText(item.level) })}</span>
                <span aria-hidden>{levelText(item.level)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('label')}</p>
    </AppPage>
  )
}
