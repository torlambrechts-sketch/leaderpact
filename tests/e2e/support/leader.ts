import type { Page } from '@playwright/test'
import { FLOW_LEADER } from '../../../scripts/seed/fixture.mjs'
import { canReadMail, signInLink } from './mail'
import { canMintSession, signInAs } from './session'

/** True where a fixture person can sign in: by email link in CI, by a minted session in a cloud session */
export const canSignIn = () => canReadMail() || canMintSession()
export const canSignInFlowLeader = canSignIn

/**
 * Signs a fixture person in: in CI through the sign-in page and the real email link from Mailpit, in a
 * cloud session with a minted session (D-27). Ends on whatever page the sign-in leads to. Auth refuses a
 * second link to one address within its minimum interval, so each flow signs in a person of its own.
 */
export async function signInPerson(page: Page, baseURL: string, person: { id: string; email: string }) {
  if (canReadMail()) {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(person.email)
    await page.getByRole('button', { name: 'Email me a link' }).click()
    await page.getByRole('heading', { name: 'Check your email' }).waitFor()
    await page.goto(await signInLink(person.email))
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/\/app\//)
  } else {
    await signInAs(page.context(), person, baseURL)
  }
}

/** The fixture's flow leader, who leads the team view's three groups (scripts/seed/fixture.mjs --e2e) */
export const signInFlowLeader = (page: Page, baseURL: string) => signInPerson(page, baseURL, FLOW_LEADER)
