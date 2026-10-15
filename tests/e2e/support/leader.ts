import type { Page } from '@playwright/test'
import { FIXTURE_PASSWORD, FLOW_LEADER } from '../../../scripts/seed/fixture.mjs'
import { canReadMail, signInLink } from './mail'
import { canMintSession, signInAs } from './session'

/** True where a fixture person can sign in: by email link in CI, by a minted session in a cloud session */
export const canSignIn = () => canReadMail() || canMintSession()
export const canSignInFlowLeader = canSignIn

/**
 * Signs a fixture person in: in CI through the sign-in page with the fixture's password (D-57), in a cloud
 * session with a minted session (D-27). Ends on whatever page the sign-in leads to. A password sends no mail,
 * so the flows stay clear of Auth's mail limit; the email link has flows of its own (sign-in.spec.ts,
 * leader.spec.ts), each signing in a person of its own.
 */
export async function signInPerson(page: Page, baseURL: string, person: { id: string; email: string }) {
  if (canReadMail()) {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(person.email)
    await page.getByLabel('Password', { exact: true }).fill(FIXTURE_PASSWORD)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL(/\/app\//)
  } else {
    await signInAs(page.context(), person, baseURL)
  }
}

/** The email link's way in, for the flows that prove it: the sign-in page's other way, then Mailpit's link */
export async function signInByLink(page: Page, person: { email: string }) {
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Email me a sign-in link instead' }).click()
  await page.getByLabel('Email').fill(person.email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()
  await page.goto(await signInLink(person.email))
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/app\//)
}

/** The fixture's flow leader, who leads the team view's three groups (scripts/seed/fixture.mjs --e2e) */
export const signInFlowLeader = (page: Page, baseURL: string) => signInPerson(page, baseURL, FLOW_LEADER)
