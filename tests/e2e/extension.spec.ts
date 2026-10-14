import { expect, test } from '@playwright/test'
import { TEAM_STATES } from '../../scripts/seed/fixture.mjs'
import { canPassDeadline, passScanDeadline } from './support/deadline'
import { answerScan, axe, watch } from './support/page'

/**
 * Handoff 13, the flows: "Scan closes with 3 answers: extension, then no team view." On the fixture's open
 * extension group (scripts/seed/fixture.mjs, TEAM_STATES.timeline): three browsers answer through the link, the
 * closing date passes, and the link stays open for one more week with a count and no view; it passes again, and
 * the link says no team view was made and the answers were deleted. The SQL suites prove the same in the
 * database (anonymity_invariants 17 and 18, scan_close_invariants 6).
 */
const VALUES = [4, 4, 3, 2, 5, 4, 3, 3, 2, 4, 5, 4]

test('three answers by the closing date: one extension, then no team view', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'once: the flow closes its group for good')
  test.skip(!canPassDeadline(), 'no local database: needs DB_URL (CI) or DATABASE_URL (local-pg.sh)')
  test.setTimeout(120_000)
  const { group, scan } = TEAM_STATES.timeline
  const problems = watch(page)
  const link = `/j/${scan.code}`

  await page.goto(link)
  await expect(page.getByText(group.name)).toBeVisible()
  const fresh = await page.getByText(`0 of ${scan.size} have answered. Counts only, never names.`).isVisible()
  test.skip(!fresh, 'the extension group has been used: run scripts/seed/fixture.mjs --e2e again')

  // three people answer, each in a browser of their own
  for (const shift of [0, 1, 2]) {
    const context = await browser.newContext({ baseURL })
    const member = await context.newPage()
    await member.goto(link)
    await member.getByRole('button', { name: 'Start' }).click()
    await answerScan(member, VALUES.map((v) => Math.min(5, v + (shift === 2 ? 1 : 0))), 'See my view')
    await member.getByRole('button', { name: 'Submit anonymously' }).click()
    await expect(member.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
    await context.close()
  }
  await page.reload()
  await expect(page.getByText(`3 of ${scan.size} have answered. Counts only, never names.`)).toBeVisible()

  // the closing date passes with 3, under the threshold of 4: the scan is extended once, with no view
  expect(passScanDeadline(scan.id)).toBe('open')
  await page.goto(link)
  await expect(page.getByRole('heading', { level: 1, name: 'Leadership Team Scan' })).toBeVisible()
  await expect(page.getByText(`3 of ${scan.size} have answered. Counts only, never names.`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  await axe(page)

  // it passes again with no fourth answer: no team view, and the answers are gone
  expect(passScanDeadline(scan.id)).toBe('closed')
  await page.goto(link)
  await expect(page.getByRole('heading', { level: 1, name: 'No team view was made' })).toBeVisible()
  await expect(page.getByText('Fewer than 4 answered, so no team view was made and the answers were deleted.')).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0)
  await axe(page)
  expect(problems).toEqual([])
})
