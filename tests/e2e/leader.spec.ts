import { expect, test, type Browser, type Page } from '@playwright/test'
import { FLOW_LEADER, LUMIO } from '../../scripts/seed/fixture.mjs'
import { canReadMail, signInLink } from './support/mail'
import { answerScan, axe, watch } from './support/page'
import { canMintSession, signInAs } from './support/session'

/**
 * Milestone 4's "done when" (handoff 12): eight browsers answer through one link, and the leader sees
 * counts only. Handoff 13's flow "leader saves, invites, members answer", up to the close; the team view
 * itself is milestone 5.
 *
 * The leader takes the scan, saves it with a group of 10, and signs in: in CI by the email link from
 * Mailpit, in a cloud session with a session minted for the fixture's flow leader (D-27). Then eight
 * browsers answer and one replaces its answers. There is no team view yet; a tenth answer closes the scan,
 * and the team view appears, the same for the leader and for a later browser on the link (milestone 5).
 * Last, another group's page is refused and the leader signs out.
 */
test.skip(!canReadMail() && !canMintSession(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')

const LEADER_ANSWERS = [3, 4, 4, 2, 3, 5, 4, 3, 2, 3, 4, 4]
const SIZE = 10

async function member(browser: Browser, baseURL: string, link: string, n: number) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await page.goto(link)
  await page.getByRole('button', { name: 'Start' }).click()
  await answerScan(page, LEADER_ANSWERS.map((v, i) => ((v + i + n) % 5) + 1), 'See my view')
  await page.getByRole('button', { name: 'Submit anonymously' }).click()
  await expect(page.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
  return { context, page }
}

async function expectCountsOnly(page: Page, answered: number) {
  await page.reload()
  await expect(page.getByText(`${answered} of ${SIZE} have answered. Counts only, never names.`)).toBeAttached()
  await expect(page.getByText('have answered. Counts only, never names.', { exact: true })).toBeVisible()
  // never a score: no level, no theme, no agreement on the leader's page
  await expect(page.getByRole('meter')).toHaveCount(0)
  await expect(page.getByText(/Purpose and priorities|Safety and trust|agree on|Views differ|\d\.\d/)).toHaveCount(0)
}

test('the leader saves, signs in and invites; eight browsers answer through one link; the leader sees counts only', async ({ page, browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'eleven browsers: run once, at 1280 px')
  test.setTimeout(300_000)
  const problems = watch(page)
  const email = canReadMail() ? `leader-${Date.now()}@lumio.example` : FLOW_LEADER.email

  // the leader's scan and the save card
  await page.goto('/scan')
  await answerScan(page, LEADER_ANSWERS, 'See my view')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Group name').fill('Flow leadership group')
  await page.getByRole('button', { name: 'One member more' }).click()
  await page.getByRole('button', { name: 'One member more' }).click()
  await expect(page.getByLabel('Members, including you')).toHaveValue(String(SIZE))
  await axe(page)
  await page.getByRole('button', { name: 'Save and get the invite link' }).click()

  if (canReadMail()) {
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByText(`We sent a sign-in link to ${email}. It works once, for 15 minutes.`)).toBeVisible()
    // opening the link signs nobody in: its button does
    await page.goto(await signInLink(email))
    await expect(page.getByRole('heading', { name: 'Finish signing in' })).toBeVisible()
    await axe(page)
    await page.getByRole('button', { name: 'Sign in' }).click()
  } else {
    // no Auth here to send a link: the save is on the device, so sign in as the flow leader
    await expect(page.getByText('The link could not be sent. Try again in a few minutes.')).toBeVisible()
    await signInAs(page.context(), FLOW_LEADER, baseURL!)
    await page.goto('/app/new')
  }

  // the group is made, the leader's own answers count as 1 (owner C4), and the link is shown
  await expect(page).toHaveURL(/\/app\/[0-9a-f-]{36}\/invite$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Invite your group' })).toBeVisible()
  await expect(page.getByText('Flow leadership group')).toBeVisible()
  await expectCountsOnly(page, 1)
  await expect(page.getByText('The team view opens when the scan closes', { exact: true })).toBeVisible()
  await axe(page)
  const link = await page.getByLabel("The group's invite link").inputValue()
  expect(link).toMatch(/\/j\/[A-Za-z0-9_-]{22}$/)
  const path = new URL(link).pathname

  // eight browsers answer through the one link
  const members = []
  for (let n = 0; n < 8; n += 4) {
    members.push(...(await Promise.all([0, 1, 2, 3].map((i) => member(browser, baseURL!, path, n + i)))))
  }
  await expectCountsOnly(page, 9)

  // one of them answers again: its answers are replaced, and the count stays
  const again = members[0]!.page
  await again.getByRole('button', { name: 'Answer again' }).click()
  await answerScan(again, LEADER_ANSWERS, 'See my view')
  await again.getByRole('button', { name: 'Submit anonymously' }).click()
  await expect(again.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
  await expectCountsOnly(page, 9)

  // before the close there is no team view, for the leader or for the link (handoff 6.6, milestone 5)
  const groupPath = new URL(page.url()).pathname.replace(/\/invite$/, '')
  await page.goto(`${groupPath}/team`)
  await expect(page.getByText('The team view opens when the scan closes', { exact: true })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(0)
  await page.goto(`${groupPath}/invite`)

  // the tenth answer takes the last seat: the scan closes at once (handoff 6.4)
  const last = await member(browser, baseURL!, path, 9)
  await expect(last.page.getByText('Yours was the last answer, so the scan has closed.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('The scan has closed', { exact: true })).toBeVisible()
  await expect(page.getByText(`${SIZE} of ${SIZE} answered. Answers after the close are not added.`)).toBeVisible()
  await expect(page.getByLabel("The group's invite link")).toHaveCount(0)
  await axe(page)

  // and the team view appears, the same for the leader and for everyone with the link
  await page.getByRole('link', { name: 'The team view is open' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Team view' })).toBeVisible()
  await expect(page.getByRole('meter')).toHaveCount(6)
  await expect(page.getByText(`${SIZE} of ${SIZE} answered. Counts only, never names.`)).toBeAttached()
  const leaderSees = await page.getByRole('meter').evaluateAll((m) => m.map((x) => x.getAttribute('aria-valuetext')))
  const late = await browser.newContext({ baseURL })
  const latePage = await late.newPage()
  await latePage.goto(path)
  await expect(latePage.getByRole('heading', { level: 1, name: 'Team view' })).toBeVisible()
  expect(await latePage.getByRole('meter').evaluateAll((m) => m.map((x) => x.getAttribute('aria-valuetext')))).toEqual(leaderSees)

  for (const m of [...members, last]) await m.context.close()
  await late.close()

  // another group's page is not shown to the leader, and signing out closes the pages behind sign-in
  await page.goto(`/app/${LUMIO.group.id}/invite`)
  await expect(page.getByRole('heading', { level: 1, name: 'This group is not one of yours' })).toBeVisible()
  await expect(page.getByText(LUMIO.group.name)).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/leadership-team-assessment$/)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/sign-in$/)
  expect(problems).toEqual([])
})
