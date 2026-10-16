import { readFile } from 'node:fs/promises'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { LUMIO } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 7 (handoff 12): "A profile is unreadable by anyone else until shared. A retake resets
 * sharing." The Leader Profile in both lengths (handoff 6.17): a visitor takes a test with no account and
 * sees a private result; a member keeps one, shares it with their group at a level, and a fellow member
 * reads it on People at that level only; a retake resets sharing; delete removes it. Two Lumio members
 * of their own sign in (Sofie Lie shares, Erik Dahl reads), since Auth sends one address one link per
 * interval and the other flows use the rest. Sofie also sends hers outside the group, as a PDF and a private link
 * that a visitor opens (D-66).
 */
const person = (name: string) => {
  const p = LUMIO.people.find((x) => x.name === name)
  if (!p) throw new Error(`no fixture person ${name}`)
  return p
}
const OPTIONS = ['Very inaccurate', 'Moderately inaccurate', 'Neither accurate nor inaccurate', 'Moderately accurate', 'Very accurate']
const BAND = /^(Lower|Middle|Higher)$/

/** Answers every question on screen with one option, ending on "See my profile" */
async function answerAll(page: Page, total: number, option = 'Moderately accurate') {
  for (let i = 0; i < total; i++) {
    await expect(page.getByText(`${i + 1} of ${total}`, { exact: true })).toBeVisible()
    await page.getByRole('radio', { name: option, exact: true }).click()
    await page.getByRole('button', { name: i === total - 1 ? 'See my profile' : 'Next' }).click()
  }
}

test('a visitor: the public page, the quick test with no account, resuming, and a private result', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/leader-profile')
  await expect(page.getByRole('heading', { level: 1, name: 'Leader Profile' })).toBeVisible()
  await expect(page.getByText('A first look', { exact: true })).toBeVisible()
  await expect(page.getByText('120 questions · about 20 minutes · five domains and 30 facets')).toBeVisible()
  await expect(page.getByText('Research-based, not yet validated', { exact: true })).toBeVisible()
  await expect(page.getByText(/International Personality Item Pool .* public domain: the Mini-IPIP and the IPIP-NEO-120\./)).toBeVisible()
  // what it measures and what the questions look like (D-62), read from the published rows
  await expect(page.getByRole('heading', { level: 2, name: 'What it measures' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'What it measures' }).getByRole('heading', { level: 3 })).toHaveCount(5)
  await expect(page.getByRole('list', { name: 'The facets of Openness to experience' }).getByRole('listitem')).toHaveCount(6)
  await expect(page.getByRole('heading', { level: 2, name: 'What the questions look like' })).toBeVisible()
  await expect(page.getByText('Am the life of the party.', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'The five answers' }).getByRole('listitem')).toHaveText(OPTIONS)
  await expect(page.getByText('In the full test, 55 of the 120 do.', { exact: false })).toBeVisible()
  await expect(page.getByText('An average answer below 2.33 is lower, above 3.67 is higher', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: /Johnson, J\. A\. \(2014\)/ })).toHaveAttribute('href', 'https://ipip.ori.org/30FacetNEO-PI-RItems.htm')
  await axe(page)

  await page.getByRole('link', { name: 'Start the quick test' }).click()
  await expect(page).toHaveURL(/\/leader-profile\/quick$/)
  await expect(page.getByText('How accurately does this describe you?')).toBeVisible()
  for (const option of OPTIONS) await expect(page.getByRole('radio', { name: option, exact: true })).toBeVisible()
  await axe(page)

  // three answers, then the page is left: the test resumes on this device where it was left
  for (let i = 0; i < 3; i++) {
    await page.getByRole('radio', { name: 'Moderately accurate', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
  }
  await expect(page.getByText('4 of 20', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('4 of 20', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('radio', { name: 'Moderately accurate', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Next' }).click()
  for (let i = 3; i < 20; i++) {
    await page.getByRole('radio', { name: 'Moderately accurate', exact: true }).click()
    await page.getByRole('button', { name: i === 19 ? 'See my profile' : 'Next' }).click()
  }

  // the result, computed on the device: five domains as bands, a first look, no norm group
  await expect(page.getByRole('heading', { level: 1, name: 'Your Leader Profile' })).toBeVisible()
  await expect(page.getByText('Quick test · Mini-IPIP · 20 questions · a first look')).toBeVisible()
  const rows = page.getByRole('list', { name: 'Lower, middle and higher thirds of the answer scale' }).getByRole('listitem')
  await expect(rows).toHaveCount(5)
  for (const text of await rows.allInnerTexts()) expect(text.split('\n').at(-1)?.trim()).toMatch(BAND)
  await expect(page.getByText('Your position on the answer scale, in three equal bands. No norm group is used.')).toBeVisible()
  await expect(page.getByText(/\b(good|bad|better|worse)\b/i).filter({ hasNotText: 'never good or bad' })).toHaveCount(0)
  await expect(page.getByText(/percentile|\d+\s?%|norm group of/i)).toHaveCount(0)
  // keeping it asks for an email address: a visitor has no account
  await expect(page.getByRole('heading', { name: 'Keep your profile' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await axe(page)
  expect(problems).toEqual([])
})

test('the full test: 120 questions, five domains and 30 facets', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px: 120 questions')
  test.setTimeout(180_000)
  await page.goto('/leader-profile/full')
  await answerAll(page, 120)
  await expect(page.getByText('Full test · IPIP-NEO-120 · 120 questions')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Lower, middle and higher thirds of the answer scale' }).getByRole('listitem')).toHaveCount(5)
  for (const domain of ['Openness to experience', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism']) {
    await expect(page.getByRole('heading', { level: 3, name: `${domain} · facets` })).toBeVisible()
  }
  // every answer "Moderately accurate": a facet keyed all one way reads higher or lower, never by chance
  await expect(page.getByText('Anxiety: Higher')).toBeAttached()
  await expect(page.getByText('Morality: Lower')).toBeAttached()
  await axe(page)
})

async function signedIn(browser: Browser, baseURL: string, name: string) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signInPerson(page, baseURL, person(name))
  return { context, page }
}

test('a member keeps, shares, retakes and deletes; a fellow member sees it only as shared', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px; two people sign in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(120_000)
  const owner = await signedIn(browser, baseURL!, 'Sofie Lie')
  const viewer = await signedIn(browser, baseURL!, 'Erik Dahl')
  const problems = watch(owner.page)
  const people = `/app/${LUMIO.group.id}/people`
  const sofie = (page: Page) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Sofie Lie' }) })

  // a fresh start: no profile from an earlier run
  await owner.page.goto('/app/me')
  if (await owner.page.getByRole('button', { name: 'Delete my profile' }).isVisible()) {
    await owner.page.getByRole('button', { name: 'Delete my profile' }).click()
    await owner.page.getByRole('button', { name: 'Delete it' }).click()
  }
  await expect(owner.page.getByRole('heading', { name: 'You have no Leader Profile yet' })).toBeVisible()
  await axe(owner.page)

  // taken and kept: Me shows it, private, with sharing at nothing
  await owner.page.getByRole('link', { name: 'Start the quick test' }).first().click()
  await answerAll(owner.page, 20)
  await expect(owner.page.getByRole('heading', { name: 'Keep it in your profile' })).toBeVisible()
  await owner.page.getByRole('button', { name: 'Keep my profile' }).click()
  await expect(owner.page).toHaveURL(/\/app\/me$/)
  await expect(owner.page.getByRole('heading', { level: 1, name: 'Sofie Lie' })).toBeVisible()
  await expect(owner.page.getByRole('list', { name: 'Lower, middle and higher thirds of the answer scale' }).getByRole('listitem')).toHaveCount(5)
  const group = owner.page.getByRole('radiogroup', { name: `What ${LUMIO.group.name} sees` })
  await expect(group.getByRole('radio', { name: /^Nothing/ })).toBeChecked()
  await axe(owner.page)

  // unread by anyone else until shared
  await viewer.page.goto(people)
  await expect(sofie(viewer.page).getByText('Not shared', { exact: true })).toBeVisible()
  await expect(sofie(viewer.page).getByText(BAND)).toHaveCount(0)
  await axe(viewer.page)

  // shared as domains: the fellow member reads the five domains' bands, and nothing more
  await group.getByRole('radio', { name: /^Domains\s*The five/ }).click()
  await expect(owner.page.getByText('Sharing updated.')).toBeVisible()
  await viewer.page.reload()
  await expect(sofie(viewer.page).getByText('Shares domains · quick test')).toBeVisible()
  await expect(sofie(viewer.page).locator('dd')).toHaveCount(5)
  await expect(sofie(viewer.page).getByText('Facets')).toHaveCount(0)

  // outside the groups (D-66): a PDF to send, and a private link that anyone holding it opens, at its level
  const [download] = await Promise.all([owner.page.waitForEvent('download'), owner.page.getByRole('link', { name: 'Download PDF' }).click()])
  expect(download.suggestedFilename()).toBe('leader-profile.pdf')
  expect((await readFile((await download.path())!)).subarray(0, 5).toString()).toBe('%PDF-')
  await owner.page.getByRole('button', { name: 'Make a private link' }).click()
  const field = owner.page.getByLabel('Your private link')
  await expect(field).toHaveValue(/\/p\/[A-Za-z0-9_-]{22}$/)
  await expect(owner.page.getByText('Copy your link now. Only a fingerprint of it is kept, so it cannot be shown again.')).toBeVisible()
  const link = await field.inputValue()
  await axe(owner.page)
  const visitor = await browser.newContext({ baseURL })
  const opened = await visitor.newPage()
  const seen = watch(opened)
  await opened.goto(link)
  await expect(opened.getByRole('heading', { level: 1, name: 'Sofie Lie' })).toBeVisible()
  await expect(opened.getByText('Leader Profile · shared by its owner')).toBeVisible()
  await expect(opened.getByRole('list', { name: 'Lower, middle and higher thirds of the answer scale' }).getByRole('listitem')).toHaveCount(5)
  await expect(opened.getByText('Research-based, not yet validated', { exact: true })).toBeVisible()
  await expect(opened.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await axe(opened)
  // turned off, it opens nothing, the same as a link that never was
  await owner.page.reload()
  await expect(owner.page.getByText(/^A private link is on\. It shows the five domains, and was made on /)).toBeVisible()
  await owner.page.getByRole('button', { name: 'Turn the link off' }).click()
  await expect(owner.page.getByText('The link is off. It opens nothing now.')).toBeVisible()
  await opened.reload()
  await expect(opened.getByRole('heading', { level: 1, name: 'This link opens nothing' })).toBeVisible()
  await opened.goto('/p/AAAAAAAAAAAAAAAAAAAAAA')
  await expect(opened.getByRole('heading', { level: 1, name: 'This link opens nothing' })).toBeVisible()
  // a new link, then a retake below ends it, as it resets every share
  await owner.page.getByRole('button', { name: 'Make a private link' }).click()
  const second = await owner.page.getByLabel('Your private link').inputValue()
  expect(second).not.toBe(link)

  // a retake replaces the profile and resets sharing to nothing
  await owner.page.goto('/leader-profile/quick')
  await answerAll(owner.page, 20, 'Very accurate')
  await expect(owner.page.getByText('This replaces your current profile and resets sharing to nothing.')).toBeVisible()
  await owner.page.getByRole('button', { name: 'Keep my profile' }).click()
  await expect(owner.page).toHaveURL(/\/app\/me$/)
  await expect(owner.page.getByRole('radiogroup', { name: `What ${LUMIO.group.name} sees` }).getByRole('radio', { name: /^Nothing/ })).toBeChecked()
  await viewer.page.reload()
  await expect(sofie(viewer.page).getByText('Not shared', { exact: true })).toBeVisible()
  await opened.goto(second)
  await expect(opened.getByRole('heading', { level: 1, name: 'This link opens nothing' })).toBeVisible()
  expect(seen).toEqual([])
  await visitor.close()

  // delete: gone at once, and the group still reads nothing
  await owner.page.getByRole('radiogroup', { name: `What ${LUMIO.group.name} sees` }).getByRole('radio', { name: /^Domains and facets/ }).click()
  await expect(owner.page.getByText('Sharing updated.')).toBeVisible()
  await owner.page.getByRole('button', { name: 'Delete my profile' }).click()
  await expect(owner.page.getByText('Delete your Leader Profile?')).toBeFocused()
  await owner.page.getByRole('button', { name: 'Delete it' }).click()
  await expect(owner.page.getByRole('heading', { name: 'You have no Leader Profile yet' })).toBeVisible()
  await viewer.page.reload()
  await expect(sofie(viewer.page).getByText('Not shared', { exact: true })).toBeVisible()

  expect(problems).toEqual([])
  await owner.context.close()
  await viewer.context.close()
})
