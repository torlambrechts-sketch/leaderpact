// Origin: Orgpuls lib/marketing/blocks.ts @ d9b1c52 (adapted: LeaderPact's block kinds, research sources, the copy rules).
import { z } from 'zod'
import { copyFindings } from '@/lib/i18n/copy-rules'

/**
 * The blocks the public site's long text is written in: the articles (data/articles), the template pages
 * (data/templates) and the product pages (data/pages). A page is an array of these in a data file, parsed
 * here, so a typo fails the test suite and the build instead of rendering half a page.
 *
 * Text may carry two inline marks, and only two: `**bold**` and `[label](href)`, where href is a path on
 * this site. There is no HTML in a data file, so there is nothing to sanitise. Every string a reader sees
 * keeps the copy rules of handoff section 10 (lib/i18n/copy-rules.ts), as the sample content does (D-30).
 */

/** Text a person reads: trimmed, single-spaced, the copy rules kept, and links only to this site's paths */
export const Copy = z
  .string()
  .min(1)
  .superRefine((text, ctx) => {
    if (text !== text.trim() || /\s{2,}/.test(text)) ctx.addIssue({ code: 'custom', message: 'stray whitespace' })
    for (const finding of copyFindings(plain(text))) ctx.addIssue({ code: 'custom', message: finding })
    for (const [, , href] of text.matchAll(LINK)) {
      if (!INTERNAL.test(href ?? '')) ctx.addIssue({ code: 'custom', message: `a link in the text goes to this site only: ${href}` })
    }
  })

/** `[label](href)`: the one link mark */
export const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g
/** a path on this site, with an optional anchor */
export const INTERNAL = /^\/[a-z0-9/-]*(#[a-z0-9-]+)?$/

const TitleText = z.object({ title: Copy, text: Copy })
/** a step or a stage: a title, and a sentence when the title needs one */
const Step = z.object({ title: Copy, text: Copy.optional() })

/**
 * Where a figure's claim comes from (D-41), cited under it: one of the article's sources by its number in the
 * list (1 is the first). A figure that draws a model or a finding names the source it is drawn from.
 */
const SourceRef = z.number().int().min(1)

/**
 * Where a chart's numbers come from (D-41). A number is never drawn without one: a source of the article by its
 * number, arithmetic a reader can redo (written out), or an example the text sets out, which the figure marks
 * as an example. The UI never fabricates data (CLAUDE.md), and a chart is where that is easiest to do.
 */
const Basis = z.union([
  z.object({ source: SourceRef }),
  z.object({ arithmetic: Copy }),
  z.object({ example: z.literal(true) }),
])
export type Basis = z.infer<typeof Basis>

/** a figure as a reader writes it: digits with separators, an optional sign before and a plus or per cent after */
const Figure = z.string().regex(/^[<>~]?\d[\d,.]*\+?%?$/)

const Axis = z.object({ label: Copy, low: Copy, high: Copy })

export const Block = z.discriminatedUnion('t', [
  z.object({ t: z.literal('h2'), text: Copy }),
  z.object({ t: z.literal('h3'), text: Copy }),
  z.object({ t: z.literal('p'), text: Copy }),
  z.object({ t: z.literal('ul'), items: z.array(Copy).min(1) }),
  z.object({ t: z.literal('ol'), items: z.array(Copy).min(1) }),
  /** a highlighted aside: a rule of thumb, or a question to take to the team */
  z.object({ t: z.literal('box'), title: Copy, text: Copy }),
  /** cards in a row, each with a heading and a sentence or two; numbered when their order is the point */
  z.object({ t: z.literal('cards'), items: z.array(Step).min(2).max(6), numbered: z.boolean().optional(), source: SourceRef.optional() }),
  z.object({ t: z.literal('table'), head: z.array(Copy).min(2).max(4), rows: z.array(z.array(Copy).min(2).max(4)).min(1) }),

  // figures (D-41, after Orgpuls D-237): the drawing is the renderer's (components/site/Figures.tsx), the words
  // are here, so a figure keeps the copy rules and a new one is data, not a component
  /** steps in order along a line: a process the reader follows */
  z.object({ t: z.literal('steps'), items: z.array(Step).min(3).max(8) }),
  /** stages that lead into each other, left to right; with an axis, ordered from its `from` to its `to` */
  z.object({
    t: z.literal('flow'),
    items: z.array(TitleText).min(3).max(5),
    axis: z.object({ from: Copy, to: Copy }).optional(),
    source: SourceRef.optional(),
  }),
  /** levels that rest on each other, the base first */
  z.object({ t: z.literal('pyramid'), items: z.array(TitleText).min(3).max(5), source: SourceRef.optional() }),
  /** what holds up a whole: the roof, and the pillars under it */
  z.object({ t: z.literal('pillars'), roof: TitleText, items: z.array(TitleText).min(2).max(4), source: SourceRef.optional() }),
  /** two dimensions, low to high, and the four cells they make: top left, top right, bottom left, bottom right */
  z.object({
    t: z.literal('matrix'),
    x: Axis,
    y: Axis,
    cells: z.tuple([TitleText, TitleText, TitleText, TitleText]),
    /** the cell the text argues for, drawn with a ring */
    focus: z.number().int().min(0).max(3).optional(),
    source: SourceRef.optional(),
  }),
  /** two things side by side, each with the points that set it apart */
  z.object({
    t: z.literal('compare'),
    items: z.tuple([z.object({ title: Copy, points: z.array(Copy).min(2).max(5) }), z.object({ title: Copy, points: z.array(Copy).min(2).max(5) })]),
    source: SourceRef.optional(),
  }),
  /** one starting point and the two ways it can go, each with the condition that sends it there */
  z.object({
    t: z.literal('fork'),
    from: TitleText,
    items: z.tuple([z.object({ when: Copy, title: Copy, text: Copy }), z.object({ when: Copy, title: Copy, text: Copy })]),
    source: SourceRef.optional(),
  }),
  /** circles inside each other, the innermost first */
  z.object({ t: z.literal('rings'), items: z.array(TitleText).min(2).max(3) }),
  /** four steps that lead back to the first, around what they serve */
  z.object({ t: z.literal('cycle'), center: Copy, items: z.tuple([Step, Step, Step, Step]) }),
  /** a few figures from the sources, each with what it counts */
  z.object({ t: z.literal('stats'), items: z.array(z.object({ value: Figure, label: Copy, source: SourceRef })).min(2).max(4) }),
  /** a bar chart: what it counts, the bars and where the numbers come from */
  z.object({
    t: z.literal('bars'),
    title: Copy,
    items: z.array(z.object({ label: Copy, value: z.number().nonnegative() })).min(2).max(8),
    percent: z.boolean().optional(),
    basis: Basis,
  }),
  /** a meeting's time, item by item, coloured by kind: an example the text sets out */
  z.object({
    t: z.literal('timebar'),
    title: Copy,
    kinds: z.array(Copy).min(1).max(4),
    items: z.array(z.object({ label: Copy, minutes: z.number().int().min(1).max(240), kind: z.number().int().min(0).max(3) })).min(2).max(10),
    basis: z.object({ example: z.literal(true) }),
  }),
  /** answers on an agreement scale, a row of dots per team, with each row's average: an example from the text */
  z.object({
    t: z.literal('spread'),
    scale: z.object({ low: Copy, high: Copy }),
    rows: z.array(z.object({ label: Copy, values: z.array(z.number().int().min(1).max(5)).min(3).max(10) })).min(2).max(3),
    basis: z.object({ example: z.literal(true) }),
  }),
  /** a filled-in specimen: an agenda item or a charter, part by part, marked as an example or a sample */
  z.object({
    t: z.literal('specimen'),
    mark: z.enum(['example', 'sample']),
    title: Copy,
    parts: z.array(z.object({ label: Copy, text: Copy })).min(3).max(8),
  }),
])
export type Block = z.infer<typeof Block>

/** The block kinds that are figures, for the editorial rule that an article draws its argument (D-41) */
export const FIGURES = ['steps', 'flow', 'pyramid', 'pillars', 'matrix', 'compare', 'fork', 'rings', 'cycle', 'stats', 'bars', 'timebar', 'spread', 'specimen'] as const
export const isFigure = (b: Block) => (FIGURES as readonly string[]).includes(b.t)

/**
 * What a block's schema cannot say on its own (D-41): every source it cites is in the page's list (a page with
 * no list may cite none), a time bar's kind names one of its kinds, and a percentage is at most 100.
 */
export function blockProblems(b: Block, sourceCount: number): string[] {
  const out: string[] = []
  for (const n of sourceRefs(b)) if (n > sourceCount) out.push(`${b.t} cites source ${n}; the list has ${sourceCount}`)
  if (b.t === 'timebar') for (const i of b.items) if (i.kind >= b.kinds.length) out.push(`timebar: "${i.label}" has kind ${i.kind}; there are ${b.kinds.length}`)
  if (b.t === 'bars' && b.percent) for (const i of b.items) if (i.value > 100) out.push(`bars: "${i.label}" is ${i.value} per cent`)
  return out
}

/** Every source number a block cites, so an article can check each one is in its list */
export function sourceRefs(b: Block): number[] {
  switch (b.t) {
    case 'stats':
      return b.items.map((i) => i.source)
    case 'bars':
      return 'source' in b.basis ? [b.basis.source] : []
    case 'cards':
    case 'flow':
    case 'pyramid':
    case 'pillars':
    case 'matrix':
    case 'compare':
    case 'fork':
      return b.source ? [b.source] : []
    default:
      return []
  }
}

export const Blocks = z.array(Block).min(1)

/**
 * A source: the study, book or page a claim rests on. Its fields are a bibliographic record, written as
 * the source writes itself (a journal title keeps its American spelling), so the copy rules do not apply.
 * The address is the publisher's page or the DOI, checked when the article was written.
 */
export const Source = z.object({
  authors: z.string().min(2),
  year: z.number().int().min(1900).max(2100),
  title: z.string().min(2),
  /** the journal with volume and pages, the publisher of a book, or the site of a page */
  venue: z.string().min(2),
  url: z.string().url().startsWith('https://'),
})
export type Source = z.infer<typeof Source>

/** How a source reads in the list: "Edmondson, A. (1999). Title. Venue." */
export const sourceLabel = (s: Source) => `${s.authors} (${s.year}). ${s.title.replace(/[.?!]$/, '')}${/[?!]$/.test(s.title) ? s.title.slice(-1) : '.'} ${s.venue}.`

/**
 * How a figure cites a source, as the text cites it: one surname, two joined by "and", the first and "et al."
 * for three or more, then the year ("Simons and Peterson (2000)", "De Jong et al. (2016)"). An organisation as
 * author keeps its name ("re:Work Editorial Team").
 */
export function shortCite(s: Source): string {
  const surnames = (s.authors.match(/[^,&]+,\s*(?:[A-Z]\.\s*)+/g) ?? []).map((p) => p.split(',')[0]!.trim())
  const who =
    surnames.length === 0
      ? s.authors.replace(/[.,]$/, '').trim()
      : surnames.length === 1
        ? surnames[0]
        : surnames.length === 2
          ? `${surnames[0]} and ${surnames[1]}`
          : `${surnames[0]} et al.`
  return `${who} (${s.year})`
}

/** Strips the two inline marks, for a meta description, JSON-LD, the copy rules or a word count */
export const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(LINK, '$1')

/** Every string a reader reads in the blocks, in order */
export function blockText(blocks: Block[]): string[] {
  const steps = (items: { title: string; text?: string }[]) => items.flatMap((i) => (i.text ? [i.title, i.text] : [i.title]))
  return blocks.flatMap((b): string[] => {
    switch (b.t) {
      case 'h2':
      case 'h3':
      case 'p':
        return [b.text]
      case 'ul':
      case 'ol':
        return b.items
      case 'box':
        return [b.title, b.text]
      case 'cards':
      case 'steps':
      case 'flow':
      case 'pyramid':
      case 'rings':
        return [...('axis' in b && b.axis ? [b.axis.from, b.axis.to] : []), ...steps(b.items)]
      case 'table':
        return [...b.head, ...b.rows.flat()]
      case 'pillars':
        return [b.roof.title, b.roof.text, ...steps(b.items)]
      case 'matrix':
        return [b.x.label, b.x.low, b.x.high, b.y.label, b.y.low, b.y.high, ...steps(b.cells)]
      case 'compare':
        return b.items.flatMap((i) => [i.title, ...i.points])
      case 'fork':
        return [b.from.title, b.from.text, ...b.items.flatMap((i) => [i.when, i.title, i.text])]
      case 'cycle':
        return [b.center, ...steps(b.items)]
      case 'stats':
        return b.items.map((i) => i.label)
      case 'bars':
        return [b.title, ...b.items.map((i) => i.label), ...('arithmetic' in b.basis ? [b.basis.arithmetic] : [])]
      case 'timebar':
        return [b.title, ...b.kinds, ...b.items.map((i) => i.label)]
      case 'spread':
        return [b.scale.low, b.scale.high, ...b.rows.map((r) => r.label)]
      case 'specimen':
        return [b.title, ...b.parts.flatMap((p) => [p.label, p.text])]
    }
  })
}

/** Words a reader reads in the blocks, for an honest reading time */
export const wordCount = (blocks: Block[]) => blockText(blocks).map(plain).join(' ').split(/\s+/).filter(Boolean).length

/** Every internal path the text links to */
export const linksIn = (texts: string[]) => texts.flatMap((t) => [...t.matchAll(LINK)].map((m) => m[2] ?? ''))

/** An anchor for each h2, in order: lower case, ASCII, hyphens; a repeat gets -2, -3 */
export function headingIds(blocks: Block[]): Map<number, string> {
  const ids = new Map<number, string>()
  const seen = new Map<string, number>()
  blocks.forEach((b, i) => {
    if (b.t !== 'h2') return
    const base =
      plain(b.text)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'section'
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    ids.set(i, n === 1 ? base : `${base}-${n}`)
  })
  return ids
}
