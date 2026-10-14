'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useTranslations } from 'next-intl'
import { StatementFlow, type StatementLabels } from '@/components/respond/StatementFlow'
import { LANDING_PATH, RESULT_PATH } from '@/lib/routes'
import { deviceStore, readDraft, writeDraft, type Draft } from '@/lib/scan/draft'
import type { Scan } from '@/lib/scan/model'

/**
 * The scan (handoff 6.2, design `scan`): its 12 questions in Appendix C's order, each under its theme, through
 * the statement renderer (components/respond/StatementFlow.tsx). Every answer is saved on the device as it
 * is given, so an abandoned scan resumes where it was left, for 7 days (lib/scan/draft.ts); nothing leaves
 * the device. The last question's button opens the personal view.
 *
 * A group's invite link runs the same scan (handoff 6.5) with its own draft (`draftKey`), its own way out
 * (`onLeave`, back to the link's intro) and its own last step (`onFinish`) instead of the public personal
 * view.
 */
export function ScanFlow({
  scan,
  draftKey,
  leaveHref = LANDING_PATH,
  onLeave,
  onFinish,
}: {
  scan: Scan
  draftKey?: string
  leaveHref?: string
  onLeave?: () => void
  onFinish?: (answers: Record<string, number>) => void
}) {
  const t = useTranslations('scan')
  const router = useRouter()

  React.useEffect(() => {
    if (!onFinish) router.prefetch(RESULT_PATH as Route)
  }, [router, onFinish])

  const items = React.useMemo(
    () => scan.items.map((item) => ({ id: item.id, text: item.text, chip: scan.themes.find((th) => th.key === item.theme)?.name })),
    [scan],
  )
  const draft = React.useMemo(
    () => ({
      read: () => readDraft(deviceStore(), scan, new Date(), draftKey),
      write: (d: Draft) => void writeDraft(deviceStore(), scan, d, new Date(), draftKey),
    }),
    [scan, draftKey],
  )
  const labels: StatementLabels = {
    leave: t('leave'),
    progress: t('progress'),
    position: (n, total) => t('position', { n, total }),
    options: { 1: t('options.1'), 2: t('options.2'), 3: t('options.3'), 4: t('options.4'), 5: t('options.5') },
    back: t('back'),
    next: t('next'),
    finish: t('finish'),
    footnote: t('onDevice'),
  }

  return (
    <StatementFlow
      items={items}
      draft={draft}
      leaveHref={leaveHref}
      onLeave={onLeave}
      onFinish={onFinish ?? (() => router.push(RESULT_PATH as Route))}
      labels={labels}
    />
  )
}
