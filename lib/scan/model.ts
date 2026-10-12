import { z } from 'zod'
import { levelTenths } from '@/lib/scoring/level'

/**
 * The Leadership Team Scan as the visitor's device needs it (handoff 6.2 and 6.3): the published scan
 * version's items in order, each with its theme, and the six themes. Built from rows of the `app` schema
 * that a visitor without an account may read (0003: published scan items only), parsed rather than cast.
 *
 * Wording comes from the rows, never from `messages/` (CLAUDE.md, Model as data). English is the only
 * locale, so the `en` text is taken.
 */

export interface ScanTheme {
  key: string
  name: string
  ordinal: number
}

export interface ScanItem {
  id: string
  ordinal: number
  theme: string
  text: string
}

export interface Scan {
  /** the instrument version the answers are for; a draft for another version is not resumed */
  versionId: string
  version: number
  themes: ScanTheme[]
  items: ScanItem[]
}

const text = z.object({ en: z.string().trim().min(1) })

export const versionRowSchema = z.object({ id: z.uuid(), version: z.number().int().positive() })

export const itemRowSchema = z.object({
  ordinal: z.number().int().positive(),
  theme: z.object({ key: z.string().min(1), name: text, ordinal: z.number().int().positive() }),
  item: z.object({ id: z.uuid(), text }),
})

export type VersionRow = z.infer<typeof versionRowSchema>
export type ItemRow = z.infer<typeof itemRowSchema>

/**
 * The scan from its rows, or the reason it cannot be one. Appendix C's rules hold or nothing is shown:
 * items numbered 1 to n without a gap, and every theme asked by exactly two items (handoff section 7: a
 * scan theme is the mean of its two items). A broken version is refused, not shown half right.
 */
export function buildScan(version: VersionRow, rows: readonly ItemRow[]): Scan | { problem: string } {
  if (rows.length === 0) return { problem: 'the published scan version has no items' }
  const items = [...rows].sort((a, b) => a.ordinal - b.ordinal)
  if (items.some((row, i) => row.ordinal !== i + 1)) return { problem: 'the items are not numbered 1 to n' }
  if (new Set(items.map((row) => row.item.id)).size !== items.length) return { problem: 'an item is asked twice' }

  const themes = new Map<string, ScanTheme & { count: number }>()
  for (const { theme } of items) {
    const seen = themes.get(theme.key)
    if (seen) seen.count += 1
    else themes.set(theme.key, { key: theme.key, name: theme.name.en, ordinal: theme.ordinal, count: 1 })
  }
  if ([...themes.values()].some((t) => t.count !== 2)) return { problem: 'a theme is not asked by exactly two items' }

  return {
    versionId: version.id,
    version: version.version,
    themes: [...themes.values()].sort((a, b) => a.ordinal - b.ordinal).map(({ key, name, ordinal }) => ({ key, name, ordinal })),
    items: items.map((row) => ({ id: row.item.id, ordinal: row.ordinal, theme: row.theme.key, text: row.item.text.en })),
  }
}

/** An answer on the five-point scale (handoff section 7, Answer format) */
export const answerSchema = z.number().int().min(1).max(5)
export type Answers = Readonly<Record<string, number>>

/** Every item of the scan has an answer from 1 to 5 */
export function isComplete(scan: Scan, answers: Answers): boolean {
  return scan.items.every((item) => answerSchema.safeParse(answers[item.id]).success)
}

/** The first item without an answer, as a 0-based position; the last position when every item has one */
export function firstUnanswered(scan: Scan, answers: Answers): number {
  const i = scan.items.findIndex((item) => !answerSchema.safeParse(answers[item.id]).success)
  return i === -1 ? scan.items.length - 1 : i
}

export interface ThemeScore {
  key: string
  name: string
  /** the mean of the theme's two answers, half up to integer tenths (lib/scoring/level.ts) */
  tenths: number
}

/**
 * The personal view (handoff 6.3): per theme, in the themes' order, the mean of its two answers. One
 * person's view, so there is no agreement; each score is indicative (handoff section 7, Level). Null
 * until every item has an answer.
 */
export function personalView(scan: Scan, answers: Answers): ThemeScore[] | null {
  if (!isComplete(scan, answers)) return null
  return scan.themes.map((theme) => {
    const values = scan.items.filter((item) => item.theme === theme.key).map((item) => answers[item.id] as number)
    return { key: theme.key, name: theme.name, tenths: levelTenths(values.reduce((a, b) => a + b, 0), values.length) }
  })
}
