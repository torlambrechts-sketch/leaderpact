import { expect, test, type Browser, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { PRIVACY_FLOW } from '../../scripts/seed/fixture.mjs'
import { canDispatch, dispatchOnce } from './support/dispatch'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 16 (handoff 6.18 and 8; D-53): "An export arrives. A delete removes personal data. Limits return 429."
 * On the privacy flow's group (scripts/seed/fixture.mjs, PRIVACY_FLOW): the leader sets a time zone and the
 * summary, asks for their data, gets the mail from the dispatcher's own loop and downloads the ZIP once; a
 * second press says the link was used. The only leader cannot delete their account; a member can, and is
 * signed out. The limits' 429s are proved in tests/unit/privacy.test.ts and supabase/tests/limits_invariants.sql.
 */
const settings = (tab: string) => `/app/${PRIVACY_FLOW.group.id}/settings/${tab}`
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

async function signedIn(browser: Browser, baseURL: string, person: { id: string; email: string }) {
  const context = await browser.newContext({ baseURL, acceptDownloads: true })
  const page = await context.newPage()
  await signInPerson(page, baseURL, person)
  return { context, page }
}

test('settings: time zone, summary, the export by mail, and deleting an account', async ({ browser, baseURL }, info) => {
  // Auth sends one address one link per interval, so each person signs in once, here (D-27)
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, with a phone-width pass; two people sign in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.skip(!canDispatch(), 'no local database to drain: needs DB_URL (CI) or DATABASE_URL (local-pg.sh)')
  test.setTimeout(180_000)
  const leader = await signedIn(browser, baseURL!, PRIVACY_FLOW.leader)
  const lp = leader.page
  const problems = watch(lp)

  // Settings opens on Account: the person, their address, how they sign in
  await lp.goto(`/app/${PRIVACY_FLOW.group.id}/settings`)
  await expect(lp).toHaveURL(new RegExp(`${settings('account')}$`))
  await expect(lp.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  const menu = lp.getByRole('navigation', { name: 'Settings' })
  await expect(menu.getByRole('link', { name: 'Account' })).toHaveAttribute('aria-current', 'page')
  await expect(menu.getByRole('link')).toHaveText(['Account', 'Notifications', 'Privacy', 'Plan and billing'])
  await expect(lp.getByText(PRIVACY_FLOW.leader.email)).toBeVisible()
  await expect(lp.getByText('A link by email. No password.')).toBeVisible()
  await axe(lp)

  // the time zone, saved and read back
  await lp.getByLabel('Time zone').selectOption('Europe/Oslo')
  await lp.getByRole('button', { name: 'Save' }).click()
  await expect(lp.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()
  await lp.reload()
  await expect(lp.getByLabel('Time zone')).toHaveValue('Europe/Oslo')

  // the summary: monthly, in that zone
  await menu.getByRole('link', { name: 'Notifications' }).click()
  await expect(lp.getByText('Your time zone is Europe/Oslo.')).toBeVisible()
  await expect(lp.getByRole('radio', { name: /^Weekly/ })).toBeChecked()
  await lp.getByRole('radio', { name: /^Monthly/ }).click()
  await lp.getByRole('button', { name: 'Save' }).click()
  await expect(lp.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()
  await lp.reload()
  await expect(lp.getByRole('radio', { name: /^Monthly/ })).toBeChecked()
  await expect(lp.getByText('A reminder never says who has not answered.')).toBeVisible()
  await axe(lp)

  // Privacy: no profile, the export, and the rules that hold
  await lp.getByRole('navigation', { name: 'Settings' }).getByRole('link', { name: 'Privacy' }).click()
  await expect(lp.getByText('Not taken. Nothing is stored.')).toBeVisible()
  await expect(lp.getByRole('heading', { name: 'How data is handled' })).toBeVisible()
  await expect(lp.getByText('never under 4 answers', { exact: false })).toBeVisible()
  await axe(lp)
  await lp.getByRole('button', { name: 'Request export' }).click()
  await expect(lp.getByRole('status').filter({ hasText: `The link is on its way to ${PRIVACY_FLOW.leader.email}.` })).toBeVisible()

  // the phones: every tab fits at 360 px
  for (const width of [390, 360]) {
    await lp.setViewportSize({ width, height: 800 })
    for (const tab of ['account', 'notifications', 'privacy']) {
      await lp.goto(settings(tab))
      await expect(lp.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
      expect(await sideways(lp), `${tab} at ${width} px`).toBe(false)
    }
  }
  await axe(lp)
  await lp.setViewportSize({ width: 1280, height: 800 })

  // the dispatcher sends the export's mail: one, to the leader, with a link of its own
  const sent = await dispatchOnce(baseURL!)
  const mail = sent.find((m) => m.tag === 'export_ready' && m.to.some((r) => r.email === PRIVACY_FLOW.leader.email))
  expect(mail, 'the export mail').toBeTruthy()
  expect(mail!.to).toHaveLength(1)
  const link = /https?:\/\/\S+\/export\/[A-Za-z0-9_-]+/.exec(mail!.text)?.[0]
  expect(link).toBeTruthy()

  // opening the link uses nothing; the button downloads the file once
  const path = new URL(link!).pathname
  await lp.goto(path)
  await lp.goto(path)
  await expect(lp.getByRole('heading', { level: 1, name: 'Download your data' })).toBeVisible()
  await axe(lp)
  const [download] = await Promise.all([lp.waitForEvent('download'), lp.getByRole('button', { name: 'Download' }).click()])
  expect(download.suggestedFilename()).toMatch(/^leaderpact-data-\d{4}-\d{2}-\d{2}\.zip$/)
  const bytes = readFileSync((await download.path())!)
  expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304')
  const text = bytes.toString('utf8')
  expect(text).toContain('"format": "leaderpact-export/1"')
  expect(text).toContain(PRIVACY_FLOW.leader.email)
  expect(text).toContain('"summary": "monthly"')
  // a second press: used
  await lp.goto(path)
  await lp.getByRole('button', { name: 'Download' }).click()
  await expect(lp.getByRole('heading', { level: 1, name: 'This link has been used' })).toBeVisible()

  // the only leader of a group with others names another leader first
  await lp.goto(settings('account'))
  await lp.getByRole('button', { name: 'Delete account' }).click()
  await lp.getByRole('button', { name: 'Delete my account' }).click()
  await expect(lp.getByRole('alert').filter({ hasText: `You are the only team leader of ${PRIVACY_FLOW.group.name}.` })).toBeVisible()
  expect(problems).toEqual([])

  // a member deletes their account: asked once more, then signed out
  const member = await signedIn(browser, baseURL!, PRIVACY_FLOW.member)
  const mp = member.page
  await mp.goto(settings('account'))
  await mp.getByRole('button', { name: 'Delete account' }).click()
  await expect(mp.getByText('Delete your account? This cannot be undone.')).toBeFocused()
  await mp.getByRole('button', { name: 'Keep my account' }).click()
  await mp.getByRole('button', { name: 'Delete account' }).click()
  await mp.getByRole('button', { name: 'Delete my account' }).click()
  await mp.waitForURL(/\/leadership-team-assessment$/)
  await mp.goto(settings('account'))
  await expect(mp).toHaveURL(/\/sign-in$/)

  // and the group no longer lists them
  await lp.goto(`/app/${PRIVACY_FLOW.group.id}/people`)
  await expect(lp.getByText(PRIVACY_FLOW.member.name, { exact: true })).toHaveCount(0)
  await expect(lp.getByText(PRIVACY_FLOW.people[2]!.name, { exact: true })).toBeVisible()

  await member.context.close()
  await leader.context.close()
})
