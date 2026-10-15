import { expect, test } from '@playwright/test'
import { canReadMail, signInLink } from './support/mail'
import { axe, watch } from './support/page'

/**
 * Signing up with a password (owner, 15 October 2026; D-57), end to end against real Auth and its mail, so in CI
 * only (Mailpit): name, work email, company and password; the confirmation mail's link and its button; the group
 * made with the organisation named after the company; signing out and in again with the password; and a forgotten
 * password set anew by its mail. One new account per run, at 1280 px. Google and Microsoft need the providers'
 * own clients, which no CI holds; the callback's answers are unit-tested (tests/unit/auth.test.ts).
 */
const PASSWORD = 'a long enough password'
const NEW_PASSWORD = 'another long password'

test('a sign-up with a password: confirmed by mail, the group named, signed out and in, and a password reset', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one new account per run, at 1280 px')
  test.skip(!canReadMail(), 'Auth and its mail run in CI (Mailpit)')
  test.setTimeout(180_000)
  const problems = watch(page)
  const email = `signup-${Date.now()}@lumio.example`

  // the form, then the mail that confirms the address
  await page.goto('/sign-up')
  await page.getByLabel('Your name').fill('Sigrid Haugen')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Company').fill('Haugen Holding AS')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(page.getByText(`If ${email} is new here, a link to confirm it is on its way. It works once, for 15 minutes.`)).toBeVisible()
  await expect(page.getByRole('link', { name: 'set a new password' })).toHaveAttribute('href', '/sign-in/reset')
  await axe(page)

  // before the address is confirmed, the password does not sign in
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Confirm your email address first, with the link we sent you.')).toBeVisible()

  await page.goto(await signInLink(email))
  await expect(page.getByRole('heading', { name: 'Finish signing in' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app\/new$/)

  // the company given at sign-up is on the form, and names the organisation
  await expect(page.getByLabel('Company')).toHaveValue('Haugen Holding AS')
  await page.getByLabel('Group name').fill('Haugen leadership group')
  await page.getByRole('button', { name: 'Make the group and get the link' }).click()
  await expect(page).toHaveURL(/\/app\/[0-9a-f-]{36}\/invite/)
  const group = /\/app\/([0-9a-f-]{36})\//.exec(page.url())![1]!
  await page.goto(`/app/${group}/settings/group`)
  await expect(page.getByText('Haugen Holding AS', { exact: true })).toBeVisible()
  await page.goto(`/app/${group}/settings/account`)
  await expect(page.getByText('Sigrid Haugen', { exact: true })).toBeVisible()

  // signed out, then in again with the password
  await page.goto(`/app/${group}/home`)
  await page.getByRole('button', { name: 'Your account' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/app/${group}/home$`))

  // a forgotten password: the mail's link signs in to set a new one
  await page.getByRole('button', { name: 'Your account' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.goto('/sign-in')
  await page.getByRole('link', { name: 'Forgot your password?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible()
  await axe(page)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send the link' }).click()
  await expect(page.getByText(`If ${email} has an account, a link to set a new password is on its way. It works once, for 15 minutes.`)).toBeVisible()
  const link = await signInLink(email)
  expect(link).toContain('type=recovery')
  await page.goto(link)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/app\/password$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible()
  await axe(page)
  await page.getByLabel('New password').fill('short')
  await page.getByRole('button', { name: 'Save the password' }).click()
  await expect(page.getByText('Use at least 10 characters.')).toBeVisible()
  await page.getByLabel('New password').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Save the password' }).click()
  await expect(page).toHaveURL(new RegExp(`/app/${group}/home$`))

  // the new password signs in; the old one no longer does
  await page.getByRole('button', { name: 'Your account' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('The email or the password is not right.')).toBeVisible()
  await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/app/${group}/home$`))
  expect(problems).toEqual([])
})
