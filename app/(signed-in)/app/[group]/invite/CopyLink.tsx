'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Link2 } from 'lucide-react'

/**
 * The invite link with its Copy button (design `invite`): --surface-soft, a --border line, radius 12,
 * padding 8 by 8 by 16, the link at 14.5 / 600 and an ink button (radius 9, 9 by 14, 13 / 600). The link is
 * a read-only field, so it can also be selected and copied by hand where the clipboard is refused.
 */
export function CopyLink({ link }: { link: string }) {
  const t = useTranslations('invite')
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
        <label htmlFor="invite-link" className="sr-only">
          {t('linkLabel')}
        </label>
        <input
          id="invite-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate bg-transparent text-[14.5px] font-semibold text-ink"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-r9 bg-ink px-3.5 py-[9px] text-[13px] font-semibold text-white max-md:min-h-[44px]"
        >
          {said === 'copied' ? t('copied') : t('copy')}
        </button>
      </div>
      <p role="status" className="m-0 min-h-[1em] text-[12.5px] text-text-2 max-md:text-[15px]">
        {said === 'failed' ? t('copyFailed') : null}
      </p>
    </div>
  )
}
