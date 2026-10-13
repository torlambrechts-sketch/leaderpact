import { z } from 'zod'

/**
 * The team view (handoff 6.6): per theme the level, to one decimal, and the agreement label, computed once
 * at close (0006, `team_view`). Readers return labels only, never the agreement number (handoff 7).
 *
 * "You agree on" and "Your views differ most on" (design `team`) are read from the labels alone: the themes
 * labelled high agreement, highest level first, and the themes whose views differ (low agreement). The
 * design picks the theme with the lowest agreement number, but no reader returns that number, and ordering
 * by it would show what the label is there to hide (D-29).
 */
export type Agreement = 'high' | 'medium' | 'low'

export const teamViewRowSchema = z.object({
  theme_key: z.string().min(1),
  theme_name: z.object({ en: z.string().trim().min(1) }),
  ordinal: z.number().int().positive(),
  // numeric(2,1) arrives as a number from PostgREST; anything else is refused
  level: z.number().min(1).max(5),
  agreement: z.enum(['high', 'medium', 'low']),
  n: z.number().int().min(4),
})
export type TeamViewRow = z.infer<typeof teamViewRowSchema>

export interface TeamTheme {
  key: string
  name: string
  /** the stored level, in integer tenths, so it is shown exactly as stored */
  tenths: number
  agreement: Agreement
}

export interface TeamView {
  themes: TeamTheme[]
  /** how many answered: a count, the same for every theme */
  answered: number
  agreeOn: string[]
  differOn: string[]
}

/** The team view from its rows, or null when there are none (not released, or below k) or they disagree */
export function buildTeamView(rows: readonly TeamViewRow[]): TeamView | null {
  if (rows.length === 0) return null
  const answered = rows[0]!.n
  if (rows.some((r) => r.n !== answered)) return null
  const themes = [...rows]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((r) => ({ key: r.theme_key, name: r.theme_name.en, tenths: Math.round(r.level * 10), agreement: r.agreement }))
  const agreeOn = themes
    .filter((t) => t.agreement === 'high')
    .sort((a, b) => b.tenths - a.tenths)
    .map((t) => t.name)
  const differOn = themes.filter((t) => t.agreement === 'low').map((t) => t.name)
  return { themes, answered, agreeOn, differOn }
}
