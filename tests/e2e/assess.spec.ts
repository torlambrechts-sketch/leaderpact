import { expect, test, type Browser, type Page } from '@playwright/test'
import { ROUND_FLOW, ROUND_STATES } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { OPTION, axe, watch } from './support/page'

/**
 * Milestone 10 (handoff 12; D-43): the diagnostic round, open, invite, answer. On the round flow's group
 * (scripts/seed/fixture.mjs, ROUND_FLOW), on its trial with five members: the leader opens the Full
 * diagnostic, everyone is asked, and the count is "0 of 5 answered", never a name. The leader answers with a
 * gap, which the review lists and waits for; progress survives a reload. A member answers on a phone-width
 * screen. On the round states' group, the other phases read as they are. Reminders and the close are the
 * database's: supabase/tests/diagnostic_invariants.sql proves "reminders go only to people who have not
 * answered" and "close computes scores once".
 */
const assess = (group: string) => `/app/${group}/assess`
const QUESTIONS = 72

async function signedIn(browser: Browser, baseURL: string, person: { id: string; email: string }) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signInPerson(page, baseURL, person)
  return { context, page }
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

/** Answers from the question on screen to the last, leaving the questions in `skip` (1-based) without an answer */
async function answerRound(page: Page, from: number, skip: readonly number[] = [], value = 4) {
  for (let n = from; n <= QUESTIONS; n++) {
    await expect(page.getByText(`${n} of ${QUESTIONS}`, { exact: true })).toBeVisible()
    if (!skip.includes(n)) await page.getByRole('radio', { name: OPTION[value], exact: true }).click()
    await page.getByRole('button', { name: n === QUESTIONS ? 'Review' : 'Next' }).click()
  }
}

test('the diagnostic round: the leader opens it, everyone is asked, answers come in as counts only', async ({ browser, baseURL }, info) => {
  // Auth sends one address one link per interval, so each person signs in once, here (D-27)
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, with a phone-width member; two people sign in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(240_000)
  const leader = await signedIn(browser, baseURL!, ROUND_FLOW.leader)
  const member = await signedIn(browser, baseURL!, ROUND_FLOW.member)
  const lp = leader.page
  const mp = member.page
  const problems = watch(lp)

  // no round yet: the leader may open one, a member is told who does
  await lp.goto(assess(ROUND_FLOW.group.id))
  await expect(lp.getByRole('heading', { level: 1, name: 'Assess' })).toBeVisible()
  await expect(lp.getByText('Sample', { exact: true })).toHaveCount(0)
  await expect(lp.getByText(/^No rounds yet\./)).toBeVisible()
  await expect(lp.getByText(`${QUESTIONS} questions on how the group works, about 10 minutes each. Every current member is asked: 5 people. It stays open for 14 days.`)).toBeVisible()
  await axe(lp)
  await mp.goto(assess(ROUND_FLOW.group.id))
  await expect(mp.getByText('No rounds yet. Your team leader opens the Full diagnostic, and everyone in the group is asked at once.')).toBeVisible()
  await expect(mp.getByRole('button', { name: 'Open the Full diagnostic' })).toHaveCount(0)

  // opened, after asking once more: every member asked, a count and no name
  await lp.getByRole('button', { name: 'Open the Full diagnostic' }).click()
  await expect(lp.getByText('Open it now for all 5 members?')).toBeFocused()
  await lp.getByRole('button', { name: 'Open it now' }).click()
  const rounds = lp.getByRole('list', { name: 'Rounds' })
  await expect(rounds.getByRole('heading', { name: 'Full diagnostic · round 1' })).toBeVisible()
  await expect(rounds.getByText('0 of 5 answered')).toBeVisible()
  await expect(rounds.getByText('Counts only, never names')).toBeVisible()
  await expect(lp.getByText('One round at a time: the next one can open when this one closes.')).toBeVisible()
  for (const person of ROUND_FLOW.people) await expect(lp.getByRole('main').getByText(person.name, { exact: true })).toHaveCount(0)
  await axe(lp)

  // the leader answers: the intro, a gap left on question 2, progress kept over a reload
  await rounds.getByRole('link', { name: 'Answer now' }).click()
  await expect(lp.getByRole('heading', { level: 1, name: 'Full diagnostic' })).toBeVisible()
  await expect(lp.getByText(`${QUESTIONS} statements, one per screen, in mixed order. It takes about 10 minutes.`)).toBeVisible()
  await expect(lp.getByText('They are stored with a random ID, never with your name.')).toBeVisible()
  await axe(lp)
  await lp.getByRole('button', { name: 'Start' }).click()
  await expect(lp.getByText(`1 of ${QUESTIONS}`, { exact: true })).toBeVisible()
  await axe(lp)
  for (let n = 1; n <= 10; n++) {
    if (n !== 2) await lp.getByRole('radio', { name: OPTION[4], exact: true }).click()
    await lp.getByRole('button', { name: 'Next' }).click()
  }
  const eleventh = await lp.getByRole('heading', { level: 1 }).textContent()
  await lp.reload()
  await lp.getByRole('button', { name: 'Continue' }).click()
  await expect(lp.getByRole('heading', { level: 1, name: eleventh! })).toBeVisible()
  await answerRound(lp, 11)

  await expect(lp.getByRole('heading', { name: 'Review your answers' })).toBeFocused()
  await expect(lp.getByText('1 question has no answer yet. Every question needs one.')).toBeVisible()
  await expect(lp.getByRole('button', { name: 'Submit anonymously' })).toBeDisabled()
  await axe(lp)
  await lp.getByRole('list', { name: 'Questions without an answer' }).getByRole('button').click()
  await expect(lp.getByText(`2 of ${QUESTIONS}`, { exact: true })).toBeVisible()
  await lp.getByRole('radio', { name: OPTION[3], exact: true }).click()
  await lp.getByRole('button', { name: 'Review' }).click()
  await expect(lp.getByText(`All ${QUESTIONS} questions have an answer.`)).toBeVisible()
  await lp.getByRole('button', { name: 'Submit anonymously' }).click()
  await expect(lp.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
  await lp.getByRole('link', { name: 'Back to Assess' }).click()
  await expect(rounds.getByText('1 of 5 answered')).toBeVisible()
  await expect(rounds.getByText('You answered')).toBeVisible()
  await expect(rounds.getByRole('link', { name: 'Answer now' })).toHaveCount(0)

  // a member answers on a phone-width screen; Home asks them first
  await mp.setViewportSize({ width: 360, height: 780 })
  await mp.goto(`/app/${ROUND_FLOW.group.id}/home`)
  await expect(mp.getByText('Answer the Full diagnostic')).toBeVisible()
  await mp.goto(assess(ROUND_FLOW.group.id))
  await expect(mp.getByText('1 of 5 answered')).toBeVisible()
  expect(await sideways(mp)).toBe(false)
  await mp.getByRole('link', { name: 'Answer now' }).click()
  await mp.getByRole('button', { name: 'Start' }).click()
  expect(await sideways(mp)).toBe(false)
  await answerRound(mp, 1, [], 2)
  await expect(mp.getByText(`All ${QUESTIONS} questions have an answer.`)).toBeVisible()
  expect(await sideways(mp)).toBe(false)
  await mp.getByRole('button', { name: 'Submit anonymously' }).click()
  await expect(mp.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
  await mp.getByRole('link', { name: 'Back to Assess' }).click()
  await expect(mp.getByText('2 of 5 answered')).toBeVisible()
  await expect(mp.getByText('You answered')).toBeVisible()

  // the other phases, on the round states' group: released, closed with no result, answering with a count
  await lp.goto(assess(ROUND_STATES.group.id))
  const states = lp.getByRole('list', { name: 'Rounds' })
  await expect(states.getByRole('listitem').filter({ has: lp.getByRole('heading', { name: /^Full diagnostic · round/ }) })).toHaveCount(4)
  await expect(states.getByText('3 of 5 answered')).toBeVisible()
  await expect(states.getByText('Fewer than 4 answered, so no result was made and the answers were deleted.')).toBeVisible()
  await expect(states.getByText('The result was computed once, when the round closed.')).toHaveCount(2)
  await expect(states.getByRole('link', { name: 'See the results' })).toHaveCount(2)
  await expect(lp.getByRole('button', { name: 'Open the Full diagnostic' })).toHaveCount(0)
  await axe(lp)

  expect(problems).toEqual([])
  await leader.context.close()
  await member.context.close()
})
