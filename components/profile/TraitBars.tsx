import * as React from 'react'
import { cn } from '@/lib/cn'
import type { Band } from '@/lib/profile/score'

export interface TraitView {
  key: string
  domain: string
  name: string
  band: Band
  /** 0 to 1 on the answer scale; omitted where only the band is known (a shared profile) */
  position?: number
}

export interface TraitLabels {
  bands: Record<Band, string>
  /** "{name}: {band}", what a screen reader hears for a row */
  words: (name: string, band: string) => string
  bandsLabel: string
  facetsOf: (domain: string) => string
}

/**
 * A Leader Profile's traits (handoff 6.17, design `me`): each domain on a track of three equal bands, lower,
 * middle and higher, with a dot where the person's mean sits and the band in words. The bands are neutral:
 * one fill, no colour for good or bad, since a trait is never either. The facets follow, grouped by domain,
 * as a word and a thin track. The track is decorative; the row's words carry everything.
 */
export function TraitBars({ domains, facets = [], labels, className }: { domains: TraitView[]; facets?: TraitView[]; labels: TraitLabels; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div aria-hidden className="hidden grid-cols-[180px_minmax(0,1fr)_76px] gap-4 text-[11px] font-bold uppercase tracking-[0.06em] text-muted md:grid">
        <span />
        <span className="grid grid-cols-3 text-center">
          <span>{labels.bands.lower}</span>
          <span>{labels.bands.middle}</span>
          <span>{labels.bands.higher}</span>
        </span>
        <span />
      </div>
      <ul className="m-0 flex list-none flex-col p-0" aria-label={labels.bandsLabel}>
        {domains.map((d) => (
          <li key={d.key} className="grid items-center gap-x-4 gap-y-2 border-t border-divider py-3.5 md:grid-cols-[180px_minmax(0,1fr)_76px]">
            <span className="sr-only">{labels.words(d.name, labels.bands[d.band])}</span>
            <span aria-hidden className="text-[15px] font-bold">{d.name}</span>
            <Track position={d.position} band={d.band} />
            <span aria-hidden className="text-[14px] font-bold md:text-right">{labels.bands[d.band]}</span>
          </li>
        ))}
      </ul>
      {facets.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {domains.map((d) => {
            const own = facets.filter((f) => f.domain === d.domain)
            if (own.length === 0) return null
            return (
              <section key={d.key} className="flex flex-col gap-2 rounded-option bg-surface-soft px-4 py-3.5">
                <h3 className="m-0 text-[13.5px] font-bold max-md:text-[15px]">{labels.facetsOf(d.name)}</h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {own.map((f) => (
                    <li key={f.key} className="flex flex-col gap-1">
                      <span className="sr-only">{labels.words(f.name, labels.bands[f.band])}</span>
                      <span aria-hidden className="flex justify-between gap-3 text-[13px] max-md:text-[15px]">
                        <span>{f.name}</span>
                        <span className="font-semibold">{labels.bands[f.band]}</span>
                      </span>
                      {f.position !== undefined && (
                        <span aria-hidden className="relative h-1 rounded-pill bg-track">
                          <span className="absolute top-1/2 h-3 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-pill bg-ink" style={{ left: `${f.position * 100}%` }} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Track({ position, band }: { position?: number; band: Band }) {
  return (
    <span aria-hidden className="relative grid h-7 grid-cols-3 gap-[3px]">
      {(['lower', 'middle', 'higher'] as const).map((b, i) => (
        <span key={b} className={cn('h-full bg-track', i === 0 && 'rounded-l-pill', i === 2 && 'rounded-r-pill', b === band && 'bg-hero')} />
      ))}
      {position !== undefined && (
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-ink" style={{ left: `${position * 100}%` }} />
      )}
    </span>
  )
}
