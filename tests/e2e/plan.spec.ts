import { expect, test, type Browser, type Page } from '@playwright/test'
import { PLAN_FLOW } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 12 (handoff 12; D-46): "A third focus area is refused. An action without an owner is refused."
 * On the plan flow's group (scripts/seed/fixture.mjs, PLAN_FLOW), on its trial with one released round: the
 * leader makes one scale a focus area from the Plan page and another from the scale's own page; a third is
 * not offered, and the scale's page says why. An action without an owner is not saved; with one it is. The
 * member who owns it marks it done, and a member cannot choose or close a focus area. Closing one opens a
 * place. The database refuses a third and an ownerless action whatever the page does
 * (supabase/tests/plan_invariants.sql).
 */
const plan = `/app/${PLAN_FLOW.group.id}/plan`

async function signedIn(browser: Browser, baseURL: string, person: { id: string; email: string }) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signInPerson(page, baseURL, person)
  return { context, page }
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inWords = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

test('focus areas and actions: at most two, and never an action without an owner', async ({ browser, baseURL }, info) => {
  // Auth sends one address one link per interval, so each person signs in once, here (D-27)
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, with a phone-width pass; two people sign in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(180_000)
  const leader = await signedIn(browser, baseURL!, PLAN_FLOW.leader)
  const member = await signedIn(browser, baseURL!, PLAN_FLOW.member)
  const lp = leader.page
  const mp = member.page
  const problems = watch(lp)

  // nothing chosen yet: two open places and the scales to consider, from round 1
  await lp.goto(plan)
  await expect(lp.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible()
  await expect(lp.getByText('Sample', { exact: true })).toHaveCount(0)
  await expect(lp.getByText('0 of 2 active')).toBeVisible()
  await expect(lp.getByRole('heading', { name: /^Focus area \d · open$/ })).toHaveCount(2)
  const offered = lp.getByRole('list', { name: 'Scales to consider' })
  await expect(offered.getByRole('listitem')).toHaveCount(6)
  const links = offered.getByRole('link')
  const names = (await links.allTextContents()).map((s) => s.trim())
  const hrefs = await Promise.all((await links.all()).map((l) => l.getAttribute('href')))
  await axe(lp)

  // a member reads the plan and chooses nothing
  await mp.goto(plan)
  await expect(mp.getByText('The team leader records the scales the group chooses.').first()).toBeVisible()
  await expect(mp.getByRole('button', { name: /^Make this a focus area/ })).toHaveCount(0)

  // the first from the Plan page
  await lp.getByRole('button', { name: `Make this a focus area: ${names[0]}` }).click()
  await expect(lp.getByText('1 of 2 active')).toBeVisible()
  await expect(lp.getByRole('heading', { level: 3, name: names[0] })).toBeVisible()
  await expect(lp.getByText(/^Chosen from round 1 · level \d\.\d · (High agreement|Medium agreement|Views differ)$/)).toBeVisible()

  // the second from its own page in the results
  await lp.goto(hrefs[1]!)
  await expect(lp.getByRole('heading', { level: 1, name: names[1] })).toBeVisible()
  await lp.getByRole('button', { name: `Make this a focus area: ${names[1]}` }).click()
  await expect(lp).toHaveURL(new RegExp(`${plan}$`))
  await expect(lp.getByText('2 of 2 active')).toBeVisible()
  await expect(lp.getByRole('list', { name: 'Scales to consider' })).toHaveCount(0)
  await expect(lp.getByText('All 2 places are taken. Close a focus area to choose another scale.')).toBeVisible()

  // a third is refused: its page offers no button and says why
  await lp.goto(hrefs[2]!)
  await expect(lp.getByText('All 2 focus areas are taken. Close one on the Plan page to choose this scale.')).toBeVisible()
  await expect(lp.getByRole('button', { name: /^Make this a focus area/ })).toHaveCount(0)
  await lp.goto(hrefs[0]!)
  await expect(lp.getByText("This scale is one of the group's focus areas.")).toBeVisible()

  // an action without an owner is refused, and nothing is saved
  await lp.goto(plan)
  const first = lp.getByRole('region', { name: names[0] })
  const due = isoDay(new Date(Date.now() + 30 * 86_400_000))
  await first.getByRole('button', { name: `Add an action: ${names[0]}` }).click()
  await expect(first.getByLabel('What will be done')).toBeFocused()
  await first.getByLabel('What will be done').fill('Agree what good looks like')
  await first.getByLabel('Due date').fill(due)
  await first.getByRole('button', { name: 'Save the action' }).click()
  await expect(first.getByText('Pick an owner. An action without an owner cannot be saved.')).toBeVisible()
  await expect(first.getByText('No actions yet.')).toBeVisible()
  await axe(lp)

  // with an owner it is saved
  await first.getByLabel('Owner').selectOption({ label: PLAN_FLOW.member.name })
  await first.getByRole('button', { name: 'Save the action' }).click()
  const actions = first.getByRole('list', { name: `The actions of ${names[0]}` })
  await expect(actions.getByRole('listitem')).toHaveCount(1)
  await expect(actions.getByText('Agree what good looks like')).toBeVisible()
  await expect(actions.getByText(`Owner: ${PLAN_FLOW.member.name}`, { exact: true })).toBeVisible()
  await expect(actions.getByText(`Due ${inWords(due)}`)).toBeVisible()
  await expect(first.getByText('1 open · 0 done')).toBeVisible()

  // the member who owns it marks it done; a member closes nothing
  await mp.goto(`/app/${PLAN_FLOW.group.id}/home`)
  await expect(mp.getByText('You have 1 open action')).toBeVisible()
  await mp.goto('/app/me')
  await expect(mp.getByRole('list', { name: 'Waiting for you' }).getByText('Agree what good looks like')).toBeVisible()
  await mp.goto(plan)
  await expect(mp.getByRole('button', { name: /^Close this focus area/ })).toHaveCount(0)
  const toggle = mp.getByRole('button', { name: 'Done: Agree what good looks like' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(mp.getByRole('region', { name: names[0] }).getByText('0 open · 1 done')).toBeVisible()
  await axe(mp)

  // closing one opens a place; the closed one keeps its row and its action
  await lp.reload()
  await lp.getByRole('button', { name: `Close this focus area: ${names[0]}` }).click()
  await expect(lp.getByText(`Close ${names[0]} as a focus area?`)).toBeFocused()
  await lp.getByRole('button', { name: 'Close it' }).click()
  await expect(lp.getByText('1 of 2 active')).toBeVisible()
  await expect(lp.getByRole('heading', { level: 2, name: 'Closed focus areas' })).toBeVisible()
  await expect(lp.getByRole('region', { name: names[0] }).getByText(/^Closed \d{1,2} [A-Z][a-z]+ \d{4}$/)).toBeVisible()
  await expect(lp.getByRole('list', { name: 'Scales to consider' })).toBeVisible()
  await expect(lp.getByRole('heading', { name: 'Focus area 2 · open' })).toBeVisible()

  // Home: the active focus area
  await lp.goto(`/app/${PLAN_FLOW.group.id}/home`)
  await expect(lp.getByRole('list', { name: 'Focus areas' }).getByText(names[1]!)).toBeVisible()

  // on a phone: the same plan, with no sideways scroll
  await lp.setViewportSize({ width: 360, height: 780 })
  await lp.goto(plan)
  await expect(lp.getByText('1 of 2 active')).toBeVisible()
  expect(await sideways(lp)).toBe(false)
  await axe(lp)

  expect(problems).toEqual([])
  await leader.context.close()
  await member.context.close()
})
