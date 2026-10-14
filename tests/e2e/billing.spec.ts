import { expect, test, type Browser } from '@playwright/test'
import { BILLING } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 8 (handoff 12): "Upgrade carries the group, members and scan over. Grace and read-only states
 * work." On the billing flow's group (scripts/seed/fixture.mjs, BILLING), with the development adapter a
 * local or CI database runs (0013): the leader starts the one trial and lets it end unpaid, buys the Team
 * plan through the three steps (a failed payment first), then a failed renewal gives grace, the grace runs
 * out to read-only, a payment brings it back, and a cancel is withdrawn. The member sees the plan and its
 * state on every page, never a price or the billing details. Section 11: no "VAT 25%", no card number.
 */
const home = `/app/${BILLING.group.id}/home`
const plan = `/app/${BILLING.group.id}/settings/plan`
const DATE = /\d{1,2} [A-Z][a-z]+ \d{4}/

async function signedIn(browser: Browser, baseURL: string, person: { id: string; email: string }) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signInPerson(page, baseURL, person)
  return { context, page }
}

test('the leader: a trial, the checkout, grace, read-only and a cancel; the member sees the plan, never the details', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px; two people sign in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(180_000)
  const leader = await signedIn(browser, baseURL!, BILLING.leader)
  const member = await signedIn(browser, baseURL!, BILLING.member)
  const lp = leader.page
  const mp = member.page
  const problems = watch(lp)
  const notice = (page: typeof lp) => page.getByRole('main').getByRole('note').first()

  // Free: the pill names the plan and leads to Plan and billing; the gear leads to Settings
  await lp.goto(home)
  await expect(lp.getByText(/^0 of 4 have answered\. Counts only, never names\.$/)).toBeAttached()
  await expect(lp.getByRole('link', { name: 'Free plan' })).toHaveAttribute('href', plan)
  await expect(lp.getByRole('link', { name: 'Upgrade' })).toBeVisible()
  // Settings opens on the person's Account (D-53); Plan and billing is its last tab
  await lp.getByRole('link', { name: 'Settings' }).first().click()
  await expect(lp).toHaveURL(/\/settings\/account$/)
  await expect(lp.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await lp.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Plan and billing' }).click()
  await expect(lp).toHaveURL(new RegExp(`${plan}$`))
  await expect(lp.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Plan and billing' })).toHaveAttribute('aria-current', 'page')
  const plans = lp.getByRole('list', { name: 'Plans' })
  await expect(plans.getByRole('listitem').filter({ has: lp.getByRole('heading', { name: 'Free' }) }).getByText('Current', { exact: true })).toBeVisible()
  await expect(plans.getByText('$1,800', { exact: true })).toBeVisible()
  await expect(plans.getByText('per group per year, or $180 a month')).toBeVisible()
  await expect(plans.getByText('Meetings with task match and time check')).toBeVisible()
  await expect(lp.getByText(/VAT|\d+\s?%/)).toHaveCount(0)
  await axe(lp)

  // the member: the plan, no price, no way to change it
  await mp.goto(plan)
  await expect(mp.getByRole('heading', { name: 'Free plan' })).toBeVisible()
  await expect(mp.getByText('Only the team leader can change the plan.')).toBeVisible()
  await expect(mp.getByText('Ask your team leader to upgrade.')).toBeVisible()
  await expect(mp.getByText(/\$/)).toHaveCount(0)
  await expect(mp.getByRole('link', { name: 'Upgrade' })).toHaveCount(0)
  await expect(mp.getByRole('button', { name: /trial/ })).toHaveCount(0)
  await axe(mp)

  // the one trial (owner D2a): the Team plan for 14 days, with no billing details
  await lp.getByRole('button', { name: 'Start a 14-day trial' }).click()
  await expect(lp.getByRole('heading', { name: 'Team trial' })).toBeVisible()
  await expect(lp.getByText(new RegExp(`^The trial ends on ${DATE.source}\\. Then the group is on Free again, unless you subscribe\\.$`))).toBeVisible()
  await expect(lp.getByRole('link', { name: 'Team trial' })).toBeVisible()
  await mp.goto(home)
  await expect(mp.getByText(/^Team trial · ends /)).toBeVisible()
  await expect(mp.getByRole('heading', { name: 'What the Team plan adds' })).toHaveCount(0)
  // with the trial, the group's own pages: its meetings, none planned yet, and no sample
  await mp.goto(`/app/${BILLING.group.id}/meetings`)
  await expect(mp.getByRole('heading', { name: 'No meeting planned yet' })).toBeVisible()
  await expect(mp.getByText('Sample', { exact: true })).toHaveCount(0)

  // the trial ends unpaid: Free again, the Team data kept for its deletion date, and no second trial
  await lp.getByRole('button', { name: 'End the trial now' }).click()
  await expect(lp.getByRole('heading', { name: 'Free plan' })).toBeVisible()
  await expect(lp.getByText(new RegExp(`The trial ended on ${DATE.source}\\. Team data is kept until ${DATE.source}, then deleted unless you subscribe\\.`))).toBeVisible()
  await expect(lp.getByRole('button', { name: /trial/ })).toHaveCount(0)

  // the checkout: billing period, then details and payment method, then review
  await plans.getByRole('link', { name: 'Upgrade' }).click()
  await expect(lp).toHaveURL(new RegExp(`/settings/upgrade$`))
  await expect(lp.getByRole('radio', { name: /^Yearly/ })).toBeChecked()
  await lp.getByRole('radio', { name: /^Monthly/ }).click()
  await axe(lp)
  await lp.getByRole('button', { name: 'Continue' }).click()
  await expect(lp.getByRole('heading', { name: 'Upgrade to the Team plan' })).toBeFocused()
  await lp.getByRole('button', { name: 'Continue' }).click()
  await expect(lp.getByText("Enter the company's name.")).toBeVisible()
  await expect(lp.getByText("Choose the company's country.")).toBeVisible()
  await lp.getByRole('radio', { name: /^Invoice/ }).click()
  await lp.getByLabel('Company').fill('Billing AS')
  await lp.getByLabel('Country').selectOption({ label: 'Norway' })
  await lp.getByRole('button', { name: 'Continue' }).click()
  await expect(lp.getByText('An invoice needs the organisation number.')).toBeVisible()
  await expect(lp.getByText('An invoice needs an invoice email.')).toBeVisible()
  await lp.getByLabel('Organisation number').fill('923 456 789')
  await lp.getByLabel('Invoice email').fill('not-an-address')
  await lp.getByRole('button', { name: 'Continue' }).click()
  await expect(lp.getByText('Enter a full email address for invoices.')).toBeVisible()
  await lp.getByLabel('Invoice email').fill('Invoice@Billing.example')
  await lp.getByLabel('Your reference').fill('Leadership group')
  await axe(lp)
  await lp.getByRole('button', { name: 'Continue' }).click()

  const review = lp.getByRole('definition')
  for (const text of ['Team · Monthly', 'Flow billing group', 'Billing AS · 923 456 789', 'Norway', 'Invoice to invoice@billing.example', 'Leadership group']) {
    await expect(review.filter({ hasText: text })).toHaveCount(1)
  }
  await expect(lp.getByText("Tax follows the company's country and is added by the payment provider.")).toBeVisible()
  await expect(lp.getByText(/VAT|\d{4} \d{4} \d{4} \d{4}/)).toHaveCount(0)
  await axe(lp)
  await lp.getByRole('button', { name: 'Make the payment fail' }).click()
  await expect(lp.getByRole('alert').filter({ hasText: 'The payment failed. Nothing has been charged, and the plan is unchanged.' })).toBeVisible()
  await lp.getByRole('button', { name: 'Pay $180 and unlock' }).click()
  await expect(lp.getByRole('heading', { name: 'The Team plan is active' })).toBeFocused()
  await expect(lp.getByText('Your group, its members and its scan results carried over. Nothing else changed.')).toBeVisible()
  await axe(lp)

  // carried over: the same group, its scan and its count, now on the Team plan
  await lp.getByRole('link', { name: 'Go to Home' }).click()
  await expect(lp.getByText('Team plan', { exact: true }).first()).toBeVisible()
  await expect(lp.getByRole('link', { name: 'Team plan' })).toHaveAttribute('href', plan)
  await expect(lp.getByText(/^0 of 4 have answered\. Counts only, never names\.$/)).toBeAttached()
  await expect(lp.getByLabel("The group's invite link")).toHaveValue(new RegExp(`/j/${BILLING.scan.code}$`))
  await expect(lp.getByRole('heading', { name: 'What the Team plan adds' })).toHaveCount(0)

  // Plan and billing: the details for the leader, the plan alone for the member
  await lp.goto(plan)
  await expect(lp.getByText(new RegExp(`^Renews on ${DATE.source}\\.$`))).toBeVisible()
  for (const text of ['$180 per group per month', 'Invoice to invoice@billing.example', 'Billing AS', '923 456 789', 'Norway', 'Leadership group']) {
    await expect(lp.getByRole('definition').filter({ hasText: text })).toHaveCount(1)
  }
  await axe(lp)
  await mp.goto(plan)
  await expect(mp.getByText('Your group has the Team plan.')).toBeVisible()
  await expect(mp.getByText('Billed to')).toHaveCount(0)
  await expect(mp.getByText(/\$/)).toHaveCount(0)

  // a failed renewal: 7 days' grace, said on every page, to everyone
  await lp.getByRole('button', { name: 'Fail the next renewal' }).click()
  await expect(lp.getByText(new RegExp(`^The last payment failed\\. The group stays open until ${DATE.source}, then it is read-only until the payment arrives\\.$`))).toBeVisible()
  await mp.goto(home)
  await expect(notice(mp)).toContainText('The last payment for Flow billing group failed.')
  await expect(notice(mp).getByRole('link')).toHaveCount(0)
  await axe(mp)

  // the grace runs out: read-only, then a payment brings the plan back
  await lp.getByRole('button', { name: 'End the grace period now' }).click()
  await expect(lp.getByText('A payment is overdue, so the group is read-only.', { exact: false }).first()).toBeVisible()
  await expect(lp.getByRole('link', { name: 'Read-only' })).toBeVisible()
  await mp.reload()
  await expect(notice(mp)).toContainText('Flow billing group is read-only because a payment is overdue.')
  await lp.getByRole('button', { name: 'Record the payment' }).click()
  await expect(lp.getByText(new RegExp(`^Renews on ${DATE.source}\\.$`))).toBeVisible()
  await mp.reload()
  await expect(mp.getByText(/read-only|payment failed/)).toHaveCount(0)

  // a cancel keeps the plan to the end of the period, and can be withdrawn
  await lp.getByRole('button', { name: 'Switch to Free' }).click()
  await expect(lp.getByRole('heading', { name: 'Switch Flow billing group to Free?' })).toBeFocused()
  await expect(lp.getByRole('main').getByText('Meetings', { exact: true })).toBeVisible()
  await lp.getByRole('button', { name: 'Switch to Free' }).click()
  await expect(lp.getByText(new RegExp(`^The Team plan ends on ${DATE.source}\\. Then the group is on Free, and Team data is kept until ${DATE.source}\\.$`))).toBeVisible()
  await lp.getByRole('button', { name: 'Keep the Team plan' }).click()
  await expect(lp.getByText(new RegExp(`^Renews on ${DATE.source}\\.$`))).toBeVisible()

  expect(problems).toEqual([])
  await leader.context.close()
  await member.context.close()
})
