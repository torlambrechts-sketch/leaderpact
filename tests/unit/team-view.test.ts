import { describe, expect, it } from 'vitest'
import { formatPrice } from '@/lib/plans/load'
import { buildTeamView, teamViewRowSchema, type TeamViewRow } from '@/lib/scan/team-view'
import { TEAM_VIEW_ANSWERS, TEAM_VIEW_FIGURES } from '../../scripts/seed/fixture.mjs'
import { agreementLabel, cutoffsSchema, levelTenths } from '@/lib/scoring'
import cutoffRows from '@/data/config/cutoffs.json'

/**
 * The team view (handoff 6.6): rows as get_team_view returns them, "You agree on" and "Your views differ
 * most on" from the labels alone, and the Team plan's price as the design writes it.
 */
// version 1, the cut-offs close_scan used for the fixture's view (data/config/cutoffs.json)
const CUTOFFS = cutoffsSchema.parse(cutoffRows[0])
const KEYS = ['purpose_and_priorities', 'meetings', 'dialogue_and_conflict', 'working_as_one_team', 'safety_and_trust', 'results']

function rows(): TeamViewRow[] {
  return TEAM_VIEW_FIGURES.map((f, i) => ({
    theme_key: KEYS[i]!,
    theme_name: { en: f.theme },
    ordinal: i + 1,
    level: Number(f.level),
    agreement: f.agreement,
    n: 4,
  }))
}

describe('the team view', () => {
  it('keeps the themes in order, with the stored level and the label', () => {
    const view = buildTeamView([...rows()].reverse())!
    expect(view.themes.map((t) => t.name)).toEqual(TEAM_VIEW_FIGURES.map((f) => f.theme))
    expect(view.themes.map((t) => (t.tenths / 10).toFixed(1))).toEqual(TEAM_VIEW_FIGURES.map((f) => f.level))
    expect(view.answered).toBe(4)
  })

  it('agrees on the high-agreement themes, highest level first, and differs on the low ones', () => {
    const view = buildTeamView(rows())!
    expect(view.agreeOn).toEqual(['Purpose and priorities', 'Results', 'Dialogue and conflict', 'Working as one team'])
    expect(view.differOn).toEqual(['Meetings'])
  })

  it('says nothing it does not have: no rows is no view, and an uneven count is refused', () => {
    expect(buildTeamView([])).toBeNull()
    const uneven = rows()
    uneven[2] = { ...uneven[2]!, n: 5 }
    expect(buildTeamView(uneven)).toBeNull()
  })

  it('refuses a row below the threshold, or one that carries the agreement number', () => {
    expect(teamViewRowSchema.safeParse({ ...rows()[0], n: 3 }).success).toBe(false)
    expect(teamViewRowSchema.safeParse({ ...rows()[0], agreement: 0.83 }).success).toBe(false)
    expect(Object.keys(teamViewRowSchema.shape)).not.toContain('agreement_value')
  })

  it("the fixture's figures are what the scoring functions make of its answers", () => {
    for (const [t, figure] of TEAM_VIEW_FIGURES.entries()) {
      const sums = TEAM_VIEW_ANSWERS.map((a) => a[t * 2]! + a[t * 2 + 1]!)
      const total = sums.reduce((x, y) => x + y, 0)
      expect((levelTenths(total, sums.length * 2) / 10).toFixed(1), figure.theme).toBe(figure.level)
      expect(agreementLabel(sums, 2, CUTOFFS), figure.theme).toBe(figure.agreement)
    }
  })
})

describe('the Team plan price', () => {
  it('is written as the design writes it', () => {
    expect(formatPrice({ amountMinor: 180000, currency: 'USD', interval: 'year' })).toBe('$1,800')
    expect(formatPrice({ amountMinor: 18050, currency: 'USD', interval: 'month' })).toBe('$180.50')
  })
})
