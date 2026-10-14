// After Orgpuls components/marketing/Diagrams.tsx @ d9b1c52 (its D-237): LeaderPact's own figures, in its own tokens.
import * as React from 'react'
import { ArrowDown, ArrowLeftRight, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { shortCite, type Basis, type Block, type Source } from '@/lib/site/blocks'
import { Rich } from './Rich'

/**
 * The figures (D-41): an article's argument drawn, not only written. Each takes its words from the block, so
 * a figure keeps the copy rules and a new one is data. The drawing is CSS in the site's tokens; every word a
 * figure shows is real text, and where a drawing repeats it (the cycle, the rings, the time bar) the drawing is
 * hidden from screen readers. Under 768 px a figure becomes a single column, so nothing is cut at the edge.
 *
 * A figure that rests on a source cites it under the drawing, linked to the numbered list at the article's foot.
 * A chart's numbers always say where they come from: a source, arithmetic written out, or an example (D-41).
 */

type Of<T extends Block['t']> = Extract<Block, { t: T }>

/** The tinted fills a figure's parts cycle through, ink on each at well over 4.5:1 */
const FILLS = ['bg-accent', 'bg-step-teal', 'bg-step-yellow', 'bg-hero', 'bg-accent-mid'] as const
const fill = (i: number) => FILLS[i % FILLS.length]
/** the time bar's kinds: four fills a reader can tell apart, with a swatch beside every label */
const KIND_FILLS = ['bg-accent', 'bg-step-teal', 'bg-step-yellow', 'bg-hero'] as const

const title = 'm-0 text-[16.5px] font-bold leading-[1.35] text-ink max-md:text-[16px]'
const small = 'm-0 text-[15px] leading-[1.6] text-text-body'

function Figure({ children, foot, className, label }: { children: React.ReactNode; foot?: React.ReactNode; className?: string; label?: string }) {
  return (
    <figure aria-label={label} className={cn('m-0 my-2 flex flex-col gap-3', className)}>
      {children}
      {foot ? <figcaption className="m-0 text-[13px] leading-[1.5] text-text-2 max-md:text-[14px]">{foot}</figcaption> : null}
    </figure>
  )
}

/** "Source: De Jong et al. (2016)", linked to the source in the list at the foot of the article */
function Cite({ n, sources }: { n?: number; sources: readonly Source[] }) {
  const t = useTranslations('site.figures')
  const s = n ? sources[n - 1] : undefined
  if (!n || !s) return null
  return (
    <>
      {t('source')}{' '}
      <a href={`#source-${n}`} className="text-text-2 underline decoration-1 underline-offset-2 hover:text-ink">
        {shortCite(s)}
      </a>
    </>
  )
}

/** Where a chart's numbers come from, said under it */
function BasisLine({ basis, sources }: { basis: Basis; sources: readonly Source[] }) {
  const t = useTranslations('site.figures')
  if ('source' in basis) return <Cite n={basis.source} sources={sources} />
  if ('arithmetic' in basis)
    return (
      <>
        <strong className="font-semibold">{t('arithmetic')}</strong> <Rich text={basis.arithmetic} />
      </>
    )
  return <>{t('exampleNote')}</>
}

/** The chip that marks an example or a sample: never data about a real team */
function Mark({ kind }: { kind: 'example' | 'sample' }) {
  const t = useTranslations('site.figures')
  return <span className="inline-flex h-6 items-center rounded-chip bg-pending-bg px-2 text-[11.5px] font-bold uppercase tracking-[0.06em] text-pending-ink">{t(kind)}</span>
}

export function Steps({ b }: { b: Of<'steps'> }) {
  return (
    <Figure>
      <ol className="relative m-0 flex list-none flex-col gap-3 p-0">
        <span aria-hidden className="absolute bottom-7 left-[17px] top-7 w-[2px] bg-line-dashed" />
        {b.items.map((s, i) => (
          <li key={i} className="relative grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4 max-md:gap-3">
            <span className={cn('relative mt-3 flex h-9 w-9 items-center justify-center rounded-pill border-2 border-ink text-[14px] font-bold text-ink', fill(i))}>
              {i + 1}
            </span>
            <div className="flex flex-col gap-1 rounded-card border border-bar bg-surface px-5 py-4 max-md:px-4">
              <p className={title}>
                <Rich text={s.title} />
              </p>
              {s.text ? (
                <p className={cn(small, 'text-text-2')}>
                  <Rich text={s.text} />
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Figure>
  )
}

export function Flow({ b, sources }: { b: Of<'flow'>; sources: readonly Source[] }) {
  const n = b.items.length
  return (
    <Figure foot={b.source ? <Cite n={b.source} sources={sources} /> : null}>
      <ol className="m-0 flex list-none flex-col gap-3 p-0 md:flex-row md:gap-4">
        {b.items.map((s, i) => (
          <li key={i} className={cn('relative flex flex-1 flex-col gap-1.5 rounded-card px-5 py-4', fill(i))}>
            <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-3">{i + 1}</span>
            <p className={title}>
              <Rich text={s.title} />
            </p>
            <p className={cn(small, 'text-[14.5px]')}>
              <Rich text={s.text} />
            </p>
            {i < n - 1 ? (
              <span
                aria-hidden
                className="absolute -bottom-[18px] left-1/2 z-[1] flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-pill border-2 border-bg bg-ink text-white md:-right-[22px] md:bottom-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:translate-x-0"
              >
                <ArrowDown size={15} className="md:hidden" />
                <ArrowRight size={15} className="max-md:hidden" />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {b.axis ? (
        <p className="m-0 flex items-center gap-3 text-[13.5px] font-semibold text-text-2 max-md:order-first max-md:text-[14px]">
          <span>
            <Rich text={b.axis.from} />
          </span>
          <span aria-hidden className="relative h-[3px] flex-1 rounded-pill bg-gradient-to-r from-accent to-accent-strong">
            <span className="absolute -right-1 -top-[5px] h-0 w-0 border-y-[6.5px] border-l-[9px] border-y-transparent border-l-accent-strong" />
          </span>
          <span>
            <Rich text={b.axis.to} />
          </span>
        </p>
      ) : null}
    </Figure>
  )
}

/**
 * Levels resting on each other. The list reads base first, as the model numbers them; the drawing puts the base at
 * the bottom. Wide, each level's band stands beside its words. On a phone the words would stretch the bands into
 * needles, so a small drawing of the whole sits above a numbered list, and the drawing is hidden from screen readers.
 */
export function Pyramid({ b, sources }: { b: Of<'pyramid'>; sources: readonly Source[] }) {
  const n = b.items.length
  // the base is the full width of its column, the top level 40 per cent of it
  const width = (i: number) => 100 - (60 / Math.max(1, n - 1)) * i
  const shape = (i: number) => (i === n - 1 ? 'polygon(50% 0, 50% 0, 100% 100%, 0 100%)' : 'polygon(12% 0, 88% 0, 100% 100%, 0 100%)')
  return (
    <Figure foot={b.source ? <Cite n={b.source} sources={sources} /> : null}>
      <div aria-hidden className="mx-auto flex w-full max-w-[300px] flex-col-reverse gap-1 md:hidden">
        {b.items.map((_, i) => (
          <span key={i} className={cn('mx-auto flex h-10 items-end justify-center pb-1.5 text-[15px] font-bold text-ink', fill(i))} style={{ width: `${width(i)}%`, clipPath: shape(i) }}>
            {i + 1}
          </span>
        ))}
      </div>
      <ol className="m-0 flex list-none flex-col-reverse gap-1.5 p-0 max-md:gap-3">
        {b.items.map((s, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-center gap-5 max-md:grid-cols-[30px_minmax(0,1fr)] max-md:items-start max-md:gap-3">
            <span className="flex justify-center self-stretch max-md:hidden">
              <span
                className={cn('flex h-full min-h-[64px] items-center justify-center text-[18px] font-bold text-ink', fill(i))}
                style={{ width: `${width(i)}%`, clipPath: shape(i) }}
              >
                <span className={i === n - 1 ? 'mt-5' : undefined}>{i + 1}</span>
              </span>
            </span>
            <span className={cn('flex h-[30px] w-[30px] items-center justify-center rounded-pill border-2 border-ink text-[13px] font-bold text-ink md:hidden', fill(i))}>{i + 1}</span>
            <div className="flex flex-col gap-0.5 py-1.5 max-md:py-0.5">
              <p className={title}>
                <Rich text={s.title} />
              </p>
              <p className={cn(small, 'text-text-2')}>
                <Rich text={s.text} />
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Figure>
  )
}

export function Pillars({ b, sources }: { b: Of<'pillars'>; sources: readonly Source[] }) {
  const n = b.items.length
  return (
    <Figure foot={b.source ? <Cite n={b.source} sources={sources} /> : null}>
      <div className="flex flex-col">
        <div className="relative rounded-t-[28px] bg-ink px-6 pb-5 pt-6 text-center text-white max-md:px-5">
          <p className="m-0 font-display text-[21px] font-medium tracking-[-0.01em]">
            <Rich text={b.roof.title} />
          </p>
          <p className="m-0 mx-auto mt-1.5 max-w-[56ch] text-[15px] leading-[1.6] text-white/85">
            <Rich text={b.roof.text} />
          </p>
        </div>
        <ul className={cn('m-0 grid list-none gap-3 bg-surface-sunk px-3 py-3 max-md:grid-cols-1', n === 2 ? 'md:grid-cols-2' : n === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4')}>
          {b.items.map((s, i) => (
            <li key={i} className={cn('flex flex-col gap-1.5 rounded-[10px] border-x-[6px] border-white/70 px-5 py-5 md:min-h-[170px]', fill(i))}>
              <p className={title}>
                <Rich text={s.title} />
              </p>
              <p className={cn(small, 'text-[14.5px]')}>
                <Rich text={s.text} />
              </p>
            </li>
          ))}
        </ul>
        <span aria-hidden className="h-3 rounded-b-[10px] bg-ink" />
      </div>
    </Figure>
  )
}

export function Matrix({ b, sources }: { b: Of<'matrix'>; sources: readonly Source[] }) {
  // reading order: top left, top right, bottom left, bottom right; top is high on y, right is high on x
  const where = [
    [b.x.low, b.y.high],
    [b.x.high, b.y.high],
    [b.x.low, b.y.low],
    [b.x.high, b.y.low],
  ] as const
  const fills = ['bg-hero', 'bg-accent', 'bg-surface-sunk', 'bg-step-teal']
  return (
    <Figure foot={b.source ? <Cite n={b.source} sources={sources} /> : null}>
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-2 max-md:grid-cols-[22px_minmax(0,1fr)] max-md:gap-x-2">
        <p
          className="m-0 flex items-center justify-between text-[12.5px] font-bold uppercase tracking-[0.06em] text-text-2 [writing-mode:vertical-rl] max-md:text-[12px]"
          style={{ transform: 'rotate(180deg)' }}
        >
          <span>
            <Rich text={b.y.low} />
          </span>
          <span className="text-ink">
            <Rich text={b.y.label} />
          </span>
          <span>
            <Rich text={b.y.high} />
          </span>
        </p>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
          {b.cells.map((c, i) => (
            <li key={i} className={cn('flex min-h-[150px] flex-col gap-1.5 rounded-card px-5 py-4 max-md:min-h-0 max-md:px-3 max-md:py-3', fills[i], b.focus === i ? 'ring-2 ring-ink' : '')}>
              <span className="sr-only">{`${where[i]![0]}, ${where[i]![1]}: `}</span>
              <p className={cn(title, 'max-md:text-[15px]')}>
                <Rich text={c.title} />
              </p>
              <p className={cn(small, 'text-[14.5px] max-md:text-[14px]')}>
                <Rich text={c.text} />
              </p>
            </li>
          ))}
        </ul>
        <span aria-hidden />
        <p className="m-0 flex items-center justify-between gap-2 text-[12.5px] font-bold uppercase tracking-[0.06em] text-text-2 max-md:text-[12px]">
          <span>
            <Rich text={b.x.low} />
          </span>
          <span className="text-center text-ink">
            <Rich text={b.x.label} />
          </span>
          <span className="text-right">
            <Rich text={b.x.high} />
          </span>
        </p>
      </div>
    </Figure>
  )
}

export function Compare({ b, sources }: { b: Of<'compare'>; sources: readonly Source[] }) {
  return (
    <Figure foot={b.source ? <Cite n={b.source} sources={sources} /> : null}>
      <div className="relative grid gap-3 md:grid-cols-2 md:gap-5">
        {b.items.map((side, i) => (
          <section key={i} className="flex flex-col overflow-hidden rounded-card border border-bar bg-surface">
            <h3 className={cn('m-0 px-5 py-3.5 font-display text-[18px] font-medium tracking-[-0.01em] text-ink', i === 0 ? 'bg-accent' : 'bg-step-teal')}>
              <Rich text={side.title} />
            </h3>
            <ul className="m-0 flex list-none flex-col gap-2.5 px-5 py-4">
              {side.points.map((p, j) => (
                <li key={j} className={cn(small, 'flex gap-2.5')}>
                  <span aria-hidden className={cn('mt-[9px] h-2 w-2 shrink-0 rounded-pill', i === 0 ? 'bg-accent-strong' : 'bg-ink')} />
                  <span>
                    <Rich text={p} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <span
          aria-hidden
          className="absolute left-1/2 top-[26px] hidden h-10 w-10 -translate-x-1/2 items-center justify-center rounded-pill border-4 border-bg bg-ink text-white md:flex"
        >
          <ArrowLeftRight size={16} />
        </span>
      </div>
    </Figure>
  )
}

export function Fork({ b, sources }: { b: Of<'fork'>; sources: readonly Source[] }) {
  const tones = ['bg-step-teal', 'bg-hero']
  return (
    <Figure foot={b.source ? <Cite n={b.source} sources={sources} /> : null}>
      <div className="flex flex-col items-center">
        <div className="w-full max-w-[460px] rounded-card bg-ink px-6 py-4 text-center text-white">
          <p className="m-0 font-display text-[19px] font-medium">
            <Rich text={b.from.title} />
          </p>
          <p className="m-0 mt-1 text-[15px] leading-[1.55] text-white/85">
            <Rich text={b.from.text} />
          </p>
        </div>
        <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="hidden h-[44px] w-full md:block">
          <path d="M50 0 V16 M25 16 H75 M25 16 V40 M75 16 V40" fill="none" stroke="#111111" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <span aria-hidden className="h-5 w-[2px] bg-ink md:hidden" />
        <ul className="m-0 grid w-full list-none gap-3 p-0 md:grid-cols-2 md:gap-5">
          {b.items.map((it, i) => (
            <li key={i} className={cn('flex flex-col gap-2 rounded-card px-5 py-4', tones[i])}>
              <span className="inline-flex w-fit items-center rounded-pill bg-white px-3 py-1 text-[12.5px] font-bold text-ink max-md:text-[13px]">
                <Rich text={it.when} />
              </span>
              <p className={title}>
                <Rich text={it.title} />
              </p>
              <p className={cn(small, 'text-[14.5px]')}>
                <Rich text={it.text} />
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Figure>
  )
}

/** Circles inside each other: the drawing on the left repeats the list, so only the list is read aloud */
export function Rings({ b }: { b: Of<'rings'> }) {
  const n = b.items.length
  const ringFills = ['bg-ink', 'bg-accent', 'bg-hero']
  const swatch = ['bg-ink', 'bg-accent', 'bg-hero']
  return (
    <Figure>
      <div className="grid items-center gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <div aria-hidden className="relative mx-auto aspect-square w-[220px] md:w-[260px]">
          {b.items
            .map((s, i) => ({ s, i }))
            .reverse()
            .map(({ s, i }) => {
              // the outermost circle fills the drawing, each one inside it a step smaller
              const size = 100 - (n - 1 - i) * (n === 3 ? 31 : 45)
              return (
                <span
                  key={i}
                  className={cn('absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 justify-center', ringFills[i], i === 0 ? 'items-center' : 'items-start')}
                  style={{ width: `${size}%`, height: `${size}%`, borderRadius: '50%' }}
                >
                  <span className={cn('px-2 text-center text-[12px] font-bold leading-[1.2]', i === 0 ? 'text-white' : 'mt-[7%] text-ink')}>{s.title}</span>
                </span>
              )
            })}
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {b.items.map((s, i) => (
            <li key={i} className="grid grid-cols-[14px_minmax(0,1fr)] gap-3">
              <span aria-hidden className={cn('mt-[5px] h-3.5 w-3.5 rounded-pill', swatch[i], i === 2 ? 'ring-1 ring-line-strong' : '')} />
              <div className="flex flex-col gap-0.5">
                <p className={title}>
                  <Rich text={s.title} />
                </p>
                <p className={cn(small, 'text-text-2')}>
                  <Rich text={s.text} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Figure>
  )
}

const ARROWS = { right: '', down: 'rotate-90', left: 'rotate-180', up: '-rotate-90' } as const

/**
 * Four steps around what they serve. Wide, the steps sit in the corners of a 3 by 3 grid, clockwise from the top
 * left, with an arrow in each cell between them and the centre in the middle. That drawing is hidden from screen
 * readers, which read the list in order instead; under 768 px the list is all there is.
 */
export function Cycle({ b }: { b: Of<'cycle'> }) {
  const card = (s: Of<'cycle'>['items'][number], i: number) => (
    <div key={i} className="relative self-stretch rounded-card border border-bar bg-surface px-5 pb-4 pt-6">
      <span className={cn('absolute -top-[14px] left-[18px] flex h-7 min-w-7 items-center justify-center rounded-pill border-2 border-ink px-2 text-[13px] font-bold', fill(i))}>
        {i + 1}
      </span>
      <span className="block text-[16px] font-bold leading-[1.3] text-ink">{s.title}</span>
      {s.text ? <span className="mt-1.5 block text-[14px] leading-[1.55] text-text-2">{s.text}</span> : null}
    </div>
  )
  const arrow = (dir: keyof typeof ARROWS) => (
    <div className="flex justify-center">
      <ArrowRight size={26} strokeWidth={2.2} className={cn('text-ink', ARROWS[dir])} />
    </div>
  )
  const [a, c2, c3, d] = b.items
  return (
    <Figure>
      <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] grid-rows-[auto_130px_auto] items-center pt-4 md:grid">
        {card(a, 0)}
        {arrow('right')}
        {card(c2, 1)}
        {arrow('up')}
        <div className="flex justify-center">
          <span className="flex h-[124px] w-[124px] items-center justify-center rounded-pill bg-ink p-3 text-center text-[13px] font-semibold leading-[1.35] text-white">{b.center}</span>
        </div>
        {arrow('down')}
        {card(d, 3)}
        {arrow('left')}
        {card(c3, 2)}
      </div>
      <div className="md:sr-only">
        <p className="m-0 mb-3 rounded-card bg-ink px-4 py-3 text-[15px] font-semibold text-white">{b.center}</p>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {b.items.map((s, i) => (
            <li key={i} className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-3">
              <span className={cn('mt-3 flex h-[30px] w-[30px] items-center justify-center rounded-pill border-2 border-ink text-[13px] font-bold', fill(i))}>{i + 1}</span>
              <div className="rounded-card border border-bar bg-surface px-4 py-3">
                <p className={title}>{s.title}</p>
                {s.text ? <p className={cn(small, 'text-text-2')}>{s.text}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Figure>
  )
}

export function Stats({ b, sources }: { b: Of<'stats'>; sources: readonly Source[] }) {
  const n = b.items.length
  return (
    <Figure>
      <ul className={cn('m-0 grid list-none gap-3 p-0', n === 2 || n === 4 ? 'sm:grid-cols-2' : 'md:grid-cols-3')}>
        {b.items.map((s, i) => (
          <li key={i} className={cn('flex flex-col gap-2 rounded-card px-5 py-5', fill(i))}>
            <span className="font-display text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink max-md:text-[36px]">{s.value}</span>
            <span className="text-[15px] leading-[1.5] text-text-body">
              <Rich text={s.label} />
            </span>
            <span className="mt-auto text-[12.5px] text-text-3 max-md:text-[13.5px]">
              <Cite n={s.source} sources={sources} />
            </span>
          </li>
        ))}
      </ul>
    </Figure>
  )
}

const number = (n: number) => n.toLocaleString('en-GB')

export function Bars({ b, sources }: { b: Of<'bars'>; sources: readonly Source[] }) {
  const max = Math.max(...b.items.map((i) => i.value), 1)
  const ceiling = b.percent ? 100 : max
  return (
    <Figure foot={<BasisLine basis={b.basis} sources={sources} />} className="rounded-card-lg border border-bar bg-surface px-6 py-5 max-md:px-4">
      <div className="flex items-start justify-between gap-3">
        <p className="m-0 font-display text-[18px] font-medium leading-[1.3] tracking-[-0.01em] text-ink">
          <Rich text={b.title} />
        </p>
        {'example' in b.basis ? <Mark kind="example" /> : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {b.items.map((it, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto] items-center gap-4 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3 max-md:gap-y-1">
            <span className="text-[14.5px] font-semibold text-ink max-md:text-[15px]">
              <Rich text={it.label} />
            </span>
            <span aria-hidden className="h-4 rounded-pill bg-track max-md:order-last max-md:col-span-2">
              <span className="block h-4 rounded-pill bg-accent-strong" style={{ width: `${Math.max(2, (it.value / ceiling) * 100)}%` }} />
            </span>
            <span className="min-w-[3ch] text-right text-[15px] font-bold tabular-nums text-ink">
              {number(it.value)}
              {b.percent ? '%' : ''}
            </span>
          </li>
        ))}
      </ul>
    </Figure>
  )
}

/** A meeting's time, item by item. The bar repeats the list under it, so only the list is read aloud. */
export function Timebar({ b }: { b: Of<'timebar'> }) {
  const t = useTranslations('site.figures')
  const total = b.items.reduce((s, i) => s + i.minutes, 0)
  const byKind = b.kinds.map((label, k) => ({ label, minutes: b.items.filter((i) => i.kind === k).reduce((s, i) => s + i.minutes, 0) }))
  return (
    <Figure foot={t('exampleNote')} className="rounded-card-lg border border-bar bg-surface px-6 py-5 max-md:px-4">
      <div className="flex items-start justify-between gap-3">
        <p className="m-0 font-display text-[18px] font-medium leading-[1.3] tracking-[-0.01em] text-ink">
          <Rich text={b.title} />
        </p>
        <Mark kind="example" />
      </div>
      <div aria-hidden className="flex h-12 overflow-hidden rounded-btn border border-bar">
        {b.items.map((it, i) => (
          <span
            key={i}
            className={cn('flex items-center justify-center border-r-2 border-white text-[12px] font-bold text-ink last:border-r-0', KIND_FILLS[it.kind])}
            style={{ width: `${(it.minutes / total) * 100}%` }}
          >
            <span className="max-sm:hidden">{it.minutes >= 10 ? it.minutes : ''}</span>
          </span>
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
        {byKind.map((k, i) => (
          <li key={i} className="flex items-center gap-2 text-[14px] text-text-body">
            <span aria-hidden className={cn('h-3.5 w-3.5 rounded-[4px]', KIND_FILLS[i])} />
            <span className="font-semibold text-ink">
              <Rich text={k.label} />
            </span>
            <span className="tabular-nums">{t('minutes', { n: k.minutes })}</span>
          </li>
        ))}
        <li className="flex items-center text-[14px] font-semibold text-ink">{t('totalMinutes', { n: total })}</li>
      </ul>
      <ol className="m-0 flex list-none flex-col gap-1.5 border-t border-rule-softer p-0 pt-3">
        {b.items.map((it, i) => (
          <li key={i} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-3 text-[14.5px] max-md:text-[15px]">
            <span aria-hidden className={cn('h-3.5 w-3.5 rounded-[4px]', KIND_FILLS[it.kind])} />
            <span className="text-text-body">
              <Rich text={it.label} />
              <span className="sr-only">{` (${b.kinds[it.kind] ?? ''})`}</span>
            </span>
            <span className="font-semibold tabular-nums text-ink">{t('minutes', { n: it.minutes })}</span>
          </li>
        ))}
      </ol>
    </Figure>
  )
}

/** Each team's answers as dots on the scale, with the average marked: an example, never a real team */
export function Spread({ b }: { b: Of<'spread'> }) {
  const t = useTranslations('site.figures')
  const at = (v: number) => `${((v - 1) / 4) * 100}%`
  return (
    <Figure foot={t('exampleNote')} className="rounded-card-lg border border-bar bg-surface px-6 py-5 max-md:px-4">
      <div className="flex justify-end">
        <Mark kind="example" />
      </div>
      <ul className="m-0 flex list-none flex-col gap-6 p-0">
        {b.rows.map((r, i) => {
          const mean = r.values.reduce((s, v) => s + v, 0) / r.values.length
          const stack = new Map<number, number>()
          return (
            <li key={i} className="flex flex-col gap-2">
              <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-[15px]">
                <span className="font-semibold text-ink">
                  <Rich text={r.label} />
                </span>
                <span className="font-bold tabular-nums text-ink">{t('average', { value: mean.toFixed(1) })}</span>
              </p>
              <span className="sr-only">{t('answers', { list: r.values.join(', ') })}</span>
              <div aria-hidden className="relative mx-3" style={{ height: `${46 + Math.max(...[1, 2, 3, 4, 5].map((v) => r.values.filter((x) => x === v).length)) * 15}px` }}>
                <span className="absolute bottom-5 left-0 right-0 h-[3px] rounded-pill bg-track" />
                {[1, 2, 3, 4, 5].map((v) => (
                  <span key={v} className="absolute bottom-0 -translate-x-1/2 text-[12px] font-semibold text-text-2" style={{ left: at(v) }}>
                    {v}
                  </span>
                ))}
                {r.values.map((v, j) => {
                  const k = stack.get(v) ?? 0
                  stack.set(v, k + 1)
                  return (
                    <span
                      key={j}
                      className={cn('absolute h-3.5 w-3.5 -translate-x-1/2 rounded-pill border-2 border-ink', fill(i))}
                      style={{ left: at(v), bottom: `${32 + k * 15}px` }}
                    />
                  )
                })}
                <span className="absolute bottom-[14px] h-[16px] w-[3px] -translate-x-1/2 rounded-pill bg-step-current" style={{ left: at(mean) }} />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="m-0 flex justify-between text-[12.5px] font-semibold text-text-2 max-md:text-[13px]">
        <span>
          <Rich text={b.scale.low} />
        </span>
        <span>
          <Rich text={b.scale.high} />
        </span>
      </p>
    </Figure>
  )
}

/** A filled-in specimen, part by part: a page of a charter or one agenda item, marked as a sample or an example */
export function Specimen({ b }: { b: Of<'specimen'> }) {
  return (
    <Figure>
      <div className="relative flex flex-col gap-4 rounded-card-lg border border-bar bg-surface px-7 py-6 shadow-[0_18px_40px_-28px_rgba(17,17,17,0.35)] max-md:px-4 max-md:py-5">
        <span aria-hidden className="absolute right-0 top-0 h-8 w-8 rounded-bl-[12px] rounded-tr-[20px] bg-gradient-to-bl from-bg from-50% to-surface-sunk to-50%" />
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <Mark kind={b.mark} />
          <p className="m-0 font-display text-[19px] font-medium tracking-[-0.01em] text-ink">
            <Rich text={b.title} />
          </p>
        </div>
        <dl className="m-0 flex flex-col gap-0 border-t border-rule-softer">
          {b.parts.map((p, i) => (
            <div key={i} className="grid grid-cols-[170px_minmax(0,1fr)] gap-4 border-b border-rule-softer py-3 last:border-b-0 max-md:grid-cols-1 max-md:gap-1">
              <dt className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-text-2 max-md:text-[13px]">
                <Rich text={p.label} />
              </dt>
              <dd className={cn(small, 'm-0')}>
                <Rich text={p.text} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Figure>
  )
}

/** Cards in a row, numbered when their order is the point */
export function Cards({ b, sources, wide = false }: { b: Of<'cards'>; sources: readonly Source[]; wide?: boolean }) {
  const n = b.items.length
  // across a wide page's frame (D-48) four cards stand in one row; in an article's column, two by two
  const columns = n === 3 || n >= 5 ? 'lg:grid-cols-3' : wide && n === 4 ? 'xl:grid-cols-4' : ''
  return (
    <Figure foot={b.source ? <Cite n={b.source} sources={sources} /> : null} className="my-0">
      <ul className={cn('m-0 grid list-none gap-3 p-0 sm:grid-cols-2', columns)}>
        {b.items.map((item, i) => (
          <li key={i} className={cn('flex flex-col gap-1.5 rounded-card px-5 py-4', b.numbered ? fill(i) : 'bg-surface')}>
            {b.numbered ? (
              <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-pill bg-white text-[14px] font-bold text-ink">{i + 1}</span>
            ) : null}
            <p className="m-0 text-[16px] font-bold text-ink">
              <Rich text={item.title} />
            </p>
            {item.text ? (
              <p className={cn('m-0 text-[15px] leading-[1.6]', b.numbered ? 'text-text-body' : 'text-text-2')}>
                <Rich text={item.text} />
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Figure>
  )
}
