import { expect, test, type Browser, type Page } from '@playwright/test'
import { GROUP_FLOW, LUMIO } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 9 (handoff 12): "A draft does not change the version in force until the group agrees." On the
 * charter flow's group (scripts/seed/fixture.mjs, GROUP_FLOW), on its trial: the leader drafts the charter
 * and puts it in force; a new draft leaves version 1 in force for the leader and a member alike, until the
 * group agrees; version 1 stays readable. Members: the leader invites by name and address, the invitee
 * joins through the link, the leader removes them (access ends at once) and names another leader. On the
 * Free plan the page stays a sample (handoff 6.19).
 */
const groupPage = `/app/${GROUP_FLOW.group.id}/group`
const membersPage = `${groupPage}?tab=members`
const PURPOSE_1 = 'We set the direction and decide what only this group can decide.'
const PURPOSE_2 = 'We set the direction, decide together and develop the leaders below us.'

async function signedIn(browser: Browser, baseURL: string, person: { id: string; email: string }) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signInPerson(page, baseURL, person)
  return { context, page }
}

const purpose = (page: Page) => page.getByRole('main').locator('section').filter({ has: page.getByRole('heading', { name: 'Purpose', exact: true }) })

test('the charter: a draft changes nothing in force until the group agrees; members join by invitation, leave, and lead', async ({ browser, baseURL }, info) => {
  // Auth sends one address one link per interval, so each person signs in once, here (D-27)
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px; three people sign in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(180_000)
  const leader = await signedIn(browser, baseURL!, GROUP_FLOW.leader)
  const member = await signedIn(browser, baseURL!, GROUP_FLOW.member)
  const lp = leader.page
  const mp = member.page
  const problems = watch(lp)

  // the group's own page on the trial: no sample, no charter yet
  await lp.goto(groupPage)
  await expect(lp.getByRole('heading', { level: 1, name: 'Group' })).toBeVisible()
  await expect(lp.getByText('Sample', { exact: true })).toHaveCount(0)
  await expect(lp.getByRole('heading', { name: 'No charter yet' })).toBeVisible()
  await expect(lp.getByText('No version in force', { exact: true })).toBeVisible()
  await axe(lp)
  await mp.goto(groupPage)
  await expect(mp.getByText('Your team leader drafts the charter. It is put in force when the group agrees.')).toBeVisible()
  await expect(mp.getByRole('button', { name: 'Start the charter' })).toHaveCount(0)

  // the first draft: purpose, two tasks with their decision rights, two agreements
  await lp.getByRole('button', { name: 'Start the charter' }).click()
  await expect(lp.getByRole('heading', { name: 'Not in force' })).toBeFocused()
  await lp.getByLabel('Purpose').fill(PURPOSE_1)
  await lp.getByLabel('Team task 1', { exact: true }).fill('Set strategy and yearly priorities')
  await lp.getByRole('button', { name: 'Add a team task' }).click()
  await lp.getByLabel('Team task 2', { exact: true }).fill('Coordinate priorities across the units')
  await lp.getByLabel('Decision right for team task 2').selectOption({ label: 'Advise' })
  await lp.getByLabel('Working agreement 1', { exact: true }).fill('We send pre-reads 48 hours before the meeting.')
  await lp.getByRole('button', { name: 'Add an agreement' }).click()
  await lp.getByLabel('Working agreement 2', { exact: true }).fill('Decisions get an owner before we move on.')
  await axe(lp)
  await lp.getByRole('button', { name: 'Save draft' }).click()
  await expect(lp.getByText('Draft saved. The version in force has not changed.')).toBeFocused()

  // the member reads the draft, and nothing is in force
  await mp.reload()
  await expect(mp.getByText('No version in force', { exact: true })).toBeVisible()
  await mp.getByText('Read the draft').click()
  await expect(mp.getByText(PURPOSE_1)).toBeVisible()

  // the group agrees: version 1
  await lp.getByRole('button', { name: 'Continue the draft' }).click()
  await lp.getByRole('button', { name: 'The group agrees · put in force' }).click()
  await expect(lp.getByText('Put this draft in force as version 1? Do this when the group agrees to it.')).toBeFocused()
  await lp.getByRole('button', { name: 'Put it in force' }).click()
  await expect(lp.getByText('Version 1 is in force.')).toBeFocused()
  await expect(purpose(lp)).toContainText(PURPOSE_1)
  const tasks = lp.getByRole('list', { name: 'Team tasks', exact: true }).getByRole('listitem')
  await expect(tasks).toHaveCount(2)
  await expect(tasks.nth(1)).toContainText('Advise')
  await expect(lp.getByText('Version 1 in force', { exact: true })).toBeVisible()
  await axe(lp)

  // a new draft: version 1 stays in force, for the leader and for the member
  await lp.getByRole('button', { name: 'Edit as a new draft' }).click()
  await expect(lp.getByLabel('Purpose')).toHaveValue(PURPOSE_1)
  await lp.getByLabel('Purpose').fill(PURPOSE_2)
  await lp.getByRole('button', { name: 'Save draft' }).click()
  await expect(lp.getByText('Draft saved. The version in force has not changed.')).toBeFocused()
  await expect(purpose(lp)).toContainText(PURPOSE_1)
  await mp.reload()
  await expect(purpose(mp)).toContainText(PURPOSE_1)
  await expect(mp.getByText('Version 1 in force', { exact: true })).toBeVisible()
  await expect(mp.getByText('Not in force', { exact: true })).toBeVisible()
  await axe(mp)

  // agreed: version 2, and version 1 opens as it was
  await lp.getByRole('button', { name: 'Continue the draft' }).click()
  await lp.getByRole('button', { name: 'The group agrees · put in force' }).click()
  await lp.getByRole('button', { name: 'Put it in force' }).click()
  await expect(lp.getByText('Version 2 is in force.')).toBeFocused()
  await mp.reload()
  await expect(purpose(mp)).toContainText(PURPOSE_2)
  const versions = mp.getByRole('navigation', { name: 'Versions' })
  await expect(versions.getByRole('link', { name: /^Version 2 · agreed .* · in force$/ })).toHaveAttribute('aria-current', 'page')
  await versions.getByRole('link', { name: /^Version 1 · agreed / }).click()
  await expect(mp).toHaveURL(/\?version=1$/)
  await expect(mp.getByText(/^Version 1, agreed .*\. Not in force\.$/)).toBeVisible()
  await expect(purpose(mp)).toContainText(PURPOSE_1)
  await axe(mp)

  // ---- members: an invitation by link, joining, removal, and a new leader
  const list = lp.getByRole('list', { name: 'Members', exact: true }).getByRole('listitem')

  await lp.goto(membersPage)
  await expect(lp.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true')
  await expect(list).toHaveCount(2)
  await expect(list.first()).toContainText('Charter leader (you)')
  await expect(list.first()).toContainText(/Team leader · since \d/)
  await expect(lp.getByText(/tasks|actions/)).toHaveCount(0)
  await axe(lp)

  // an invitation: a wrong address first, then the link to send
  await lp.getByLabel('Full name').fill(GROUP_FLOW.invitee.name)
  await lp.getByLabel('Email address').fill('not-an-address')
  await lp.getByRole('button', { name: 'Add and invite' }).click()
  await expect(lp.getByText('Enter a full email address.')).toBeVisible()
  await lp.getByLabel('Email address').fill(GROUP_FLOW.invitee.email)
  await lp.getByRole('button', { name: 'Add and invite' }).click()
  await expect(lp.getByText(`Send this link to ${GROUP_FLOW.invitee.name}`)).toBeFocused()
  const link = await lp.getByLabel('Invitation link').inputValue()
  expect(link).toMatch(/\/join\/[A-Za-z0-9_-]{22}$/)
  await expect(lp.getByRole('list', { name: 'Invitations' }).getByRole('listitem')).toContainText(GROUP_FLOW.invitee.email)
  await axe(lp)
  const path = new URL(link).pathname

  // a visitor with the link: the group and the name, never the address; another address is refused
  const visitor = await browser.newContext({ baseURL })
  const vp = await visitor.newPage()
  await vp.goto(path)
  await expect(vp.getByRole('heading', { level: 1, name: `Charter leader invites you to ${GROUP_FLOW.group.name}` })).toBeVisible()
  await expect(vp.getByText(GROUP_FLOW.invitee.email)).toHaveCount(0)
  await vp.getByLabel('Email address').fill(GROUP_FLOW.member.email)
  await vp.getByRole('button', { name: 'Send me a sign-in link' }).click()
  await expect(vp.getByText('This invitation is for another email address.')).toBeVisible()
  await axe(vp)
  await visitor.close()

  // the invitee, signed in: joins and lands on the group's Home
  const invitee = await signedIn(browser, baseURL!, GROUP_FLOW.invitee)
  await invitee.page.goto(path)
  await invitee.page.getByRole('button', { name: `Join ${GROUP_FLOW.group.name}` }).click()
  await expect(invitee.page).toHaveURL(new RegExp(`/app/${GROUP_FLOW.group.id}/home$`))
  await lp.reload()
  await expect(list).toHaveCount(3)
  await expect(lp.getByRole('list', { name: 'Invitations' })).toHaveCount(0)
  await invitee.page.goto(path)
  await expect(invitee.page).toHaveURL(new RegExp(`/app/${GROUP_FLOW.group.id}/home$`))

  // removed: access ends at once
  const row = list.filter({ hasText: GROUP_FLOW.invitee.name })
  await row.getByRole('button', { name: 'Remove' }).click()
  await expect(lp.getByText(`Remove ${GROUP_FLOW.invitee.name} from ${GROUP_FLOW.group.name}?`)).toBeFocused()
  await lp.getByRole('button', { name: 'Remove from the group' }).click()
  await expect(list).toHaveCount(2)
  await invitee.page.goto(`/app/${GROUP_FLOW.group.id}/home`)
  await expect(invitee.page.getByRole('heading', { name: 'This group is not one of yours' })).toBeVisible()

  // a new leader: the leader stays as a member, then is named leader again by the new one
  await list.filter({ hasText: GROUP_FLOW.member.name }).getByRole('button', { name: 'Make team leader' }).click()
  await lp.getByRole('button', { name: 'Make team leader' }).last().click()
  await expect(list.first()).toContainText(GROUP_FLOW.member.name)
  await expect(list.filter({ hasText: 'Charter leader (you)' })).toContainText('Member · since')
  await expect(lp.getByRole('button', { name: 'Remove' })).toHaveCount(0)
  await expect(lp.getByText('Only the team leader manages members.')).toBeVisible()
  await mp.goto(membersPage)
  await mp.getByRole('list', { name: 'Members', exact: true }).getByRole('listitem').filter({ hasText: GROUP_FLOW.leader.name }).getByRole('button', { name: 'Make team leader' }).click()
  await mp.getByRole('button', { name: 'Make team leader' }).last().click()
  await lp.reload()
  await expect(list.first()).toContainText('Charter leader (you)')

  expect(problems).toEqual([])
  await leader.context.close()
  await invitee.context.close()
  await member.context.close()
})

test('on the Free plan the group page stays a sample', async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'at 1280 px')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  // a Lumio member no other flow signs in
  const maja = LUMIO.people.find((p) => p.name === 'Maja Strand')!
  await signInPerson(page, baseURL!, maja)
  await page.goto(`/app/${LUMIO.group.id}/group`)
  await expect(page.getByText('Sample', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the charter' })).toHaveCount(0)
})
