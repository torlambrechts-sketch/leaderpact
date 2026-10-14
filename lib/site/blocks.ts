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

export const Block = z.discriminatedUnion('t', [
  z.object({ t: z.literal('h2'), text: Copy }),
  z.object({ t: z.literal('h3'), text: Copy }),
  z.object({ t: z.literal('p'), text: Copy }),
  z.object({ t: z.literal('ul'), items: z.array(Copy).min(1) }),
  z.object({ t: z.literal('ol'), items: z.array(Copy).min(1) }),
  /** a highlighted aside: a rule of thumb, or a question to take to the team */
  z.object({ t: z.literal('box'), title: Copy, text: Copy }),
  /** cards in a row, each with a heading and a sentence or two */
  z.object({ t: z.literal('cards'), items: z.array(TitleText).min(2).max(4) }),
  z.object({ t: z.literal('table'), head: z.array(Copy).min(2).max(4), rows: z.array(z.array(Copy).min(2).max(4)).min(1) }),
])
export type Block = z.infer<typeof Block>

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

/** Strips the two inline marks, for a meta description, JSON-LD, the copy rules or a word count */
export const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(LINK, '$1')

/** Every string a reader reads in the blocks, in order */
export function blockText(blocks: Block[]): string[] {
  return blocks.flatMap((b) => {
    switch (b.t) {
      case 'ul':
      case 'ol':
        return b.items
      case 'box':
        return [b.title, b.text]
      case 'cards':
        return b.items.flatMap((i) => [i.title, i.text])
      case 'table':
        return [...b.head, ...b.rows.flat()]
      default:
        return [b.text]
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
