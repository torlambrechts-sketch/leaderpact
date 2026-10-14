import { expect, test } from '@playwright/test'
import { FLOW_LEADER, NO_GROUP, TEAM_STATES } from '../../scripts/seed/fixture.mjs'
import { canReadMail, signInLink } from './support/mail'
import { axe, watch } from './support/page'
import { canMintSession, signInAs } from './support/session'

/**
 * Sign-in by email link (handoff section 8): the page, the confirmation page's states, the pages behind
 * sign-in, and signing out. The real link is in leader.spec.ts.
 */
test('the sign-in page: one field, a check before anything is sent, and no account enumeration', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.getByText('We email you a link to sign in. It works once, for 15 minutes. No password.')).toBeVisible()
  await axe(page)
  await page.getByLabel('Email').fill('not an address')
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByText('Enter a full email address.')).toBeVisible()

  if (canReadMail()) {
    // an address with no account reads exactly as one with an account would
    await page.getByLabel('Email').fill(`nobody-${Date.now()}@lumio.example`)
    await page.getByRole('button', { name: 'Email me a link' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByText(/^If nobody-\d+@lumio\.example has an account, a sign-in link is on its way\./)).toBeVisible()
  }
  expect(problems).toEqual([])
})

test('an account without the scan: the sign-in page leads to it, and after the link the person makes or joins a group', async ({ page, baseURL }, info) => {
  const problems = watch(page)
  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/sign-up$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Create an account' })).toBeVisible()
  await expect(page.getByText('No scan needed. We email you a link to sign in. It works once, for 15 minutes. No password.')).toBeVisible()
  await axe(page)
  await page.getByLabel('Email').fill('not an address')
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByText('Enter a full email address.')).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')

  if (canReadMail()) {
    // CI: a new address gets a link that makes the account; one new account per run, at 1280 px
    test.skip(info.project.name !== 'desktop', 'one new account per run')
    const email = `new-${Date.now()}@lumio.example`
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Email me a link' }).click()
    await expect(page.getByText(`We sent a sign-in link to ${email}. It works once, for 15 minutes.`)).toBeVisible()
    await page.goto(await signInLink(email))
    await page.getByRole('button', { name: 'Sign in' }).click()
  } else {
    // a cloud session has no Auth to send the link: an account with no group, as the link leaves it
    test.skip(!canMintSession(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
    await signInAs(page.context(), NO_GROUP, baseURL!)
    await page.goto('/app/new')
  }
  await expect(page).toHaveURL(/\/app\/new$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Make your group' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Not leading a group?' })).toBeVisible()
  await expect(page.getByText("Ask the group's team leader for an invitation. Its link brings you into the group.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to the Leader Profile' })).toHaveAttribute('href', '/leader-profile')
  await axe(page)
  expect(problems).toEqual([])
})

test('the confirmation page: an incomplete link is said to be incomplete, and a used one to have expired', async ({ page }) => {
  await page.goto('/auth/confirm')
  await expect(page.getByRole('heading', { name: 'This link is not complete' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask for a new link' })).toBeVisible()
  await axe(page)

  // opening a link signs nobody in: the page waits for the button
  await page.goto('/auth/confirm?token_hash=0123456789abcdef0123456789abcdef0123456789abcdef01234567&type=email')
  await expect(page.getByRole('heading', { name: 'Finish signing in' })).toBeVisible()
  await axe(page)
  test.skip(!canReadMail(), 'Auth answers for the token only in CI')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'This link has expired or was used' })).toBeVisible()
})

test('the pages behind sign-in send an anonymous visitor to sign in', async ({ request }) => {
  for (const path of ['/app', '/app/new', '/app/00000000-0000-4000-8000-000000000000/invite']) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(307)
    expect(new URL(response.headers()['location'] ?? '', 'http://x').pathname, path).toBe('/sign-in')
  }
})

test('a signed-in person signs out, and the pages behind sign-in close again', async ({ page, baseURL }) => {
  test.skip(!canMintSession(), 'a minted session needs the local API (D-27); CI signs in by email in leader.spec.ts')
  await signInAs(page.context(), FLOW_LEADER, baseURL!)
  // the flow leader leads groups, so /app/new would move on to Home: sign out from Home's account menu
  await page.goto(`/app/${TEAM_STATES.released.group.id}/home`)
  await page.getByRole('button', { name: 'Your account' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/leadership-team-assessment$/)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/sign-in$/)
})

test("a group that is not the person's own is not shown", async ({ page, baseURL }) => {
  test.skip(!canMintSession(), 'a minted session needs the local API (D-27)')
  await signInAs(page.context(), FLOW_LEADER, baseURL!)
  await page.goto('/app/0b000000-0000-4000-8000-000000000001/invite')
  await expect(page.getByRole('heading', { level: 1, name: 'This group is not one of yours' })).toBeVisible()
  await expect(page.getByText('Lumio leadership group')).toHaveCount(0)
})
