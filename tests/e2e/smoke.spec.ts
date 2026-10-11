import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * Milestone 0b's smoke: the holding page renders, is accessible, does not scroll sideways, carries
 * the security headers, and a page behind sign-in refuses an anonymous visitor.
 */
test('the holding page renders and passes axe', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })

  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`)).toEqual([])

  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(sideways).toBe(false)
  expect(errors).toEqual([])
})

test('the security headers are sent', async ({ request }) => {
  const response = await request.get('/')
  const headers = response.headers()
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['referrer-policy']).toBe('no-referrer')
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['x-powered-by']).toBeUndefined()
})

test('a page behind sign-in sends an anonymous visitor to sign-in', async ({ request }) => {
  const response = await request.get('/app/me', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(new URL(response.headers()['location'] ?? '', 'http://x').pathname).toBe('/sign-in')
})
