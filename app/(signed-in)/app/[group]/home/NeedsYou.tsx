'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ClipboardList, ListChecks, Link2, SquareCheck, UserRound } from 'lucide-react'
import { Card } from '@/components/lp/Card'
import { ListRow } from '@/components/lp/ListRow'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { buttonVariants } from '@/components/ui/button'
import { readReplaceKey } from '@/lib/scan/device'
import { deviceStore } from '@/lib/scan/draft'
import { joinPath } from '@/lib/routes'

export interface NeedsYouLabels {
  title: string
  /** "# things need you", for 0 to 5 rows */
  counts: readonly string[]
  empty: string
  kindRound: string
  roundTitle: string
  roundMeta: string
  roundAction: string
  kindAction: string
  actionsTitle: string
  actionsMeta: string
  actionsAction: string
  kindScan: string
  answerTitle: string
  answerMeta: string
  answerAction: string
  shareTitle: string
  shareMeta: string
  shareAction: string
  shareCopied: string
  shareFailed: string
  kindProfile: string
  profileTitle: string
  profileMeta: string
  profileAction: string
}

/**
 * Home's "Needs you" (handoff 6.7): answer the Full diagnostic while a round asks this person and they have
 * yet to answer (milestone 10; their own state, from the server), their own open actions (milestone 12; a
 * count for them alone, never for anyone else), answer the scan and share the link, while
 * the scan is open, and take the Leader Profile while the person has none (milestone 7). Whether this person has
 * answered the scan is known only to their device, by the replace key the link left there (C2): nothing
 * on the server says who answered. A person who answered on another device sees the row; the link's page
 * then says the answers are in.
 */
export function NeedsYou({
  roundHref,
  actionsHref,
  code,
  link,
  profileHref,
  labels,
}: {
  roundHref: string | null
  actionsHref: string | null
  code: string | null
  link: string | null
  profileHref: string | null
  labels: NeedsYouLabels
}) {
  const answered = React.useSyncExternalStore(subscribeStorage, () => (code ? readReplaceKey(deviceStore(), code) !== null : true), () => null)
  const [said, setSaid] = React.useState<'copied' | 'failed' | null>(null)

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setSaid('copied')
    } catch {
      setSaid('failed')
    }
  }

  const rows: React.ReactNode[] = []
  if (roundHref) {
    rows.push(
      <ListRow
        key="round"
        icon={ClipboardList}
        kind={labels.kindRound}
        title={labels.roundTitle}
        meta={labels.roundMeta}
        action={
          <Link href={roundHref as Route} className={buttonVariants({ size: 'xsmall' })}>
            {labels.roundAction}
          </Link>
        }
      />,
    )
  }
  if (actionsHref) {
    rows.push(
      <ListRow
        key="actions"
        icon={SquareCheck}
        kind={labels.kindAction}
        kindTone="other"
        title={labels.actionsTitle}
        meta={labels.actionsMeta}
        action={
          <Link href={actionsHref as Route} className={buttonVariants({ size: 'xsmall' })}>
            {labels.actionsAction}
          </Link>
        }
      />,
    )
  }
  if (code && answered === false) {
    rows.push(
      <ListRow
        key="answer"
        icon={ListChecks}
        kind={labels.kindScan}
        title={labels.answerTitle}
        meta={labels.answerMeta}
        action={
          <Link href={joinPath(code) as Route} className={buttonVariants({ size: 'xsmall' })}>
            {labels.answerAction}
          </Link>
        }
      />,
    )
  }
  if (link) {
    rows.push(
      <ListRow
        key="share"
        icon={Link2}
        kind={labels.kindScan}
        title={labels.shareTitle}
        meta={said === 'failed' ? labels.shareFailed : labels.shareMeta}
        action={
          <button type="button" onClick={copy} className={buttonVariants({ size: 'xsmall' })}>
            {said === 'copied' ? labels.shareCopied : labels.shareAction}
          </button>
        }
      />,
    )
  }

  if (profileHref) {
    rows.push(
      <ListRow
        key="profile"
        icon={UserRound}
        kind={labels.kindProfile}
        kindTone="other"
        title={labels.profileTitle}
        meta={labels.profileMeta}
        action={
          <Link href={profileHref as Route} className={buttonVariants({ size: 'xsmall' })}>
            {labels.profileAction}
          </Link>
        }
      />,
    )
  }

  return (
    <Card large>
      <SectionHeader title={labels.title} count={rows.length || undefined} countLabel={labels.counts[rows.length]} />
      {rows.length ? <ul className="m-0 list-none p-0">{rows}</ul> : <p className="m-0 border-t border-divider pt-3 text-[14px] text-text-2 max-md:text-[15px]">{labels.empty}</p>}
      <p role="status" className="sr-only">
        {said === 'copied' ? labels.shareCopied : said === 'failed' ? labels.shareFailed : ''}
      </p>
    </Card>
  )
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}
