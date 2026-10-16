import { expect, test, type Browser, type Page } from '@playwright/test'
import { CHAIN_FLOW } from '../../scripts/seed/fixture.mjs'
import { canPassDeadline, passRoundDeadline } from './support/deadline'
import { canSignIn, signInPerson } from './support/leader'
import { OPTION, axe, watch } from './support/page'

/**
 * Handoff 13, the flows: "Upgrade, charter, diagnostic round, results, focus area, action, agenda." One group walks
 * the whole loop in order (D-56), where the milestone flows each start from a fixture state of their own. On the
 * chained flow's group (scripts/seed/fixture.mjs, CHAIN_FLOW), on the Free plan with five people and nothing else:
 * the leader starts the Team plan's trial from Plan and billing, agrees a charter, and opens the Full diagnostic.
 * Four of the five answer it, each in a browser of their own, and the results page shows a count and no score. The
 * closing date passes and the round closes (0007 close_round, as diagnostic_invariants.sql does). The results show
 * a level, an agreement label and a standing on every row, and nothing forbidden. The leader makes one scale a focus
 * area, gives it an action with an owner, and plans a meeting whose agenda lists that open action.
 */
const at = (page: string) => `/app/${CHAIN_FLOW.group.id}/${page}`
const QUESTIONS = 72
const PURPOSE = 'We set the direction and decide what only this group can decide.'
const TASK = 'Set strategy and yearly priorities'
const ACTION = 'Agree the purpose in one sentence'
const FORBIDDEN = /\b(median|lowest|highest|standard deviation|SD|rwg|confidence|distribution|percentile)\b|%/i
const STANDING = /Strength|Keep watching|Priority|Views differ|Fact, no target|Read with relationship conflict/

// who answers, and with what: the leader and three members, every question alike, so each scale reads high agreement
const ANSWERS = [2, 3, 2, 2]

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

async function nothingForbidden(page: Page) {
  const text = (await page.getByRole('main').textContent()) ?? ''
  expect(text).not.toMatch(FORBIDDEN)
}

/** Opens the round from Assess, answers every question with one value, and submits */
async function answerRound(page: Page, value: number, answered: number) {
  await page.goto(at('assess'))
  await expect(page.getByText(`${answered} of 5 answered`)).toBeVisible()
  await page.getByRole('list', { name: 'Rounds' }).getByRole('link', { name: 'Answer now' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  for (let n = 1; n <= QUESTIONS; n++) {
    await expect(page.getByText(`${n} of ${QUESTIONS}`, { exact: true })).toBeVisible()
    await page.getByRole('radio', { name: OPTION[value], exact: true }).click()
    await page.getByRole('button', { name: n === QUESTIONS ? 'Review' : 'Next' }).click()
  }
  await expect(page.getByText(`All ${QUESTIONS} questions have an answer.`)).toBeVisible()
  await page.getByRole('button', { name: 'Submit anonymously' }).click()
  await expect(page.getByRole('heading', { name: 'Your answers are in' })).toBeVisible()
}

test('one group, in order: upgrade, charter, diagnostic round, results, focus area, action and agenda', async ({ browser, baseURL }, info) => {
  // Auth sends one address one link per interval, so each person signs in once, here (D-27)
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px: the flow takes its group through for good; four people sign in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.skip(!canPassDeadline(), 'no local database: needs DB_URL (CI) or DATABASE_URL (local-pg.sh)')
  test.setTimeout(300_000)
  const watched: string[][] = []
  async function signedIn(b: Browser, person: { id: string; email: string }) {
    const context = await b.newContext({ baseURL })
    const page = await context.newPage()
    await signInPerson(page, baseURL!, person)
    watched.push(watch(page))
    return { context, page }
  }
  const [lead, owner, ...others] = CHAIN_FLOW.people
  const leader = await signedIn(browser, lead!)
  const lp = leader.page

  // ---- upgrade: on Free the group page is a sample; the leader starts the Team plan's trial from Plan and billing
  await lp.goto(at('group'))
  await expect(lp.getByText('Sample', { exact: true })).toBeVisible()
  await lp.goto(at('home'))
  await expect(lp.getByRole('link', { name: 'Free plan' })).toHaveAttribute('href', at('settings/plan'))
  await lp.getByRole('link', { name: 'Settings' }).first().click()
  await expect(lp).toHaveURL(/\/settings\/account$/)
  await lp.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Plan and billing' }).click()
  await expect(lp).toHaveURL(new RegExp(`${at('settings/plan')}$`))
  await expect(lp.getByRole('heading', { name: 'Free plan' })).toBeVisible()
  await lp.getByRole('button', { name: 'Start a 30-day trial' }).click()
  await expect(lp.getByRole('heading', { name: 'Team trial' })).toBeVisible()
  await expect(lp.getByText(/^The trial ends on \d{1,2} [A-Z][a-z]+ \d{4}\. Then the group is on Free again, unless you subscribe\.$/)).toBeVisible()
  await expect(lp.getByRole('link', { name: 'Team trial' })).toBeVisible()
  await axe(lp)

  // ---- charter: the group's own page, a draft, then version 1 in force
  await lp.goto(at('group'))
  await expect(lp.getByText('Sample', { exact: true })).toHaveCount(0)
  await expect(lp.getByRole('heading', { name: 'No charter yet' })).toBeVisible()
  await lp.getByRole('button', { name: 'Start the charter' }).click()
  await lp.getByLabel('Purpose').fill(PURPOSE)
  await lp.getByLabel('Team task 1', { exact: true }).fill(TASK)
  await lp.getByLabel('Working agreement 1', { exact: true }).fill('Decisions get an owner before we move on.')
  await lp.getByRole('button', { name: 'Save draft' }).click()
  await expect(lp.getByText('Draft saved. The version in force has not changed.')).toBeFocused()
  await lp.getByRole('button', { name: 'Continue the draft' }).click()
  await lp.getByRole('button', { name: 'The group agrees · put in force' }).click()
  await lp.getByRole('button', { name: 'Put it in force' }).click()
  await expect(lp.getByText('Version 1 is in force.')).toBeFocused()
  await expect(lp.getByText('Version 1 in force', { exact: true })).toBeVisible()
  await expect(lp.getByRole('list', { name: 'Team tasks', exact: true }).getByRole('listitem')).toHaveCount(1)
  await axe(lp)

  // ---- diagnostic round: the leader opens it for all five, then answers first
  await lp.goto(at('assess'))
  await expect(lp.getByText(/^No rounds yet\./)).toBeVisible()
  await expect(lp.getByText(`${QUESTIONS} questions on how the group works, about 10 minutes each. Every current member is asked: 5 people. It stays open for 14 days.`)).toBeVisible()
  await lp.getByRole('button', { name: 'Open the Full diagnostic' }).click()
  await expect(lp.getByText('Open it now for all 5 members?')).toBeFocused()
  await lp.getByRole('button', { name: 'Open it now' }).click()
  const rounds = lp.getByRole('list', { name: 'Rounds' })
  await expect(rounds.getByRole('heading', { name: 'Full diagnostic · round 1' })).toBeVisible()
  await expect(rounds.getByText('0 of 5 answered')).toBeVisible()
  await expect(rounds.getByText('Counts only, never names')).toBeVisible()
  await axe(lp)
  // the round's id, from its own page's address, for the closing date below
  const href = await rounds.getByRole('link', { name: 'Answer now' }).getAttribute('href')
  const round = new RegExp(`^${at('assess')}/([0-9a-f-]{36})$`).exec(href ?? '')?.[1]
  expect(round).toBeTruthy()
  await answerRound(lp, ANSWERS[0]!, 0)

  // three members answer, each signed in once in a browser of their own; the fifth does not. The first stays
  // signed in: the action below is theirs
  const ownerSession = await signedIn(browser, owner!)
  await answerRound(ownerSession.page, ANSWERS[1]!, 1)
  for (const [i, person] of others.slice(0, 2).entries()) {
    const session = await signedIn(browser, person)
    await answerRound(session.page, ANSWERS[i + 2]!, i + 2)
    await session.context.close()
  }

  // still open at 4 of 5: a count, never a score (nothing before close)
  await lp.goto(at('assess'))
  await expect(rounds.getByText('4 of 5 answered')).toBeVisible()
  await expect(rounds.getByText('You answered')).toBeVisible()
  await lp.goto(at('results'))
  await expect(lp.getByRole('heading', { name: 'No results yet' })).toBeVisible()
  await expect(lp.getByText('Round 1 is open: 4 of 5 answered. Results open to everyone when it closes, if at least 4 have answered.')).toBeVisible()
  await expect(lp.getByText(/^Level \d\.\d$/)).toHaveCount(0)
  await axe(lp)

  // ---- the round closes: its closing date passes with 4 answers, at the threshold, and the result is made once
  expect(passRoundDeadline(round!)).toBe('released')
  await lp.goto(at('assess'))
  await expect(rounds.getByText('The result was computed once, when the round closed.')).toBeVisible()
  await rounds.getByRole('link', { name: 'See the results' }).click()

  // ---- results: 24 rows, each a level to one decimal, an agreement label and a standing; nothing forbidden
  await expect(lp.getByRole('heading', { level: 1, name: 'Results' })).toBeVisible()
  await expect(lp.getByText(`${CHAIN_FLOW.group.name} · Full diagnostic · round 1`)).toBeVisible()
  await expect(lp.getByText(/4 of 5 answered\. Counts only, never names\.$/)).toBeVisible()
  await expect(lp.getByText('Research-based, not yet validated · scale 1–5')).toBeVisible()
  await expect(lp.getByText('This is the first round with a result, so no change shows.')).toBeVisible()
  const rows = lp.getByRole('main').getByRole('list').getByRole('listitem')
  await expect(rows).toHaveCount(24)
  for (const row of await rows.all()) {
    await expect(row.getByText(/^Level \d\.\d$/)).toHaveCount(1)
    await expect(row.getByText(/^(High agreement|Medium agreement|Views differ)$/)).toHaveCount(1)
    await expect(row).toContainText(STANDING)
  }
  await nothingForbidden(lp)
  await axe(lp)

  // ---- focus area: from the scale's own page, which reads its standing and what it suggests
  await lp.getByRole('link', { name: 'Clear purpose', exact: true }).click()
  await expect(lp.getByRole('heading', { level: 1, name: 'Clear purpose' })).toBeVisible()
  await expect(lp.getByText('Priority', { exact: true })).toBeVisible()
  await expect(lp.getByText('Make Clear purpose a priority. The research link between this scale and team results is strong.')).toBeVisible()
  await expect(lp.getByText('Based on 4 answers. Counts only, never names.')).toBeVisible()
  await nothingForbidden(lp)
  await axe(lp)
  await lp.getByRole('button', { name: 'Make this a focus area: Clear purpose' }).click()
  await expect(lp).toHaveURL(new RegExp(`${at('plan')}$`))
  await expect(lp.getByText('1 of 2 active')).toBeVisible()
  await expect(lp.getByRole('heading', { level: 3, name: 'Clear purpose' })).toBeVisible()
  await expect(lp.getByText(/^Chosen from round 1 · level \d\.\d · High agreement$/)).toBeVisible()

  // ---- action: with an owner, on the Plan page
  const focus = lp.getByRole('region', { name: 'Clear purpose' })
  const due = isoDay(new Date(Date.now() + 30 * 86_400_000))
  await focus.getByRole('button', { name: 'Add an action: Clear purpose' }).click()
  await focus.getByLabel('What will be done').fill(ACTION)
  await focus.getByLabel('Owner').selectOption({ label: owner!.name })
  await focus.getByLabel('Due date').fill(due)
  await focus.getByRole('button', { name: 'Save the action' }).click()
  const actions = focus.getByRole('list', { name: 'The actions of Clear purpose' })
  await expect(actions.getByRole('listitem')).toHaveCount(1)
  await expect(actions.getByText(`Owner: ${owner!.name}`, { exact: true })).toBeVisible()
  await expect(focus.getByText('1 open · 0 done')).toBeVisible()
  await expect(lp.getByText('Each open action appears on the next agenda.')).toBeVisible()
  await axe(lp)

  // ---- agenda: a meeting, which starts with the closing item and lists the open action
  await lp.goto(at('meetings'))
  await expect(lp.getByRole('heading', { name: 'No meeting planned yet' })).toBeVisible()
  await lp.getByRole('button', { name: 'Plan a meeting' }).click()
  await expect(lp.getByLabel('Title')).toHaveValue('Leadership meeting')
  await lp.getByLabel('Day').fill(isoDay(new Date(Date.now() + 7 * 86_400_000)))
  await lp.getByLabel('Length in minutes').fill('60')
  await lp.getByRole('button', { name: 'Plan it' }).click()
  await expect(lp).toHaveURL(/\?meeting=/)
  await expect(lp.getByRole('heading', { level: 2, name: 'Leadership meeting' })).toBeVisible()
  await expect(lp.getByRole('list', { name: 'Agenda items' }).getByRole('heading', { name: 'Reflection' })).toBeVisible()
  await expect(lp.getByText('Every item matches a team task.')).toBeVisible()
  await expect(lp.getByRole('list', { name: 'Open actions' }).getByText(ACTION)).toBeVisible()
  await axe(lp)
  // the action's owner sees it on the same agenda
  await ownerSession.page.goto(at('meetings'))
  await expect(ownerSession.page.getByRole('list', { name: 'Open actions' }).getByText(ACTION)).toBeVisible()

  const problems = watched.flat()
  expect(problems).toEqual([])
  await ownerSession.context.close()
  await leader.context.close()
})
