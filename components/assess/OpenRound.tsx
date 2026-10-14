'use client'
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/lp/Card'
import { Button } from '@/components/ui/button'
import { openDiagnostic } from '@/lib/rounds/actions'
import type { OpenResult } from '@/lib/rounds/schema'

/**
 * The leader opens the Full diagnostic (handoff 6.10): every current member is asked, with no picker. Asked
 * once more on the page, since a round cannot be cancelled. A group with fewer members than its threshold is
 * told how many more it needs, and where to invite them.
 */
export function OpenRound({
  group,
  members,
  k,
  questions,
  days,
  membersHref,
}: {
  group: string
  members: number
  k: number
  questions: number
  days: number
  membersHref: string
}) {
  const t = useTranslations('assess')
  const router = useRouter()
  const [asking, setAsking] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const ask = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    if (asking) ask.current?.focus()
  }, [asking])

  const tooFew = members < k

  async function open() {
    setBusy(true)
    setProblem(null)
    const result: OpenResult = await openDiagnostic({ group }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setBusy(false)
    setAsking(false)
    if (result.ok) return router.refresh()
    setProblem(
      result.reason === 'open_round'
        ? t('openRefusedOpen')
        : result.reason === 'too_few'
          ? t('tooFew', { k: result.k ?? k, members: result.members ?? members })
          : result.reason === 'unavailable'
            ? t('openRefusedPlan')
            : result.reason === 'not_leader'
              ? t('openRefusedLeader')
              : t('openFailed'),
    )
    router.refresh()
  }

  return (
    <Card large className="flex flex-col gap-3">
      <h2 className="m-0 text-[16px] font-bold">{t('openTitle')}</h2>
      <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('openBody', { questions, members, days })}</p>
      <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('openRule', { k })}</p>
      {problem && (
        <p role="alert" className="m-0 rounded-btn bg-flag-bg px-4 py-3 text-[13.5px] font-semibold max-md:text-[15px]">
          {problem}
        </p>
      )}
      {tooFew ? (
        <>
          <p className="m-0 text-[13.5px] font-semibold max-md:text-[15px]">{t('tooFew', { k, members })}</p>
          <Link href={membersHref as Route} className="self-start text-[13.5px] font-bold underline underline-offset-2 max-md:inline-flex max-md:min-h-[44px] max-md:items-center max-md:text-[15px]">
            {t('inviteMembers')}
          </Link>
        </>
      ) : asking ? (
        <div className="flex flex-col gap-3 rounded-option border-[1.5px] border-line-strong bg-surface-soft p-4">
          <p ref={ask} tabIndex={-1} className="m-0 text-[14px] font-bold focus-visible:outline-none max-md:text-[15px]">
            {t('openAsk', { members })}
          </p>
          <p className="m-0 text-[13.5px] text-text-2 max-md:text-[15px]">{t('openAskBody')}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={open}>
              {busy ? t('opening') : t('openConfirm')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setAsking(false)}>
              {t('notYet')}
            </Button>
          </div>
        </div>
      ) : (
        <Button className="self-start" onClick={() => setAsking(true)}>
          {t('openButton')}
        </Button>
      )}
    </Card>
  )
}
