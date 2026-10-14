import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** The five options, by value (handoff section 7, Answer format) */
export const OPTION = ['', 'Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']

/** Collects console errors, page errors and failed responses; the test expects none */
export function watch(page: Page, allow: RegExp[] = []) {
  const problems: string[] = []
  const add = (text: string) => {
    if (!allow.some((a) => a.test(text))) problems.push(text)
  }
  page.on('pageerror', (e) => add(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') add(m.text())
  })
  page.on('response', (r) => {
    if (r.status() >= 400) add(`${r.status()} ${new URL(r.url()).pathname}`)
  })
  return problems
}

/**
 * axe finds nothing, and the page does not scroll sideways. After a client-side navigation Next streams the
 * new page's metadata in a moment after its body, so the check waits for the title before it looks.
 */
export async function axe(page: Page) {
  await expect(page).toHaveTitle(/\S/)
  const result = await new AxeBuilder({ page }).analyze()
  expect(result.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`)).toEqual([])
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(sideways).toBe(false)
}

/** Answers every question of the scan on screen, ending on the last one's button */
export async function answerScan(page: Page, values: readonly number[], finish: string) {
  for (const [i, value] of values.entries()) {
    await expect(page.getByText(`${i + 1} of ${values.length}`)).toBeVisible()
    await page.getByRole('radio', { name: OPTION[value], exact: true }).click()
    await page.getByRole('button', { name: i === values.length - 1 ? finish : 'Next' }).click()
  }
}
