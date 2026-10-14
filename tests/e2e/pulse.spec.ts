import { expect, test, type Browser, type Page } from '@playwright/test'
import { PULSE_FLOW, PULSE_STATES } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { OPTION, axe, watch } from './support/page'

/**
 * Milestone 15 (handoff 6.16; D-52): "A pulse assembles in the right order, closes after 7 days and shows change
 * only from 0.6." On the pulse flow's group (scripts/seed/fixture.mjs, PULSE_FLOW), with two focus areas and three
 * agreements: the next pulse lists the focus areas' six questions, then the three agreements, then one rotating
 * question; the leader starts the pulses and a member answers the first. On the pulses' states group, pulse 2's
 * result shows a change of 1.0 and of 0.6, and 0.5 as within normal variation; pulse 3 reads as missed. The
 * closing after 7 days, and the change rule itself, are proved in supabase/tests/pulse_invariants.sql.
 */
const assess = (group: string) => `/app/${group}/assess`
const FORBIDDEN = /\b(median|lowest|highest|standard deviation|SD|rwg|confidence|distribution|percentile)\b|%/i

async function signedIn(browser: Browser, baseURL: string, person: { id: string; email: string }) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signInPerson(page, baseURL, person)
  return { context, page }
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

test('pulses: built in order, started by the leader, answered by a member', async ({ browser, baseURL }, info) => {
  // Auth sends one address one link per interval, so each person signs in once, here (D-27)
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, with a phone-width member; two people sign in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(180_000)
  const leader = await signedIn(browser, baseURL!, PULSE_FLOW.leader)
  const member = await signedIn(browser, baseURL!, PULSE_FLOW.member)
  const lp = leader.page
  const mp = member.page
  const problems = watch(lp)

  // not running yet; the next pulse, in the order it is built: six focus questions, three agreements, one rotating
  await lp.goto(assess(PULSE_FLOW.group.id))
  await expect(lp.getByRole('heading', { level: 1, name: 'Assess' })).toBeVisible()
  await expect(lp.getByText(/^Pulses are not running\./)).toBeVisible()
  const next = lp.getByRole('list', { name: 'Next pulse' })
  const sources = await next.getByRole('listitem').evaluateAll((items) => items.map((li) => li.querySelector('span.rounded-pill')?.textContent ?? ''))
  expect(sources).toHaveLength(10)
  expect(sources.slice(0, 6).every((s) => /^Focus · (Clear purpose|Trust)$/.test(s))).toBe(true)
  expect(new Set(sources.slice(0, 3)).size).toBe(1)
  expect(new Set(sources.slice(3, 6)).size).toBe(1)
  expect(sources.slice(6, 9)).toEqual(['Working agreement', 'Working agreement', 'Working agreement'])
  expect(sources[9]).toMatch(/^Rotating · /)
  await expect(next.getByText(`In the last 4 weeks we kept this agreement: «${PULSE_FLOW.agreements[0]}»`)).toBeVisible()
  await expect(lp.getByText('10 of 10 questions')).toBeVisible()
  await axe(lp)

  // a member reads the same list and who starts them
  await mp.goto(assess(PULSE_FLOW.group.id))
  await expect(mp.getByText('Your team leader starts them.')).toBeVisible()
  await expect(mp.getByRole('button', { name: 'Start pulses' })).toHaveCount(0)
  await expect(mp.getByRole('list', { name: 'Next pulse' }).getByRole('listitem')).toHaveCount(10)

  // started, after asking once more: pulse 1 opens for everyone, a count and no name
  await expect(lp.getByLabel('Every')).toHaveValue('4')
  await expect(lp.getByLabel('Open for')).toHaveValue('7')
  await lp.getByRole('button', { name: 'Start pulses' }).click()
  await expect(lp.getByText('Start pulses now for all 5 members?')).toBeFocused()
  await lp.getByRole('button', { name: 'Start now' }).click()
  await expect(lp.getByText(/^Every 4 weeks, open for 7 days\. The next pulse opens on \d{1,2} \w+ \d{4}\.$/)).toBeVisible()
  const pulse = lp.getByRole('listitem').filter({ has: lp.getByRole('heading', { name: 'Pulse 1' }) })
  await expect(pulse.getByText('0 of 5 answered')).toBeVisible()
  await expect(pulse.getByText('Counts only, never names')).toBeVisible()
  await expect(lp.getByRole('button', { name: 'Change the rhythm' })).toBeVisible()
  await axe(lp)

  // the member answers on a phone-width screen: ten statements, one per screen, then the review
  await mp.setViewportSize({ width: 390, height: 844 })
  await mp.goto(`/app/${PULSE_FLOW.group.id}/home`)
  await expect(mp.getByText('Answer pulse 1')).toBeVisible()
  await mp.goto(assess(PULSE_FLOW.group.id))
  await mp
    .getByRole('listitem')
    .filter({ has: mp.getByRole('heading', { name: 'Pulse 1' }) })
    .getByRole('link', { name: 'Answer now' })
    .click()
  await expect(mp.getByRole('heading', { level: 1, name: 'Pulse 1' })).toBeVisible()
  await expect(mp.getByText('10 statements, one per screen, in mixed order. It takes a minute or two.')).toBeVisible()
  await mp.getByRole('button', { name: 'Start' }).click()
  for (let n = 1; n <= 10; n++) {
    await expect(mp.getByText(`${n} of 10`, { exact: true })).toBeVisible()
    await mp.getByRole('radio', { name: OPTION[4], exact: true }).click()
    await mp.getByRole('button', { name: n === 10 ? 'Review' : 'Next' }).click()
  }
  await expect(mp.getByText('All 10 questions have an answer.')).toBeVisible()
  await mp.getByRole('button', { name: 'Submit anonymously' }).click()
  await expect(mp.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
  expect(await sideways(mp)).toBe(false)

  await lp.reload()
  await expect(pulse.getByText('1 of 5 answered')).toBeVisible()
  expect(problems).toEqual([])
  await member.context.close()
  await leader.context.close()
})

test("a pulse's result: change from 0.6, within normal variation at 0.5; a missed pulse", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, with a phone-width pass; one person signs in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(120_000)
  await signInPerson(page, baseURL!, PULSE_STATES.member)
  const problems = watch(page)

  // the list: pulse 3 missed, pulses 2 and 1 released, the rhythm running
  await page.goto(assess(PULSE_STATES.group.id))
  const row = (name: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) })
  await expect(row('Pulse 3').getByText('Missed: fewer than 4 answered, so no result was made and the answers were deleted.')).toBeVisible()
  await expect(row('Pulse 2').getByText('The result was computed once, when the round closed.')).toBeVisible()
  await expect(page.getByText(/^Every 4 weeks, open for 7 days\. The next pulse opens on /)).toBeVisible()
  await axe(page)

  // pulse 2: focus scales with level, label and standing; change from the pulse that asked them last
  await row('Pulse 2').getByRole('link', { name: 'See the results' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Results' })).toBeVisible()
  await expect(page.getByText(`${PULSE_STATES.group.name} · Pulse 2`)).toBeVisible()
  await expect(page.getByText(/5 of 5 answered\. Counts only, never names\.$/)).toBeVisible()
  await expect(page.getByText('Research-based, not yet validated · scale 1–5')).toBeVisible()
  const scale = (name: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) })
  await expect(scale('Clear purpose').getByText('Change: +1.0')).toBeAttached()
  await expect(scale('Clear purpose').getByText('Level 4.0')).toBeAttached()
  await expect(scale('Trust').getByText('Change: Within normal variation')).toBeAttached()
  await expect(scale('Trust').getByText('Level 3.5')).toBeAttached()
  const agreement = (text: string) => page.getByRole('listitem').filter({ hasText: `«${text}»` })
  await expect(agreement(PULSE_STATES.agreements[0]!).getByText('Change: +0.6')).toBeAttached()
  await expect(agreement(PULSE_STATES.agreements[1]!).getByText('Change: Within normal variation')).toBeAttached()
  await expect(page.getByRole('heading', { level: 2, name: 'The questions' })).toBeVisible()
  await expect(page.getByText(/^Change compares each focus area and agreement with the last pulse that asked it\. It shows at 0\.6 points or more\.$/)).toBeVisible()
  expect((await page.getByRole('main').textContent()) ?? '').not.toMatch(FORBIDDEN)
  await axe(page)

  // pulse 1: nothing asked before, so no change
  await page.goto(`/app/${PULSE_STATES.group.id}/results`)
  await page.getByRole('navigation', { name: 'Pulses with a result' }).getByRole('link', { name: 'Pulse 1' }).click()
  await expect(page.getByText(`${PULSE_STATES.group.name} · Pulse 1`)).toBeVisible()
  await expect(page.getByText('Change: Not asked before').first()).toBeAttached()
  await expect(page.getByText(/^Change: [+−]/)).toHaveCount(0)

  // on a phone: no sideways scroll
  await page.setViewportSize({ width: 360, height: 780 })
  await page.reload()
  expect(await sideways(page)).toBe(false)
  expect(problems).toEqual([])
})
