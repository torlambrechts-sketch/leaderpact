'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Target } from 'lucide-react'
import { Card } from '@/components/lp/Card'
import { Button } from '@/components/ui/button'
import { makeFocusArea } from '@/lib/plan/actions'
import type { FocusPlace } from '@/lib/plan/build'
import type { PlanReason } from '@/lib/plan/schema'

/**
 * A scale's "Make this a focus area" (handoff 6.12 and section 11): for the leader while a place is open, which
 * makes the scale a focus area and opens the plan. Once it is one, everyone reads that it is; with every place
 * taken, the leader reads that one must close first. Nothing shows for an outcome, or for a member while the
 * scale is not a focus area.
 */
export function MakeFocus({
  group,
  round,
  scale,
  name,
  place,
  max,
  planHref,
}: {
  group: string
  round: string
  scale: string
  name: string
  place: FocusPlace
  max: number
  planHref: string
}) {
  const t = useTranslations('plan')
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  if (place.kind === 'none') return null

  async function make() {
    setBusy(true)
    setProblem(null)
    const result = await makeFocusArea({ group, round, scale }).catch(() => ({ ok: false as const, reason: 'failed' as PlanReason }))
    if (result.ok) {
      router.push(planHref as Route)
      return
    }
    setBusy(false)
    setProblem(
      result.reason === 'full' ? t('full', { max }) : result.reason === 'already' ? t('already') : result.reason === 'unavailable' ? t('unavailable') : t('writeFailed'),
    )
  }

  const link = (
    <Link href={planHref as Route} className="inline-flex items-center gap-1.5 self-start text-[14px] font-bold text-ink underline underline-offset-2 max-md:min-h-[44px] max-md:text-[15px]">
      {t('seePlan')}
      <ArrowRight aria-hidden size={15} />
    </Link>
  )
  return (
    <Card large className="flex flex-col gap-2.5">
      {place.kind === 'open' ? (
        <>
          <Button className="gap-2 self-start" disabled={busy} aria-label={t('makeNamed', { name })} onClick={make}>
            <Target aria-hidden size={16} />
            {busy ? t('working') : t('make')}
          </Button>
          <p className="m-0 text-[13px] text-text-2 max-md:text-[15px]">{t('ruleFocus', { max })}</p>
        </>
      ) : place.kind === 'active' ? (
        <>
          <p className="m-0 text-[14px] font-semibold max-md:text-[15px]">{t('isFocus')}</p>
          {link}
        </>
      ) : (
        <>
          <p className="m-0 text-[14px] max-md:text-[15px]">{t('fullForScale', { max })}</p>
          {link}
        </>
      )}
      {problem && (
        <p role="alert" className="m-0 rounded-btn bg-flag-bg px-3 py-2 text-[13.5px] font-semibold max-md:text-[15px]">
          {problem}
        </p>
      )}
    </Card>
  )
}
