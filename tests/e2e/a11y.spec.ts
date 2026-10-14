import { expect, test } from '@playwright/test'
import { PULSE_STATES, TEAM_STATES } from '../../scripts/seed/fixture.mjs'
import { checkA11y } from './support/a11y'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 18, the accessibility pass (handoff 13, Accessibility; D-56): every control is reachable and usable
 * by keyboard, with its focus ring; touch targets are at least 44 px below 768 px; no information is carried by
 * colour alone; axe, which checks text at 4.5 to 1, finds nothing. Over every public page and every page of a
 * group with content: the pulse states group (scripts/seed/fixture.mjs, PULSE_STATES), whose leader no other flow
 * signs in. Once, at 1280 px, moving to 390 and 360 px for the targets.
 */
const PUBLIC = [
  '/leadership-team-assessment',
  '/leadership-team-assessment-tools',
  '/scan',
  '/leader-profile',
  '/leader-profile/quick',
  '/platform',
  '/platform/meetings',
  '/anonymity',
  '/research',
  '/articles',
  '/templates',
  '/privacy',
  '/data-processing',
  '/sign-in',
  '/sign-up',
  `/j/${TEAM_STATES.released.scan.code}`,
]

const SIGNED_IN = ['home', 'group', 'people', 'assess', 'results', 'plan', 'meetings', 'settings/account', 'settings/group', 'settings/notifications', 'settings/privacy', 'settings/plan']

test('the public pages: keyboard, focus, targets and colour', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, moving to the phone widths inside')
  test.setTimeout(240_000)
  const problems = watch(page)
  for (const path of PUBLIC) {
    await page.goto(path)
    await axe(page)
    await checkA11y(page, path)
  }
  // the scan's first question, as a visitor sees it
  await page.goto('/scan')
  await page.getByRole('button', { name: /^Start/ }).first().click()
  await expect(page.getByText(/^1 of 12$/)).toBeVisible()
  await checkA11y(page, '/scan, a question')
  expect(problems).toEqual([])
})

test('a group with content, signed in: keyboard, focus, targets and colour on every page', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, moving to the phone widths inside')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(240_000)
  const problems = watch(page)
  await signInPerson(page, baseURL!, PULSE_STATES.leader)
  for (const tab of SIGNED_IN) {
    const path = `/app/${PULSE_STATES.group.id}/${tab}`
    await page.goto(path)
    await axe(page)
    await checkA11y(page, path)
  }
  await page.goto('/app/me')
  await axe(page)
  await checkA11y(page, '/app/me')
  expect(problems).toEqual([])
})
