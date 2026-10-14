import * as React from 'react'
import { Building2, Check, UserRound, UsersRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import type { Block } from '@/lib/site/blocks'
import { shotById } from '@/lib/site/shots'
import { Rich } from './Rich'

/**
 * The product pages' pictures and the value they describe (D-46). A screenshot is the real app, taken by
 * scripts/shots/capture.mjs from a fictional demo group, so every one carries the "Sample data" mark and a
 * note that the names and answers are invented (CLAUDE.md: sample content is always marked Sample). The
 * picture's description is its `alt`; the frame around it is drawing only.
 */
type Of<T extends Block['t']> = Extract<Block, { t: T }>

/** A screenshot in its frame: a browser window for the desktop, a phone for the phone */
export function ShotFrame({ id, alt, className, priority = false }: { id: string; alt: string; className?: string; priority?: boolean }) {
  const t = useTranslations('site.shots')
  const shot = shotById(id)
  if (!shot) return null
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed-size WebP from public/, sized by its manifest
    <img
      src={shot.file}
      width={shot.width}
      height={shot.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className="block h-auto w-full"
    />
  )
  const mark = (
    <span className="absolute right-3 top-3 z-[1] inline-flex h-6 items-center rounded-chip bg-pending-bg px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-pending-ink shadow-sm">
      {t('sample')}
    </span>
  )
  if (shot.device === 'phone')
    return (
      <div className={cn('relative mx-auto w-full max-w-[300px] rounded-[38px] border-[9px] border-ink bg-ink shadow-[0_30px_60px_-30px_rgba(17,17,17,0.55)]', className)}>
        <span aria-hidden className="absolute left-1/2 top-1.5 z-[1] h-[18px] w-[86px] -translate-x-1/2 rounded-pill bg-ink" />
        <div className="relative overflow-hidden rounded-[29px] bg-bg">
          {mark}
          {img}
        </div>
      </div>
    )
  return (
    <div className={cn('relative overflow-hidden rounded-card-lg border border-bar bg-surface shadow-[0_30px_60px_-34px_rgba(17,17,17,0.45)]', className)}>
      <div aria-hidden className="flex h-9 items-center gap-1.5 border-b border-bar bg-surface-sunk px-4">
        <span className="h-2.5 w-2.5 rounded-pill bg-line-dashed" />
        <span className="h-2.5 w-2.5 rounded-pill bg-line-dashed" />
        <span className="h-2.5 w-2.5 rounded-pill bg-line-dashed" />
        <span className="ml-3 h-5 flex-1 rounded-pill bg-white/80" />
      </div>
      <div className="relative">
        {mark}
        {/* a desktop picture is smaller than the screen it shows: the link opens it at full size */}
        <a href={shot.file} target="_blank" rel="noopener" className="block cursor-zoom-in" aria-label={t('enlarge', { alt })}>
          {img}
        </a>
      </div>
    </div>
  )
}

/** The note under every screenshot: what the picture shows, and that its group is invented */
function ShotCaption({ caption }: { caption?: string }) {
  const t = useTranslations('site.shots')
  return (
    <figcaption className="m-0 text-[13.5px] leading-[1.55] text-text-2 max-md:text-[14px]">
      {caption ? (
        <>
          <Rich text={caption} />{' '}
        </>
      ) : null}
      <span className="text-text-3">{t('note')}</span>
    </figcaption>
  )
}

export function ShotBlock({ b }: { b: Of<'shot'> }) {
  const shot = shotById(b.id)
  return (
    <figure className={cn('m-0 my-2 flex flex-col gap-3', shot?.device === 'phone' ? 'items-center text-center' : '')}>
      <ShotFrame id={b.id} alt={b.alt} />
      <ShotCaption caption={b.caption} />
    </figure>
  )
}

/** A feature beside its screenshot. Rows alternate sides on a wide screen; on a phone the words come first. */
export function FeatureRow({ b, flip }: { b: Of<'feature'>; flip: boolean }) {
  const shot = shotById(b.shot)
  const phone = shot?.device === 'phone'
  return (
    <section
      className={cn(
        'my-4 grid items-center gap-8 md:gap-12',
        phone
          ? flip
            ? 'md:grid-cols-[320px_minmax(0,1fr)]'
            : 'md:grid-cols-[minmax(0,1fr)_320px]'
          : flip
            ? 'lg:grid-cols-[minmax(0,8fr)_minmax(0,5fr)]'
            : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]',
      )}
    >
      <div className={cn('flex min-w-0 flex-col gap-3', flip ? (phone ? 'md:order-last' : 'lg:order-last') : '')}>
        <h3 className="m-0 font-display text-[24px] font-medium leading-[1.2] tracking-[-0.02em] text-ink max-md:text-[21px]">
          <Rich text={b.title} />
        </h3>
        <p className="m-0 text-[17px] leading-[1.65] text-text-body" style={{ textWrap: 'pretty' }}>
          <Rich text={b.text} />
        </p>
        {b.points?.length ? (
          <ul className="m-0 mt-1 flex list-none flex-col gap-2.5 p-0">
            {b.points.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[15.5px] leading-[1.55] text-text-body">
                <span aria-hidden className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-pill bg-ok-bg text-ok-ink">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span>
                  <Rich text={p} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <figure className="m-0 flex min-w-0 flex-col gap-3">
        <ShotFrame id={b.shot} alt={b.alt} />
        <ShotCaption caption={b.caption} />
      </figure>
    </section>
  )
}

const WHO = {
  you: { icon: UserRound, fill: 'bg-accent' },
  group: { icon: UsersRound, fill: 'bg-step-teal' },
  organisation: { icon: Building2, fill: 'bg-step-yellow' },
} as const

/** What a feature brings: to the person, to the leadership group, to the organisation */
export function Value({ b }: { b: Of<'value'> }) {
  const t = useTranslations('site.value')
  return (
    <ul className="m-0 my-2 grid list-none gap-4 p-0 md:grid-cols-3">
      {b.items.map((item) => {
        const { icon: Icon, fill } = WHO[item.who]
        return (
          <li key={item.who} className={cn('flex flex-col gap-3 rounded-card-lg px-6 py-6', fill)}>
            <span className="inline-flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-[0.08em] text-text-3">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-pill bg-white text-ink">
                <Icon size={16} />
              </span>
              {t(item.who)}
            </span>
            <p className="m-0 font-display text-[20px] font-medium leading-[1.25] tracking-[-0.01em] text-ink">
              <Rich text={item.title} />
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {item.points.map((p, i) => (
                <li key={i} className="flex gap-2 text-[15px] leading-[1.55] text-text-body">
                  <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-pill bg-ink" />
                  <span>
                    <Rich text={p} />
                  </span>
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}
