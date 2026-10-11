import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Milestone 1: the specimens page shows every component of /components/lp, passes axe, and does not
 * scroll sideways, at 1280, 390 and 360 px. The side-by-side comparison with the design is
 * scripts/verify/side-by-side.mjs; the phone rules are scripts/verify/mobile.mjs.
 */
const SPECIMENS = [
  'topbar', 'nav-item-active', 'nav-item', 'plan-pill', 'hero-block', 'card', 'section-header', 'list-row',
  'button-primary', 'button-secondary', 'button-small', 'button-danger', 'pill', 'tabs', 'option-row-off',
  'option-row-on', 'progress-bar', 'level-bar', 'count-dots', 'hint-box', 'warning-box', 'sample-banner',
  'evidence-chip-strong', 'evidence-chip-moderate', 'evidence-chip-other', 'standing-label', 'avatar', 'toast',
  'icon-tile',
]

test('every component is on the specimens page, accessible and within the screen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })

  const response = await page.goto('/specimens')
  expect(response?.status()).toBe(200)
  await page.evaluate(() => document.fonts.ready)

  for (const id of SPECIMENS) {
    await expect(page.locator(`[data-specimen="${id}"]`), id).toHaveCount(1)
  }

  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([])

  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(sideways).toBe(false)
  expect(errors).toEqual([])
})

test('the fonts are the self-hosted files', async ({ page }) => {
  await page.goto('/specimens')
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`)
  })
  expect(loaded.some((f) => f.startsWith('Figtree'))).toBe(true)
  expect(loaded.some((f) => f.startsWith('Poppins'))).toBe(true)
})
