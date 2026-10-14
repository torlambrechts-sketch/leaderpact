'use client'
import * as React from 'react'
import { Link2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The invite link with its Copy button (design `invite` and Home): --surface-soft, a --border line, radius
 * 12, padding 8 by 8 by 16, the link at 14.5 / 600 and an ink button (radius 9, 9 by 14, 13 / 600). The link
 * is a read-only field, so it can also be selected and copied by hand where the clipboard is refused.
 */
export function CopyLink({
  link,
  id = 'invite-link',
  labels,
  compact = false,
}: {
  link: string
  id?: string
  labels: { field: string; copy: string; copied: string; failed: string }
  /** Home's card: 13.5 px text */
  compact?: boolean
}) {
  const [said, setSaid] = React.useState<'copied' | 'failed' | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setSaid('copied')
    } catch {
      setSaid('failed')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5 rounded-btn border border-line bg-surface-soft py-2 pl-4 pr-2">
        <Link2 aria-hidden size={17} className="shrink-0 text-ink" />
        <label htmlFor={id} className="sr-only">
          {labels.field}
        </label>
        <input
          id={id}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className={cn('min-w-0 flex-1 truncate bg-transparent font-semibold text-ink max-md:min-h-[44px]', compact ? 'text-[13.5px]' : 'text-[14.5px]')}
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-r9 bg-ink px-3.5 py-[9px] text-[13px] font-semibold text-white max-md:min-h-[44px]"
        >
          {said === 'copied' ? labels.copied : labels.copy}
        </button>
      </div>
      <p role="status" className="m-0 min-h-[1em] text-[12.5px] text-text-2 max-md:text-[15px]">
        {said === 'failed' ? labels.failed : null}
      </p>
    </div>
  )
}
