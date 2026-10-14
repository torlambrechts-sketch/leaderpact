import { expect, test } from '@playwright/test'
import { LIVE_FLOW } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 14 (handoff 6.15; D-50), in one browser: the leader starts the meeting from its agenda, runs the
 * timer (start, pause, plus 5 minutes), saves a decision, adds an action (refused without an owner), parks a
 * side topic, closes items as reached and carried over, and ends the meeting, which shows its summary.
 * Process comments stay closed with one person online. In CI the page joins Realtime ("In sync"); in a cloud
 * session with no Realtime the fixture turns the live_meeting flag off and the meeting runs without sync. The
 * four-browser sync is tests/e2e/live-sync.spec.ts.
 */
const meetings = `/app/${LIVE_FLOW.group.id}/meetings`

test('the live meeting in one browser: timer, decision, action, parking lot, closing items, summary', async ({ page, baseURL }, info) => {
  // Auth sends one address one link per interval, so the leader signs in once, here (D-27)
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, with a phone-width pass; one person signs in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(180_000)
  await signInPerson(page, baseURL!, LIVE_FLOW.leader)
  const problems = watch(page)

  // from the agenda, the leader starts it
  await page.goto(meetings)
  await expect(page.getByRole('heading', { level: 2, name: LIVE_FLOW.meeting.title })).toBeVisible()
  await page.getByRole('button', { name: 'Start the meeting' }).click()
  await expect(page).toHaveURL(new RegExp(`${meetings}/[0-9a-f-]{36}$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Live meeting' })).toBeVisible()
  await expect(page.getByText(/^(In sync|Without sync)$/)).toBeVisible()
  await expect(page.getByText('Item 1 of 3')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: LIVE_FLOW.meeting.items[0] })).toBeVisible()
  await expect(page.getByText('10:00 left')).toBeAttached()
  await expect(page.getByText(/^Paused · time box 10 min$/)).toBeVisible()
  await axe(page)

  // the timer: start, pause, plus 5 minutes
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByText(/^Running · time box 10 min$/)).toBeVisible()
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText(/^Paused · time box 10 min$/)).toBeVisible()
  await page.getByRole('button', { name: '+5 minutes' }).click()
  await expect(page.getByText(/^Paused · time box 15 min$/)).toBeVisible()

  // process comments stay closed with one person online
  await expect(page.getByText('Process comments open when 4 or more are online. 1 online now.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'We are off track' })).toBeDisabled()

  // a decision, an action (refused without an owner), a side topic
  await page.getByLabel('What was decided').fill('We hire four, not six.')
  await page.getByRole('button', { name: 'Save the decision' }).click()
  await expect(page.getByText('Saved. Saving again replaces it.')).toBeVisible()
  const due = new Date(Date.now() + 14 * 86_400_000)
  const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
  await page.getByLabel('What will be done').fill('Write the four job descriptions')
  await page.getByLabel('Due date').fill(iso)
  await page.getByRole('button', { name: 'Add the action' }).click()
  await expect(page.getByText('Pick an owner. An action without an owner cannot be saved.')).toBeVisible()
  await page.getByLabel('Owner').selectOption({ label: LIVE_FLOW.people[1]!.name })
  await page.getByRole('button', { name: 'Add the action' }).click()
  await expect(page.getByRole('list', { name: 'Actions', exact: true }).getByText('Write the four job descriptions')).toBeVisible()
  await page.getByLabel('A side topic').fill('The office party')
  await page.getByRole('button', { name: 'Park it' }).click()
  await expect(page.getByRole('list', { name: 'Parking lot' }).getByText('The office party')).toBeVisible()
  await axe(page)

  // closing items: reached, then carried over; the next open one is taken up each time
  await page.getByRole('button', { name: 'Reached' }).click()
  await expect(page.getByText('Item 2 of 3')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: LIVE_FLOW.meeting.items[1] })).toBeVisible()
  const agenda = page.getByRole('list', { name: 'Agenda' })
  await expect(agenda.getByRole('listitem').first().getByText('Reached')).toBeVisible()
  await page.getByRole('button', { name: 'Carried over' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Reflection' })).toBeVisible()

  // the end: the summary of items, decisions and new actions
  await page.getByRole('button', { name: 'End the meeting' }).click()
  await expect(page.getByText('End the meeting now?')).toBeVisible()
  await page.getByRole('button', { name: 'End it' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting summary' })).toBeVisible()
  await expect(page.getByText('3 items, 1 decision and 1 new action.')).toBeVisible()
  const items = page.getByRole('list', { name: 'Items' })
  const summaryItem = (title: string) => items.locator(':scope > li').filter({ has: page.getByRole('heading', { name: title }) })
  await expect(summaryItem(`1. ${LIVE_FLOW.meeting.items[0]}`).getByText('Reached', { exact: true })).toBeVisible()
  await expect(summaryItem(`2. ${LIVE_FLOW.meeting.items[1]}`).getByText('Carried over', { exact: true })).toBeVisible()
  await expect(summaryItem('3. Reflection').getByText('Not reached', { exact: true })).toBeVisible()
  await expect(page.getByText('We hire four, not six.')).toBeVisible()
  await expect(page.getByText('Write the four job descriptions')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Parking lot' }).getByText('The office party')).toBeVisible()
  await axe(page)

  // the agenda says it is over; the action is on the Plan page, from the meeting
  await page.getByRole('link', { name: 'See the agenda' }).click()
  await expect(page.getByText('This meeting is over.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'See the summary' })).toBeVisible()
  await page.goto(`/app/${LIVE_FLOW.group.id}/plan`)
  await expect(page.getByRole('region', { name: 'Actions from meetings' }).getByText('Write the four job descriptions')).toBeVisible()

  // on a phone: the summary, with no sideways scroll
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goBack()
  await page.getByRole('link', { name: 'See the summary' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meeting summary' })).toBeVisible()
  await axe(page)

  expect(problems).toEqual([])
})
