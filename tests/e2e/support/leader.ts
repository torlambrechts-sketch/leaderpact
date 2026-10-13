import type { Page } from '@playwright/test'
import { FLOW_LEADER } from '../../../scripts/seed/fixture.mjs'
import { canReadMail, signInLink } from './mail'
import { canMintSession, signInAs } from './session'

/** True where the flow leader can sign in: by email link in CI, by a minted session in a cloud session */
export const canSignInFlowLeader = () => canReadMail() || canMintSession()

/**
 * Signs the fixture's flow leader in: in CI through the sign-in page and the real email link from Mailpit,
 * in a cloud session with a minted session (D-27). Ends on whatever page the sign-in leads to.
 */
export async function signInFlowLeader(page: Page, baseURL: string) {
  if (canReadMail()) {
    await page.goto('/sign-in')
    await page.getByLabel('Email').fill(FLOW_LEADER.email)
    await page.getByRole('button', { name: 'Email me a link' }).click()
    await page.getByRole('heading', { name: 'Check your email' }).waitFor()
    await page.goto(await signInLink(FLOW_LEADER.email))
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/\/app\//)
  } else {
    await signInAs(page.context(), FLOW_LEADER, baseURL)
  }
}
