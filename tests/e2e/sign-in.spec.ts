import { expect, test } from '@playwright/test'
import { FLOW_LEADER, NO_GROUP, TEAM_STATES } from '../../scripts/seed/fixture.mjs'
import { canReadMail } from './support/mail'
import { axe, watch } from './support/page'
import { canMintSession, signInAs } from './support/session'

/**
 * Signing in (handoff section 8; D-57): the page with a password and the email link, the sign-up form, the
 * confirmation page's states, the pages behind sign-in, and signing out. The real link is in leader.spec.ts, and
 * a whole sign-up with a password, its confirmation and a password reset in sign-up.spec.ts.
 */
test('the sign-in page: email and password, the link as the other way, and no account enumeration', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  await expect(page.getByText('Sign in to LeaderPact.')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/sign-in/reset')
  // no provider is turned on in the local stack or CI, so none is offered (D-57)
  await expect(page.getByRole('button', { name: /^Continue with/ })).toHaveCount(0)
  await axe(page)
  await page.getByLabel('Email').fill('not an address')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Enter a full email address.')).toBeVisible()

  if (canReadMail()) {
    // a wrong password and an unknown address read the same
    await page.getByLabel('Email').fill(FLOW_LEADER.email)
    await page.getByLabel('Password', { exact: true }).fill('not the password at all')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByText('The email or the password is not right.')).toBeVisible()
    await page.getByLabel('Email').fill(`nobody-${Date.now()}@lumio.example`)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByText('The email or the password is not right.')).toBeVisible()
  }

  // the email link, as before
  await page.getByRole('button', { name: 'Email me a sign-in link instead' }).click()
  await expect(page.getByText('We email you a link to sign in. It works once, for 15 minutes.')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
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
  await axe(page)
  expect(problems).toEqual([])
})

test('an account without the scan: the sign-in page leads to sign-up, and after it the person makes or joins a group', async ({ page, baseURL }) => {
  const problems = watch(page)
  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/sign-up$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Create an account' })).toBeVisible()
  await expect(page.getByText('No scan needed. Make your account, then start your group or join one.')).toBeVisible()
  await axe(page)
  // nothing filled in: each field says what it needs
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Enter your name.')).toBeVisible()
  await expect(page.getByText('Enter a full email address.')).toBeVisible()
  await expect(page.getByText('Enter the name of your company.')).toBeVisible()
  await expect(page.getByText('Use at least 10 characters.')).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
  // the password can be shown and hidden again
  await page.getByLabel('Password', { exact: true }).fill('a password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')

  // the rest of the account's making is sign-up.spec.ts; here, an account with no group, as sign-up leaves it
  if (canReadMail()) {
    test.skip(true, 'CI makes a new account in sign-up.spec.ts')
  }
  test.skip(!canMintSession(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  await signInAs(page.context(), NO_GROUP, baseURL!)
  await page.goto('/app/new')
  await expect(page).toHaveURL(/\/app\/new$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Make your group' })).toBeVisible()
  await expect(page.getByLabel('Company')).toBeVisible()
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

test('a mail link that passed through Auth (D-63): a lapsed one says so, and one that cannot sign in here says why', async ({ page }) => {
  // Supabase's default mail sends the person through its own address, which comes back with an error instead of a code
  await page.goto('/auth/confirm?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  await expect(page.getByRole('heading', { level: 1, name: 'This link has expired or was used' })).toBeVisible()
  await axe(page)

  // a code this browser holds no verifier for: opened in another browser than the one that asked
  await page.goto('/auth/confirm?code=0123456789abcdef-0123456789')
  await expect(page).toHaveURL(/\/sign-in\?problem=link$/)
  // the main column's alert; Next's route announcer is an alert too
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'That link did not sign you in here. A link works once, for 15 minutes, in the browser where you asked for it. Ask for a new one below.',
  )
  await axe(page)
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
