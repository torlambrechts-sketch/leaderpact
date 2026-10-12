import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Milestone 3 (handoff 12): a visitor completes the scan with no account, on a phone, and sees the personal
 * view within 2 seconds. Handoff 13's flow "scan to personal view, on a 390 px screen" runs in every project
 * of playwright.config.ts: 1280, 390 and 360 px.
 *
 * The answers below give known theme means (two items per theme, Appendix C order):
 * 5 4 | 3 2 | 1 5 | 4 3 | 2 1 | 5 4  ->  4.5, 2.5, 3.0, 3.5, 1.5, 4.5
 */
const ANSWERS = [5, 4, 3, 2, 1, 5, 4, 3, 2, 1, 5, 4]
const MEANS = ['4.5', '2.5', '3.0', '3.5', '1.5', '4.5']
const OPTION = ['', 'Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']

/** Fails the test on any console error, page error or failed request */
function watch(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text())
  })
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })
  return problems
}

async function axe(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(result.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`)).toEqual([])
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(sideways).toBe(false)
}

async function answer(page: Page, value: number) {
  await page.getByRole('radio', { name: OPTION[value], exact: true }).click()
}

test('the landing page: one way in, a sample marked Sample, and the corrections of section 11', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/leadership-team-assessment')
  await expect(page).toHaveTitle(/^Leadership team assessment/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Leadership team assessment')
  const sample = page.getByRole('region', { name: 'Sample team view' })
  await expect(sample).toContainText('Sample')
  await expect(sample).toContainText('Research-based, not yet validated')
  await expect(page.getByText('Counts only, never names')).toBeVisible()
  await expect(page.getByText(/At 4 answers|demo group|^Research$|Templates|For coaches|(?<!Leadership )Team Scan/)).toHaveCount(0)
  await expect(page.getByText('When the scan closes, the team view opens')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Data processing' })).toBeVisible()
  await axe(page)

  await page.getByRole('main').getByRole('link', { name: 'Start the scan' }).click()
  await expect(page).toHaveURL(/\/scan$/)
  await expect(page.getByText('1 of 12')).toBeVisible()
  expect(problems).toEqual([])
})

test('a visitor completes the scan with no account and sees the personal view within 2 seconds', async ({ page }) => {
  const problems = watch(page)
  // answers stay on the device until the last question: the browser asks the database for nothing
  const fromBrowser: string[] = []
  page.on('request', (r) => {
    if (/\/(rest|auth)\/v1\//.test(r.url())) fromBrowser.push(r.url())
  })

  await page.goto('/scan')
  await expect(page.getByText('Answers stay on this device until you finish. No account needed.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Back' })).toBeDisabled()
  await axe(page)

  for (const [i, value] of ANSWERS.entries()) {
    await expect(page.getByText(`${i + 1} of 12`)).toBeVisible()
    await answer(page, value)
    if (i < ANSWERS.length - 1) await page.getByRole('button', { name: 'Next' }).click()
  }
  // Back keeps what was answered
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByText('11 of 12')).toBeVisible()
  await expect(page.getByRole('radio', { name: OPTION[ANSWERS[10]!], exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Next' }).click()

  const start = Date.now()
  await page.getByRole('button', { name: 'See my view' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Your reading of the team' })).toBeVisible()
  expect(Date.now() - start).toBeLessThan(2000)

  await expect(page).toHaveURL(/\/scan\/result$/)
  await expect(page.getByText("One person's view")).toBeVisible()
  await expect(page.getByText('The team view opens when the scan closes')).toBeVisible()
  await expect(page.getByText('Research-based, not yet validated')).toBeVisible()
  await expect(page.getByText(/indicative/)).toBeVisible()
  const meters = page.getByRole('meter')
  await expect(meters).toHaveCount(6)
  for (const [i, mean] of MEANS.entries()) {
    await expect(meters.nth(i)).toHaveAttribute('aria-valuetext', `${mean}, indicative`)
  }
  await expect(page.getByText(/rate highest|rate lowest|needs 4 answers/)).toHaveCount(0)
  await axe(page)

  expect(fromBrowser).toEqual([])
  expect(problems).toEqual([])
})

test('an abandoned scan resumes on the same device, and not after 7 days', async ({ page }) => {
  await page.goto('/scan')
  for (const value of [2, 3, 4]) {
    await answer(page, value)
    await page.getByRole('button', { name: 'Next' }).click()
  }
  await page.reload()
  await expect(page.getByText('4 of 12')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('radio', { name: OPTION[4], exact: true })).toBeChecked()

  // the same draft, last saved eight days ago
  await page.evaluate(() => {
    const key = 'leaderpact.scan'
    const draft = JSON.parse(localStorage.getItem(key) ?? '{}')
    localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: new Date(Date.now() - 8 * 86_400_000).toISOString() }))
  })
  await page.reload()
  await expect(page.getByText('1 of 12')).toBeVisible()
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('leaderpact.scan'))).toBeNull()
})

test('the personal view without a finished scan on this device says so', async ({ page }) => {
  await page.goto('/scan/result')
  await expect(page.getByRole('heading', { level: 1, name: 'There is no finished scan on this device' })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  await page.getByRole('main').getByRole('link', { name: 'Start the scan' }).click()
  await expect(page).toHaveURL(/\/scan$/)
})

test('the legal pages exist and say their text is not written yet', async ({ page }) => {
  for (const [path, heading] of [
    ['/privacy', 'Privacy'],
    ['/data-processing', 'Data processing'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expect(page.getByText('not written yet')).toBeVisible()
  }
})
