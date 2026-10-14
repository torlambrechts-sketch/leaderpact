'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { Activity, BarChart3, BookOpen, CalendarClock, ChevronDown, ClipboardCheck, Kanban, ListChecks, Menu, Route as RouteIcon, ScrollText, ShieldCheck, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The Platform menu and the phone's menu (D-47). A disclosure, not an application menu: a button that shows
 * and hides a list of links, which Tab moves through like any other links (WAI-ARIA's disclosure navigation).
 * It closes on Escape, which returns focus to its button, on a click outside, when focus leaves it, and when
 * the page changes. The panel exists only while it is open.
 */
const ICONS = {
  scan: ClipboardCheck,
  team: BarChart3,
  profile: UserRound,
  charter: ScrollText,
  diagnostic: ListChecks,
  plan: Kanban,
  // the app's own icons for its Meetings tab and for a pulse
  meetings: CalendarClock,
  pulses: Activity,
  overview: RouteIcon,
  anonymity: ShieldCheck,
  research: BookOpen,
} as const
export type MenuIcon = keyof typeof ICONS

export type MenuItem = { href: string; label: string; text: string; icon: MenuIcon }
export type PlatformNav = {
  label: string
  featuresTitle: string
  aboutTitle: string
  features: MenuItem[]
  about: MenuItem[]
}

/** Open and close, with the rules above: Escape, a click outside, focus leaving, a new page */
function useDisclosure() {
  const [open, setOpen] = React.useState(false)
  const box = React.useRef<HTMLDivElement>(null)
  const button = React.useRef<HTMLButtonElement>(null)
  const path = usePathname()
  React.useEffect(() => setOpen(false), [path])
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])
  const onBlur = (e: React.FocusEvent) => {
    if (e.relatedTarget && !box.current?.contains(e.relatedTarget as Node)) setOpen(false)
  }
  return { open, setOpen, box, button, onBlur }
}

function ItemLink({ item, current }: { item: MenuItem; current: boolean }) {
  const Icon = ICONS[item.icon]
  return (
    <Link
      href={item.href as Route}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex items-start gap-3 rounded-option px-3 py-2.5 text-ink no-underline hover:bg-surface-sunk hover:text-ink',
        current ? 'bg-surface-sunk' : '',
      )}
    >
      <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-icon-tile bg-accent text-accent-ink">
        <Icon size={16} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14.5px] font-semibold leading-[1.3]">{item.label}</span>
        <span className="text-[13px] leading-[1.45] text-text-2 max-md:text-[14px]">{item.text}</span>
      </span>
    </Link>
  )
}

function Lists({ nav, path }: { nav: PlatformNav; path: string }) {
  return (
    <div className="grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div>
        <p className="m-0 px-3 pb-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-text-2">{nav.featuresTitle}</p>
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {nav.features.map((item) => (
            <li key={item.href}>
              <ItemLink item={item} current={path === item.href} />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="m-0 px-3 pb-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-text-2">{nav.aboutTitle}</p>
        <ul className="m-0 grid list-none gap-0.5 p-0">
          {nav.about.map((item) => (
            <li key={item.href}>
              <ItemLink item={item} current={path === item.href} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The header's Platform button and its panel, from 768 px; the panel spans the header's pill */
export function PlatformMenu({ nav }: { nav: PlatformNav }) {
  const { open, setOpen, box, button, onBlur } = useDisclosure()
  const path = usePathname()
  const id = React.useId()
  const inside = [...nav.features, ...nav.about].some((i) => path === i.href)
  return (
    <div ref={box} onBlur={onBlur}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn('inline-flex items-center gap-1 bg-transparent p-0 text-[14px]', inside || open ? 'font-semibold text-ink' : 'text-text-2 hover:text-ink')}
      >
        {nav.label}
        <ChevronDown aria-hidden size={15} className={cn('transition-transform motion-reduce:transition-none', open ? 'rotate-180' : '')} />
      </button>
      {open ? (
        <div
          id={id}
          className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-card-lg border border-bar bg-surface p-4 shadow-[0_30px_60px_-30px_rgba(17,17,17,0.45)]"
        >
          <Lists nav={nav} path={path} />
        </div>
      ) : null}
    </div>
  )
}

/** The phone's menu, under 768 px: the header's links and the Platform pages, which the header has no room for */
export function MobileMenu({
  nav,
  links,
  labels,
}: {
  nav: PlatformNav
  links: { href: string; label: string }[]
  labels: { open: string; close: string }
}) {
  const { open, setOpen, box, button, onBlur } = useDisclosure()
  const path = usePathname()
  const id = React.useId()
  return (
    <div ref={box} onBlur={onBlur} className="md:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-[44px] w-[44px] items-center justify-center rounded-btn-sm border border-line-strong bg-surface text-ink"
      >
        {open ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
      </button>
      {open ? (
        <div id={id} className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[calc(100vh-96px)] overflow-y-auto rounded-card-lg border border-bar bg-surface p-3 shadow-[0_30px_60px_-30px_rgba(17,17,17,0.45)]">
          <ul className="m-0 mb-3 grid list-none gap-0.5 border-b border-rule-softer p-0 pb-3">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href as Route}
                  aria-current={path === l.href ? 'page' : undefined}
                  className="flex min-h-[44px] items-center rounded-option px-3 text-[16px] font-semibold text-ink no-underline hover:bg-surface-sunk hover:text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Lists nav={nav} path={path} />
        </div>
      ) : null}
    </div>
  )
}
