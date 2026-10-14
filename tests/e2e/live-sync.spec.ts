import { expect, test, type Browser } from '@playwright/test'
import { SYNC_FLOW } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { watch } from './support/page'

/**
 * Milestone 14 (handoff 12; D-51): "Two browsers stay in sync within 1 second. Comments carry no sender." Four
 * members of the sync flow's group (scripts/seed/fixture.mjs, SYNC_FLOW) in one live meeting over Supabase
 * Realtime: the leader's start and close reach the others within a second; with four online, a member's
 * process comment reaches everyone within a second, saying "Someone", never who. It needs Realtime, so it runs
 * where CI sets LIVE_FLOW: on pushes to main, nightly and by hand (owner, A5).
 */
const meetings = `/app/${SYNC_FLOW.group.id}/meetings`
const SECOND = 1_000

async function signedIn(browser: Browser, baseURL: string, person: { id: string; email: string }) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signInPerson(page, baseURL, person)
  return { context, page }
}

test('four browsers in one live meeting: in sync within a second, and comments with no sender', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px; four people sign in')
  test.skip(process.env.LIVE_FLOW !== '1', 'needs Realtime: CI sets LIVE_FLOW on pushes to main, nightly and by hand (owner, A5)')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(240_000)
  const [leader, ...members] = await Promise.all(SYNC_FLOW.people.slice(0, 4).map((p) => signedIn(browser, baseURL!, p)))
  const lp = leader!.page
  const problems = watch(lp)

  // the leader starts the meeting; the others join it from the agenda
  await lp.goto(meetings)
  await lp.getByRole('button', { name: 'Start the meeting' }).click()
  await expect(lp.getByRole('heading', { level: 1, name: 'Live meeting' })).toBeVisible()
  const live = lp.url()
  for (const { page } of members) {
    await page.goto(live)
    await expect(page.getByText('In sync')).toBeVisible({ timeout: 15 * SECOND })
  }
  await expect(lp.getByText('In sync')).toBeVisible({ timeout: 15 * SECOND })

  // the leader's controls reach every other browser within a second
  await lp.getByRole('button', { name: 'Start', exact: true }).click()
  for (const { page } of members) await expect(page.getByText(/^Running · time box 10 min$/)).toBeVisible({ timeout: SECOND })
  await lp.getByRole('button', { name: 'Reached' }).click()
  for (const { page } of members) await expect(page.getByRole('heading', { level: 2, name: SYNC_FLOW.meeting.items[1] })).toBeVisible({ timeout: SECOND })

  // four online: comments open; one sent reaches everyone, with no sender
  for (const { page } of [leader!, ...members]) await expect(page.getByText('4 online')).toBeVisible({ timeout: 15 * SECOND })
  const sender = members[0]!.page
  await sender.getByRole('button', { name: 'We are off track' }).click()
  for (const { page } of [leader!, ...members.slice(1)]) {
    const heard = page.getByRole('status').filter({ hasText: 'Someone said: We are off track' })
    await expect(heard).toBeVisible({ timeout: SECOND })
    for (const person of SYNC_FLOW.people) await expect(heard).not.toContainText(person.name)
    await expect(page.getByText('We are off track · 1')).toBeVisible({ timeout: SECOND })
  }

  // the end reaches everyone: each page becomes the summary
  await lp.getByRole('button', { name: 'End the meeting' }).click()
  await lp.getByRole('button', { name: 'End it' }).click()
  for (const { page } of members) await expect(page.getByRole('heading', { level: 1, name: 'Meeting summary' })).toBeVisible({ timeout: 5 * SECOND })

  expect(problems).toEqual([])
  await Promise.all([leader!, ...members].map(({ context }) => context.close()))
})
