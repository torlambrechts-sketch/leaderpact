'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ListChecks, Link2 } from 'lucide-react'
import { Card } from '@/components/lp/Card'
import { ListRow } from '@/components/lp/ListRow'
import { SectionHeader } from '@/components/lp/SectionHeader'
import { buttonVariants } from '@/components/ui/button'
import { readReplaceKey } from '@/lib/scan/device'
import { deviceStore } from '@/lib/scan/draft'
import { joinPath } from '@/lib/routes'

export interface NeedsYouLabels {
  title: string
  /** "# things need you", for 0, 1 and 2 rows */
  counts: readonly string[]
  empty: string
  kindScan: string
  answerTitle: string
  answerMeta: string
  answerAction: string
  shareTitle: string
  shareMeta: string
  shareAction: string
  shareCopied: string
  shareFailed: string
}

/**
 * Home's "Needs you" on the Free plan (handoff 6.7): answer the scan and share the link, while the scan is
 * open. Whether this person has answered is known only to their device, by the replace key the link left
 * there (C2): nothing on the server says who answered. A person who answered on another device sees the
 * row; the link's page then says the answers are in. The Leader Profile's row comes with milestone 7.
 */
export function NeedsYou({ code, link, labels }: { code: string | null; link: string | null; labels: NeedsYouLabels }) {
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
