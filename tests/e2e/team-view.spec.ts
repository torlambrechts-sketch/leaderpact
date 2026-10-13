import { expect, test, type Page } from '@playwright/test'
import { TEAM_STATES, TEAM_VIEW_FIGURES } from '../../scripts/seed/fixture.mjs'
import { canSignInFlowLeader, signInFlowLeader } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 5 (handoff 12): the team view appears only at close, and the under-4 path gives one extension,
 * then no view. Handoff 6.6's three states, read from the fixture's three flow groups
 * (scripts/seed/fixture.mjs --e2e): released, extended once, and closed with no team view. The flows read
 * only, so every width shares the groups.
 */
const AGREEMENT = { high: 'High agreement', medium: 'Medium agreement', low: 'Views differ' } as const

/** Nothing a result may never show (handoff 7): no spread, no lowest or highest, no agreement number */
async function nothingForbidden(page: Page) {
  await expect(page.getByText(/lowest|highest|median|standard deviation|\bSD\b|rwg|distribution/i)).toHaveCount(0)
  await expect(page.getByText(/\b0\.\d+\b|\d+(\.\d+)?\s?%/)).toHaveCount(0)
}

test('released: the link shows the team view computed at close, levels and labels only', async ({ page }) => {
  const problems = watch(page)
  const { group, scan } = TEAM_STATES.released
  await page.goto(`/j/${scan.code}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Team view' })).toBeVisible()
  await expect(page.getByText(group.name)).toBeVisible()
  await expect(page.getByText('4 of 4 answered. Counts only, never names.')).toBeAttached()
  const meters = page.getByRole('meter')
  await expect(meters).toHaveCount(6)
  for (const [i, f] of TEAM_VIEW_FIGURES.entries()) {
    await expect(meters.nth(i)).toHaveAccessibleName(f.theme)
    await expect(meters.nth(i)).toHaveAttribute('aria-valuetext', `${f.level}, ${AGREEMENT[f.agreement]}`)
  }
  await expect(page.getByRole('heading', { name: 'You agree on' })).toBeVisible()
  await expect(page.getByText('Purpose and priorities, Results, Dialogue and conflict, Working as one team', { exact: true })).toBeVisible()
  const differ = page.locator('section', { has: page.getByRole('heading', { name: 'Your views differ most on' }) })
  await expect(differ.getByText('Meetings', { exact: true })).toBeVisible()
  await expect(differ.getByText('Talk about the difference first.')).toBeVisible()
  await expect(page.getByText('Research-based, not yet validated · scale 1–5')).toBeVisible()
  await expect(page.getByText("Counts only, never names. No one's answers are shown.")).toBeVisible()
  // someone with the link is not known to be the leader: no price, an ask instead
  await expect(page.getByText('Ask your team leader to upgrade.', { exact: false })).toBeVisible()
  await expect(page.getByText(/\$/)).toHaveCount(0)
  await nothingForbidden(page)
  await axe(page)
  expect(problems).toEqual([])
})

test('closed with fewer than 4: the link says no team view was made, and why', async ({ page }) => {
  const { scan } = TEAM_STATES.closed
  await page.goto(`/j/${scan.code}`)
  await expect(page.getByRole('heading', { level: 1, name: 'No team view was made' })).toBeVisible()
  await expect(page.getByText('Fewer than 4 answered, so no team view was made and the answers were deleted.')).toBeVisible()
  await expect(page.getByText("A team view needs at least 4 answers, so that no one's answers can be seen.")).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  await axe(page)
})

test('extended once: the link is open again, with a count and the new closing date, and no team view', async ({ page }) => {
  const { scan } = TEAM_STATES.extended
  await page.goto(`/j/${scan.code}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Leadership Team Scan' })).toBeVisible()
  await expect(page.getByText(`3 of ${scan.size} have answered. Counts only, never names.`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  await axe(page)
})

test("the leader's pages: the team view with the Team plan's price, the invite page's way to it, and the other two states", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px')
  test.skip(!canSignInFlowLeader(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  const problems = watch(page)
  await signInFlowLeader(page, baseURL!)

  // released: the invite page leads to the team view, which shows the leader the price
  await page.goto(`/app/${TEAM_STATES.released.group.id}/invite`)
  await expect(page.getByText('The scan has closed', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'The team view is open' }).click()
  await expect(page).toHaveURL(new RegExp(`/app/${TEAM_STATES.released.group.id}/team$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Team view' })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(6)
  await expect(page.getByRole('heading', { name: 'Unlock the full diagnostic' })).toBeVisible()
  await expect(page.getByText('$1,800 per group per year')).toBeVisible()
  await expect(page.getByText('Ask your team leader to upgrade.', { exact: false })).toHaveCount(0)
  await nothingForbidden(page)
  await axe(page)

  // extended: the invite page says so; the team view page shows a count and the date only
  await page.goto(`/app/${TEAM_STATES.extended.group.id}/invite`)
  await expect(page.getByText(/so the scan was extended once/)).toBeVisible()
  await page.goto(`/app/${TEAM_STATES.extended.group.id}/team`)
  await expect(page.getByText('The team view opens when the scan closes', { exact: true })).toBeVisible()
  await expect(page.getByText(/^3 of 6 have answered\. It closes when all 6 have answered, or on .+\. Counts only, never names\.$/)).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  await axe(page)

  // closed below the threshold: no team view
  await page.goto(`/app/${TEAM_STATES.closed.group.id}/team`)
  await expect(page.getByRole('heading', { level: 1, name: 'No team view was made' })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  expect(problems).toEqual([])
})
