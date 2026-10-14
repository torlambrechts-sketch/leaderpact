import { expect, test, type Page } from '@playwright/test'
import { ROUND_STATES } from '../../scripts/seed/fixture.mjs'
import { canSignIn, signInPerson } from './support/leader'
import { axe, watch } from './support/page'

/**
 * Milestone 11 (handoff 12; D-45): "Every row shows level, agreement label and one standing. No forbidden
 * element appears." On the round states' group (scripts/seed/fixture.mjs, ROUND_STATES): two released
 * rounds of the Full diagnostic, the second answered as the first on half its questions, so its overview
 * shows change and no change. A member reads the overview, one scale, and its questions; an earlier round
 * shows no change. Nothing forbidden appears at any depth, on a wide screen or a phone.
 */
const results = `/app/${ROUND_STATES.group.id}/results`
const FORBIDDEN = /\b(median|lowest|highest|standard deviation|SD|rwg|confidence|distribution|percentile)\b|%/i

async function nothingForbidden(page: Page) {
  const text = (await page.getByRole('main').textContent()) ?? ''
  expect(text).not.toMatch(FORBIDDEN)
}

test('results in three depths: every row a level, an agreement label and one standing, and nothing forbidden', async ({ page, baseURL }, info) => {
  // Auth sends one address one link per interval, so this member signs in once, here (D-27)
  test.skip(info.project.name !== 'desktop', 'once, at 1280 px, with a phone-width pass; one person signs in')
  test.skip(!canSignIn(), 'no way to sign in: needs Mailpit (CI) or the local API (D-27)')
  test.setTimeout(120_000)
  const member = ROUND_STATES.people[2]!
  await signInPerson(page, baseURL!, member)
  const problems = watch(page)

  // the overview: the newest released round, outcomes first, 24 rows with level, label and standing
  await page.goto(results)
  await expect(page.getByRole('heading', { level: 1, name: 'Results' })).toBeVisible()
  await expect(page.getByText('Sample', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Full diagnostic · round 2$/)).toBeVisible()
  await expect(page.getByText(/4 of 5 answered\. Counts only, never names\.$/)).toBeVisible()
  await expect(page.getByText('Research-based, not yet validated · scale 1–5')).toBeVisible()
  const rounds = page.getByRole('navigation', { name: 'Rounds with a result' })
  await expect(rounds.getByRole('link', { name: 'Round 2' })).toHaveAttribute('aria-current', 'page')
  const cards = page.getByRole('main').getByRole('list')
  const rows = cards.getByRole('listitem')
  await expect(rows).toHaveCount(24)
  for (const row of await rows.all()) {
    await expect(row.getByText(/^Level \d\.\d$/)).toHaveCount(1)
    await expect(row.getByText(/^(High agreement|Medium agreement|Views differ)$/)).toHaveCount(1)
  }
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('Outcomes')
  await expect(page.getByText('Change: Within normal variation').first()).toBeAttached()
  await expect(page.getByText(/^Change: \+\d\.\d$/).first()).toBeAttached()
  await nothingForbidden(page)
  await axe(page)

  // one scale: its definition, level, label, standing, change, evidence and guidance
  await page.getByRole('link', { name: 'Clear purpose', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Clear purpose' })).toBeVisible()
  await expect(page.getByText('How clear and shared the reason for this team is.')).toBeVisible()
  await expect(page.getByText('Since round 1: Within normal variation')).toBeVisible()
  await expect(page.getByText('Meta-analyses show a consistent link between this scale and team results.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What it suggests' })).toBeVisible()
  await expect(page.getByText('Based on 4 answers. Counts only, never names.')).toBeVisible()
  await nothingForbidden(page)
  await axe(page)

  // its questions: text and mean, three of them, nothing else
  await page.getByRole('link', { name: 'See its questions' }).click()
  const questions = page.getByRole('list', { name: 'The questions of Clear purpose' })
  await expect(questions.getByRole('listitem')).toHaveCount(3)
  await expect(questions.getByText(/^Mean \d\.\d$/)).toHaveCount(3)
  await nothingForbidden(page)
  await axe(page)

  // the round before: a first round with a result shows no change
  await page.goto(results)
  await rounds.getByRole('link', { name: 'Round 1' }).click()
  await expect(page.getByText(/Full diagnostic · round 1$/)).toBeVisible()
  await expect(page.getByText('This is the first round with a result, so no change shows.')).toBeVisible()
  await expect(page.getByText('Change: First round')).toHaveCount(24)

  // on a phone: the same, with no sideways scroll
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(results)
  await expect(rows).toHaveCount(24)
  await axe(page)
  await page.getByRole('link', { name: 'Trust', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Trust' })).toBeVisible()
  await axe(page)

  expect(problems).toEqual([])
})
