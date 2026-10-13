'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/lp/Logo'
import { cn } from '@/lib/cn'
import { DATA_PROCESSING_PATH, LANDING_PATH, PRIVACY_PATH, PROFILE_PATH, SCAN_PATH, SIGN_IN_PATH } from '@/lib/routes'

/**
 * The public site's header (design, `r.public`): a --bar pill up to 1080 px wide, padding 10 by 10 by 14,
 * gap 24, with the public logo, the menu in the middle (14 px, --text-2; the current section in ink, 600)
 * and "Start the scan" (ink, radius 10, 9 by 14, 14 / 600, a 15 px arrow). It is not sticky.
 *
 * The menu is handoff 6.1's: Leadership Team Scan, Leader Profile and Sign in, without the design's
 * Research, Templates and For coaches (section 11). Leader Profile joined with its page (milestone 7), so
 * no link ever led nowhere (D-24). Sign in sits beside the button, where the design puts it
 * (14 px, --text-2). Below 768 px it folds away with the menu, leaving the logo, which also leads to the
 * landing page, and the button: the three do not fit in 360 px. The footer carries Sign in at every width.
 */
export function PublicHeader({
  productName,
  labels,
}: {
  productName: string
  labels: { menu: string; scan: string; profile: string; start: string; home: string; signIn: string }
}) {
  const path = usePathname()
  const inScan = path === LANDING_PATH || path === SCAN_PATH || path.startsWith(`${SCAN_PATH}/`)
  const inProfile = path === PROFILE_PATH || path.startsWith(`${PROFILE_PATH}/`)
  return (
    <header className="flex justify-center px-4 pt-3 md:px-gutter md:pt-5">
      <div className="flex w-full max-w-[1080px] items-center gap-6 rounded-pill border border-bar bg-bar py-2.5 pl-3.5 pr-2.5">
        <Link href={LANDING_PATH as Route} aria-label={labels.home} className="shrink-0 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
          <Logo name={productName} variant="public" />
        </Link>
        <nav aria-label={labels.menu} className="hidden flex-1 justify-center gap-[26px] text-[14px] md:flex">
          <Link
            href={LANDING_PATH as Route}
            aria-current={path === LANDING_PATH ? 'page' : undefined}
            className={cn(inScan ? 'font-semibold text-ink hover:text-ink' : 'text-text-2 hover:text-ink')}
          >
            {labels.scan}
          </Link>
          <Link
            href={PROFILE_PATH as Route}
            aria-current={path === PROFILE_PATH ? 'page' : undefined}
            className={cn(inProfile ? 'font-semibold text-ink hover:text-ink' : 'text-text-2 hover:text-ink')}
          >
            {labels.profile}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-6 md:ml-0">
          <Link
            href={SIGN_IN_PATH as Route}
            aria-current={path === SIGN_IN_PATH ? 'page' : undefined}
            className={cn('hidden whitespace-nowrap text-[14px] hover:text-ink md:inline', path === SIGN_IN_PATH ? 'font-semibold text-ink' : 'text-text-2')}
          >
            {labels.signIn}
          </Link>
          <Link
            href={SCAN_PATH as Route}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-btn-sm bg-ink px-3.5 py-[9px] text-[14px] font-semibold text-white hover:text-white max-md:min-h-[44px]"
          >
            {labels.start}
            <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
      </div>
    </header>
  )
}

/**
 * The public footer: the privacy and data-processing pages (handoff 6.1), and Sign in and the Leader
 * Profile, which the header folds away on phones. The design draws none.
 */
export function PublicFooter({ labels }: { labels: { menu: string; profile: string; privacy: string; dataProcessing: string; signIn: string } }) {
  return (
    <footer className="mx-auto max-w-landing px-4 pb-10 pt-12 md:px-gutter md:pt-16">
      <nav aria-label={labels.menu} className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-text-2 max-md:text-[15px]">
        <Link href={SIGN_IN_PATH as Route} className="text-text-2 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
          {labels.signIn}
        </Link>
        <Link href={PROFILE_PATH as Route} className="text-text-2 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
          {labels.profile}
        </Link>
        <Link href={PRIVACY_PATH as Route} className="text-text-2 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
          {labels.privacy}
        </Link>
        <Link href={DATA_PROCESSING_PATH as Route} className="text-text-2 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
          {labels.dataProcessing}
        </Link>
      </nav>
    </footer>
  )
}
