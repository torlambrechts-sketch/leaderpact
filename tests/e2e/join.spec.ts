import { expect, test, type Browser } from '@playwright/test'
import { E2E_GROUPS } from '../../scripts/seed/fixture.mjs'
import { answerScan, axe, watch } from './support/page'

/**
 * Milestone 4 (handoff 6.5): a member answers the Leadership Team Scan from the group's invite link, with
 * no account, at 1280, 390 and 360 px. Each Playwright project has its own group and scan from the fixture
 * (scripts/seed/fixture.mjs --e2e), so the projects never share a cap.
 */
const VALUES = [4, 4, 3, 2, 5, 4, 3, 3, 2, 4, 5, 4]

function groupFor(project: string) {
  const group = E2E_GROUPS.find((g) => g.project === project)
  if (!group) throw new Error(`no fixture group for ${project}`)
  return group
}

/** The count on a fresh browser's intro: "n of total have answered" */
async function countFromLink(browser: Browser, baseURL: string, code: string): Promise<number> {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await page.goto(`/j/${code}`)
  const text = (await page.getByText(/have answered\. Counts only, never names\./).textContent()) ?? ''
  await context.close()
  return Number(/^(\d+) of/.exec(text)?.[1] ?? NaN)
}

test('a member answers through the link, submits anonymously, and the same browser replaces its answers', async ({ page, browser, baseURL }, info) => {
  const { group, scan } = groupFor(info.project.name)
  const problems = watch(page)
  const fromBrowser: string[] = []
  page.on('request', (r) => {
    if (/\/(rest|auth)\/v1\//.test(r.url())) fromBrowser.push(r.url())
  })
  const before = await countFromLink(browser, baseURL!, scan.code)
  test.skip(!(before < scan.size - 1), 'the flow group is nearly full: run scripts/seed/fixture.mjs --e2e again')

  // the intro: how answers are kept and when the team view opens; a count, never a name
  await page.goto(`/j/${scan.code}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Leadership Team Scan' })).toBeVisible()
  await expect(page.getByText(group.name)).toBeVisible()
  await expect(page.getByText('They are stored without your name or any account.')).toBeVisible()
  await expect(page.getByText(`${before} of ${scan.size} have answered. Counts only, never names.`)).toBeVisible()
  await expect(page.getByText(/The team view opens for everyone when the scan closes/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Start the scan' })).toHaveCount(0)
  await axe(page)

  await page.getByRole('button', { name: 'Start' }).click()
  await answerScan(page, VALUES, 'See my view')

  // the personal view, then the one action
  await expect(page.getByRole('heading', { level: 1, name: 'Your reading of the team' })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(6)
  await expect(page.getByText('Research-based, not yet validated')).toBeVisible()
  await axe(page)
  await page.getByRole('button', { name: 'Submit anonymously' }).click()
  await expect(page.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
  await expect(page.getByText('Until it closes, answering again from this browser replaces your answers.')).toBeVisible()
  await axe(page)
  expect(await countFromLink(browser, baseURL!, scan.code)).toBe(before + 1)

  // the same browser comes back: it is told its answers are in, and answering again replaces them
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
  await page.getByRole('button', { name: 'Answer again' }).click()
  await answerScan(page, VALUES.map((v) => 6 - v), 'See my view')
  await page.getByRole('button', { name: 'Submit anonymously' }).click()
  await expect(page.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
  expect(await countFromLink(browser, baseURL!, scan.code)).toBe(before + 1)

  // the answers left the browser only through the page's own server: never to the database directly
  expect(fromBrowser).toEqual([])
  expect(problems).toEqual([])
})

test('a link that leads nowhere says so', async ({ page }) => {
  await page.goto('/j/noSuchScanCodeNoSuchScan01')
  await expect(page.getByRole('heading', { level: 1, name: 'This link does not lead to a scan' })).toBeVisible()
  await axe(page)
})
