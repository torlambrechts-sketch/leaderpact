import { expect, test, type Page } from '@playwright/test'
import { LUMIO } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 6 (handoff 12): the app shell, Home on the Free plan, and a sample page with the banner in every
 * paid area (handoff 6.7, 6.19); People is real from milestone 7 (tests/e2e/profile.spec.ts), and Upgrade
 * leads to the checkout from milestone 8 (tests/e2e/billing.spec.ts). Read from
 * the Lumio group, whose scan is open. Each project signs in a person of its own, because Auth sends one
 * address one link per interval: the leader and a member at 1280 px, two other members on the phones.
 */
const person = (name: string) => {
  const p = LUMIO.people.find((x) => x.name === name)
  if (!p) throw new Error(`no fixture person ${name}`)
  return p
}
const home = `/app/${LUMIO.group.id}/home`
const AREAS = [
  { nav: 'Group', path: 'group', heading: 'Group' },
  { nav: 'Assess', path: 'assess', heading: 'Assess' },
  { nav: 'Results', path: 'results', heading: 'Results' },
  { nav: 'Plan', path: 'plan', heading: 'Plan' },
  { nav: 'Meetings', path: 'meetings', heading: 'Thursday leadership meeting' },
] as const
const LEADER_BANNER = 'This page shows sample content. The Team plan unlocks it for your group: $1,800 per group per year.'
const MEMBER_BANNER = 'This page shows sample content. Ask your team leader to upgrade to the Team plan.'

/** Nothing section 11 removes, and nothing a result may never show (handoff 7) */
async function nothingRemoved(page: Page) {
  await expect(page.getByText(/Assessment schedule|(?<!Leadership )Team Scan|24 scales|fit check|360|contribution|coach|practice|initiative|milestone|target, round|results session/i)).toHaveCount(0)
  await expect(page.getByText(/lowest|highest|median|standard deviation|\bSD\b|rwg|confidence|distribution/i)).toHaveCount(0)
}

const upgrade = `/app/${LUMIO.group.id}/settings/upgrade`

async function sampleArea(page: Page, area: (typeof AREAS)[number], banner: string) {
  await expect(page).toHaveURL(new RegExp(`/app/${LUMIO.group.id}/${area.path}$`))
  await expect(page.getByRole('heading', { level: 1, name: area.heading })).toBeVisible()
  await expect(page.getByText('Sample', { exact: true })).toBeVisible()
  await expect(page.getByText(banner, { exact: true })).toBeVisible()
  // the leader's banner leads to the checkout; a member's has no Upgrade (handoff 6.19)
  await expect(page.getByRole('link', { name: 'Upgrade' })).toHaveCount(banner === LEADER_BANNER ? 1 : 0)
  if (banner === LEADER_BANNER) await expect(page.getByRole('link', { name: 'Upgrade' })).toHaveAttribute('href', upgrade)
  await nothingRemoved(page)
}

test('the leader: Home on the Free plan, and every paid area a sample page with the price', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'at 1280 px; the phones sign in members of their own')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  const problems = watch(page)
  await signInPerson(page, baseURL!, person('Kari Nordmann'))
  await page.goto('/app')
  await expect(page).toHaveURL(new RegExp(`${home}$`))

  // the shell lists the pages that exist; the gear leads to Settings and the plan pill to Plan and billing
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const label of ['Home', ...AREAS.map((a) => a.nav), 'People', 'Me']) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings' }).first()).toHaveAttribute('href', `/app/${LUMIO.group.id}/settings`)
  await expect(page.getByRole('link', { name: 'Free plan' })).toHaveAttribute('href', `/app/${LUMIO.group.id}/settings/plan`)
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page')

  // Home: the greeting, "Needs you", the scan's card, and what the Team plan adds with its price
  await expect(page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)\.$/ })).toBeVisible()
  await expect(page.getByText('Free plan · latest scan only, no history')).toBeVisible()
  const row = (title: string) => page.getByRole('listitem').filter({ hasText: title })
  await expect(row('Answer the Leadership Team Scan').getByRole('link', { name: 'Start' })).toHaveAttribute('href', `/j/${LUMIO.scan.code}`)
  await expect(row('Take the Leader Profile').getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/leader-profile/quick')
  await expect(page.getByRole('button', { name: 'Copy invite link' })).toBeVisible()
  await expect(page.getByText(/^\d+ of 8 have answered\. Counts only, never names\.$/)).toBeAttached()
  await expect(page.getByText('The team view opens when the scan closes', { exact: true })).toHaveCount(1)
  await expect(page.getByLabel("The group's invite link")).toHaveValue(new RegExp(`/j/${LUMIO.scan.code}$`))
  await expect(page.getByRole('heading', { name: 'What the Team plan adds' })).toBeVisible()
  await expect(page.getByText('Meetings', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('$1,800 per group per year', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Upgrade' })).toHaveAttribute('href', upgrade)
  await expect(page.getByRole('meter')).toHaveCount(0)
  await nothingRemoved(page)
  await axe(page)

  // every paid area: a sample page under the banner, reached from the navigation
  for (const area of AREAS) {
    await nav.getByRole('link', { name: area.nav, exact: true }).click()
    await sampleArea(page, area, LEADER_BANNER)
    await expect(nav.getByRole('link', { name: area.nav, exact: true })).toHaveAttribute('aria-current', 'page')
    await axe(page)
  }

  // what the samples must and must not say (handoff 6.10 to 6.14, section 11)
  await page.goto(`/app/${LUMIO.group.id}/results`)
  await expect(page.getByText('Research-based, not yet validated · scale 1–5')).toBeVisible()
  for (const layer of ['Outcomes', 'Conditions', 'Processes', 'States']) await expect(page.getByRole('heading', { level: 2, name: layer })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(24)
  await expect(page.getByText('Self-rated', { exact: true })).toHaveCount(3)
  await expect(page.getByText('Within normal variation', { exact: true })).toHaveCount(24)
  await expect(page.getByText('Change since Round 1 shows only at 0.6 points or more.')).toBeVisible()
  await page.goto(`/app/${LUMIO.group.id}/assess`)
  for (const phase of ['Scheduled', 'Answering', 'Closed', 'Released']) await expect(page.getByText(phase, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/standard|extensive|follow-up|session/i)).toHaveCount(0)
  await page.goto(`/app/${LUMIO.group.id}/meetings`)
  await expect(page.getByRole('heading', { name: 'Time check' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Task match' })).toBeVisible()
  await expect(page.getByText('6 of 7 ready', { exact: true })).toBeVisible()
  await expect(page.getByText('Office move matches no team task. It stays if the team leader confirms it.')).toBeVisible()
  await page.goto(`/app/${LUMIO.group.id}/group`)
  await page.getByRole('tab', { name: 'Members' }).click()
  await expect(page.getByText('Henrik Bakke', { exact: true })).toBeVisible()
  await expect(page.getByText(/open actions|team tasks ·|done$/)).toHaveCount(0)
  expect(problems).toEqual([])
})

test('a member: Home asks them to ask their team leader, and the samples show no price', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'at 1280 px; the phones sign in members of their own')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  const problems = watch(page)
  await signInPerson(page, baseURL!, person('Ola Hansen'))
  await page.goto(home)
  await expect(page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)\.$/ })).toBeVisible()
  await expect(page.getByText('Ask your team leader to upgrade.', { exact: true })).toBeVisible()
  await expect(page.getByText(/\$/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Upgrade' })).toHaveCount(0)
  await axe(page)
  for (const area of AREAS) {
    await page.goto(`/app/${LUMIO.group.id}/${area.path}`)
    await sampleArea(page, area, MEMBER_BANNER)
    await expect(page.getByText(/\$/)).toHaveCount(0)
  }
  expect(problems).toEqual([])
})

test('on a phone: Home and every sample page fit, with the bottom bar', async ({ page, baseURL }, info) => {
  test.skip(info.project.name === 'desktop', 'the phones')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  const problems = watch(page)
  await signInPerson(page, baseURL!, person(info.project.name === 'phone-390' ? 'Ingrid Berg' : 'Lars Johansen'))
  await page.goto(home)
  const bar = page.getByRole('navigation', { name: 'Main' }).last()
  for (const label of ['Home', 'Group', 'Meetings', 'Plan']) await expect(bar.getByRole('link', { name: label, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)\.$/ })).toBeVisible()
  await axe(page)
  for (const area of AREAS) {
    await page.goto(`/app/${LUMIO.group.id}/${area.path}`)
    await sampleArea(page, area, MEMBER_BANNER)
    await axe(page)
  }
  expect(problems).toEqual([])
})
