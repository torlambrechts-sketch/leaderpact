'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/lp/Logo'
import { cn } from '@/lib/cn'
import { DATA_PROCESSING_PATH, LANDING_PATH, PRIVACY_PATH, PROFILE_PATH, SCAN_PATH, SIGN_IN_PATH } from '@/lib/routes'
import { ARTICLES_PATH, PILLAR_SLUG, articlePath } from '@/lib/site/articles'
import { TEMPLATES_PATH } from '@/lib/site/templates'
import { MobileMenu, PlatformMenu, type PlatformNav } from './PlatformMenu'

/** The product pages and the reading pages (D-38), in the order the footer lists them */
const PLATFORM_PATH = '/platform'
const RESEARCH_PATH = '/research'
const ANONYMITY_PATH = '/anonymity'
const TOOLS_PATH = '/leadership-team-assessment-tools'

/**
 * The public site's header (design, `r.public`): a --bar pill as wide as the site's frame (D-48: the design's
 * 1080 px left every page narrower or wider than its header), padding 10 by 10 by 14,
 * gap 24, with the public logo, the menu in the middle (14 px, --text-2; the current section in ink, 600)
 * and "Start the scan" (ink, radius 10, 9 by 14, 14 / 600, a 15 px arrow). It is not sticky.
 *
 * The menu is handoff 6.1's: Leadership Team Scan, Leader Profile and Sign in, without the design's
 * Research, Templates and For coaches (section 11). Leader Profile joined with its page (milestone 7), so
 * no link ever led nowhere (D-24). Sign in sits beside the button, where the design puts it
 * (14 px, --text-2). Below 768 px it folds away with the menu, leaving the logo, which also leads to the
 * landing page, and the button: the three do not fit in 360 px. The footer carries Sign in at every width.
 *
 * The Platform menu (D-47) replaces "How it works": a button that opens the platform's pages, the overview
 * among them. Under 768 px a menu button beside "Start the scan" opens the same pages and the header's links.
 */
export function PublicHeader({
  productName,
  labels,
  platform,
}: {
  productName: string
  labels: { menu: string; scan: string; profile: string; start: string; home: string; signIn: string; articles: string; open: string; close: string }
  platform: PlatformNav
}) {
  const path = usePathname()
  const inScan = path === LANDING_PATH || path === SCAN_PATH || path.startsWith(`${SCAN_PATH}/`)
  const inProfile = path === PROFILE_PATH || path.startsWith(`${PROFILE_PATH}/`)
  const inArticles = path === ARTICLES_PATH || path.startsWith(`${ARTICLES_PATH}/`)
  return (
    <header className="mx-auto max-w-site px-4 pt-3 md:px-gutter md:pt-5">
      <div className="relative flex w-full items-center gap-6 rounded-pill border border-bar bg-bar py-2.5 pl-3.5 pr-2.5 max-md:gap-2">
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
          <PlatformMenu nav={platform} />
          <Link
            href={ARTICLES_PATH as Route}
            aria-current={path === ARTICLES_PATH ? 'page' : undefined}
            className={cn('hidden lg:inline', inArticles ? 'font-semibold text-ink hover:text-ink' : 'text-text-2 hover:text-ink')}
          >
            {labels.articles}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-6 max-md:gap-2 md:ml-0">
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
          <MobileMenu
            nav={platform}
            labels={{ open: labels.open, close: labels.close }}
            links={[
              { href: LANDING_PATH, label: labels.scan },
              { href: PROFILE_PATH, label: labels.profile },
              { href: ARTICLES_PATH, label: labels.articles },
              { href: SIGN_IN_PATH, label: labels.signIn },
            ]}
          />
        </div>
      </div>
    </header>
  )
}

/**
 * The public footer: the product pages, the platform's features, the reading pages, and the account and legal
 * pages (handoff 6.1), each list under its name, beside a line on what the product is. It spans the site's frame
 * like the header (D-48). The header folds its menu away on phones, so the footer carries every page at every
 * width.
 */
export function PublicFooter({
  labels,
  platform,
  brand,
}: {
  /** the platform's feature pages (D-47), a list of their own */
  platform?: { label: string; links: { href: string; label: string }[] }
  /** the product's name and one line on what it is, at the footer's start (D-48) */
  brand?: { name: string; home: string; about: string }
  labels: {
    menu: string
    profile: string
    privacy: string
    dataProcessing: string
    signIn: string
    product?: string
    learn?: string
    scan?: string
    howItWorks?: string
    research?: string
    anonymity?: string
    tools?: string
    articles?: string
    /** the pillar article (D-67): one link to it from every public page */
    effectiveness?: string
    templates?: string
  }
}) {
  const link = 'text-text-2 hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:min-w-[44px] max-md:items-center'
  const id = React.useId()
  const product: [string | undefined, string][] = [
    [labels.scan, LANDING_PATH],
    [labels.howItWorks, PLATFORM_PATH],
    [labels.research, RESEARCH_PATH],
    [labels.anonymity, ANONYMITY_PATH],
    [labels.tools, TOOLS_PATH],
  ]
  const learn: [string | undefined, string][] = [
    [labels.effectiveness, articlePath(PILLAR_SLUG)],
    [labels.articles, ARTICLES_PATH],
    [labels.templates, TEMPLATES_PATH],
  ]
  const account: [string | undefined, string][] = [
    [labels.signIn, SIGN_IN_PATH],
    [labels.profile, PROFILE_PATH],
    [labels.privacy, PRIVACY_PATH],
    [labels.dataProcessing, DATA_PROCESSING_PATH],
  ]
  const columns: { key: string; title: string; items: [string | undefined, string][] }[] = [
    ...(labels.product && labels.scan ? [{ key: 'product', title: labels.product, items: product }] : []),
    ...(platform ? [{ key: 'platform', title: platform.label, items: platform.links.map((l): [string, string] => [l.label, l.href]) }] : []),
    ...(labels.learn && labels.articles ? [{ key: 'learn', title: labels.learn, items: learn }] : []),
    { key: 'account', title: labels.menu, items: account },
  ]
  return (
    <footer className="mx-auto max-w-site px-4 pb-10 pt-12 md:px-gutter md:pt-16">
      <div
        className={cn(
          'grid grid-cols-2 gap-x-8 gap-y-8 border-t border-bar pt-10 text-[13.5px] text-text-2 max-md:text-[15px]',
          brand ? 'lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]' : 'md:grid-cols-4',
        )}
      >
        {brand ? (
          <div className="col-span-2 flex flex-col gap-3 lg:col-span-1 lg:pr-10">
            <Link href={LANDING_PATH as Route} aria-label={brand.home} className="self-start hover:text-ink max-md:inline-flex max-md:min-h-[44px] max-md:items-center">
              <Logo name={brand.name} variant="public" />
            </Link>
            <p className="m-0 max-w-[380px] text-[14px] leading-[1.55] max-md:text-[15px]">{brand.about}</p>
          </div>
        ) : null}
        {columns.map((c) => (
          <nav key={c.key} aria-labelledby={`${id}-${c.key}`}>
            <p id={`${id}-${c.key}`} className="m-0 mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-ink">
              {c.title}
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {c.items.flatMap(([label, href]) =>
                label
                  ? [
                      <li key={href}>
                        <Link href={href as Route} className={link}>
                          {label}
                        </Link>
                      </li>,
                    ]
                  : [],
              )}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  )
}
