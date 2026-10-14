import { expect, test } from '@playwright/test'
import { axe, watch } from './support/page'

/**
 * The public site (D-34 to D-38): the articles, a free template behind an address, the product pages and
 * what search engines read. Every page has its heading, passes axe and does not scroll sideways at any
 * width. With no Sentral secret set (development), a template request is not sent and the files are given.
 */
test('the articles: the index by section, and an article with its answer, sources and neighbours', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/articles')
  await expect(page.getByRole('heading', { level: 1, name: 'Articles on leadership teams' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Where to start' })).toBeVisible()
  await axe(page)

  await page.getByRole('link', { name: /What is the purpose of a leadership team/ }).first().click()
  await expect(page).toHaveURL(/\/articles\/leadership-team-purpose$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'In short' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Sources' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Read next' })).toBeVisible()
  await expect(page.getByText(/^Updated 13 October 2026 · \d+ min read$/)).toBeVisible()
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(ld).toContain('"@type":"Article"')
  expect(ld).toContain('"citation"')
  await axe(page)
  expect(problems).toEqual([])
})

test('a free template: the form, then the file, for this browser only', async ({ page, request }) => {
  const problems = watch(page)
  const direct = await request.get('/templates/file/leadership-team-charter-template.docx', { maxRedirects: 0 })
  expect(direct.status()).toBe(303)

  await page.goto('/templates/leadership-team-charter-template')
  await expect(page.getByRole('heading', { level: 1, name: 'Leadership team charter template' })).toBeVisible()
  await axe(page)
  await page.getByRole('button', { name: 'Get the files' }).click()
  await expect(page.getByText('Write your name and a valid e-mail address.')).toBeVisible()
  await page.getByLabel('Name').fill('Test Reader')
  await page.getByLabel('Work e-mail').fill('reader@example.com')
  await page.getByRole('button', { name: 'Get the files' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Your template is ready' })).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: /Leadership team charter \(Word\)/ }).click()
  expect((await download).suggestedFilename()).toBe('leadership-team-charter-template.docx')

  await page.reload()
  await expect(page.getByRole('heading', { level: 2, name: 'Your template is ready' })).toBeVisible()
  await axe(page)
  expect(problems).toEqual([])
})

for (const [path, heading] of [
  ['/platform', 'From a three-minute scan to better meetings'],
  ['/research', 'The research behind the model'],
  ['/anonymity', 'Anonymous by construction'],
  ['/leadership-team-assessment-tools', 'How to choose a leadership team assessment tool'],
  ['/templates', 'Free templates for leadership teams'],
] as const) {
  test(`the product page ${path}`, async ({ page }) => {
    const problems = watch(page)
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await axe(page)
    expect(problems).toEqual([])
  })
}

test('the research page reads the model: 21 scales and 3 outcomes with their evidence', async ({ page }) => {
  await page.goto('/research')
  await expect(page.getByRole('heading', { level: 2, name: '21 scales and 3 outcomes' })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: 'Psychological safety' })).toBeVisible()
  await expect(page.getByText('Conditions · 6 scales')).toBeVisible()
  await expect(page.getByText('Processes · 11 scales')).toBeVisible()
  await expect(page.getByText('States · 4 scales')).toBeVisible()
})

test('indexing (D-40): the public pages may be indexed, the private ones never, and only on the production host', async ({ page, request }) => {
  const robots = async (path: string) => {
    await page.goto(path)
    return page.locator('meta[name="robots"]').getAttribute('content')
  }
  for (const path of ['/leadership-team-assessment', '/articles', '/articles/leadership-team-purpose', '/platform', '/templates']) {
    expect(await robots(path), path).toBe('index, follow')
  }
  for (const path of ['/scan', '/scan/result', '/sign-in', '/privacy']) {
    expect(await robots(path), path).toBe('noindex, nofollow')
  }
  // this server is not www.leaderpact.com, so it says noindex in a header, as a preview does
  expect((await request.get('/articles')).headers()['x-robots-tag']).toBe('noindex')
})

test('what search engines read: the sitemap, robots.txt and llms.txt', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('https://www.leaderpact.com/articles/leadership-team-purpose')
  expect(sitemap).toContain('https://www.leaderpact.com/templates/leadership-team-charter-template')
  expect(sitemap).not.toContain('/scan/result')
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Sitemap: https://www.leaderpact.com/sitemap.xml')
  expect(robots).toContain('Disallow: /app')
  const llms = await (await request.get('/llms.txt')).text()
  expect(llms).toMatch(/^# LeaderPact/)
  expect(llms).toContain('(https://www.leaderpact.com/articles/how-to-build-trust-in-a-leadership-team)')
})
