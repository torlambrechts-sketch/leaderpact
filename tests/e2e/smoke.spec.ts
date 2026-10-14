import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { axe } from './support/page'

/**
 * The smoke: the root leads to the landing page, which renders, is accessible, does not scroll sideways
 * and carries the security headers; and a page behind sign-in refuses an anonymous visitor.
 */
test('the root leads to the landing page, which renders and passes axe', async ({ page }) => {
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
  expect(new URL(page.url()).pathname).toBe('/leadership-team-assessment')
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

test('an address under no route answers 404 in the site, never sign-in, and the app stays behind it (D-49)', async ({ page, request, baseURL }) => {
  for (const path of ['/blog/2019/hello-world', '/product/old-widget', '/sitemap_index.xml', '/articles/no-such-article']) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(404)
  }
  // no spelling of the app's address gets past the session check
  // absolute, so "//app" stays a path and is not read as a host
  for (const path of ['/app/me', '/%61pp/me', '//app/me']) {
    const response = await request.get(`${baseURL}${path}`, { maxRedirects: 0 })
    expect([307, 308], path).toContain(response.status())
  }
  const response = await page.goto('/product/old-widget')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'This page is not here' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: /How it works/ })).toBeVisible()
  expect(await page.locator('meta[name="robots"]').first().getAttribute('content')).toContain('noindex')
  await axe(page)
})

test('a page behind sign-in sends an anonymous visitor to sign-in', async ({ request }) => {
  const response = await request.get('/app/me', { maxRedirects: 0 })
  expect(response.status()).toBe(307)
  expect(new URL(response.headers()['location'] ?? '', 'http://x').pathname).toBe('/sign-in')
})
