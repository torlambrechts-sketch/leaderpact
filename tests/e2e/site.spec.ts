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
  await expect(page.getByText(/^Updated 14 October 2026 · \d+ min read$/)).toBeVisible()
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(ld).toContain('"@type":"Article"')
  expect(ld).toContain('"citation"')
  await axe(page)
  expect(problems).toEqual([])
})

test('the figures (D-41): drawn, cited to the source list, accessible at every width', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/articles/psychological-safety-in-leadership-teams')
  // the 2 by 2: each cell says where it sits, for a reader who cannot see the grid
  await expect(page.getByRole('listitem').filter({ hasText: 'Learning zone' })).toContainText('High, High')
  // a figure's source is a link to that source in the numbered list
  const cite = page.getByRole('link', { name: 'Edmondson (2018)' })
  await expect(cite).toHaveAttribute('href', /^#source-\d+$/)
  const target = (await cite.getAttribute('href'))!.slice(1)
  await expect(page.locator(`#${target}`)).toContainText('The fearless organization')
  await expect(page.getByText('22,000+')).toBeVisible()
  await axe(page)

  await page.goto('/articles/leadership-team-meeting-agenda')
  // an example is marked as one, and the time bar's minutes are read from the list, not the drawing
  await expect(page.getByText('110 minutes in all')).toBeVisible()
  await expect(page.getByText('An example to show the idea, not data from a real team.').first()).toBeVisible()
  await axe(page)

  await page.goto('/articles/how-big-should-a-leadership-team-be')
  await expect(page.getByText('A team of n members has n × (n − 1) ÷ 2 pairs.')).toBeVisible()
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

test('the Platform menu (D-46): opens, lists every feature, closes on Escape and leads to the page', async ({ page }) => {
  const problems = watch(page)
  await page.goto('/articles')
  const phone = (page.viewportSize()?.width ?? 1280) < 768
  const button = phone ? page.getByRole('button', { name: 'Open the menu' }) : page.getByRole('banner').getByRole('button', { name: 'Platform' })
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  // closed, the panel is not in the page at all
  await expect(page.getByRole('banner').getByRole('link', { name: /Full diagnostic/ })).toHaveCount(0)
  await button.click()
  const opened = phone ? page.getByRole('button', { name: 'Close the menu' }) : button
  await expect(opened).toHaveAttribute('aria-expanded', 'true')
  for (const name of ['Leadership Team Scan', 'Team view', 'Leader Profile', 'Charter and members', 'Full diagnostic', 'How it works', 'Anonymity', 'Research']) {
    await expect(page.getByRole('banner').getByRole('link', { name: new RegExp(`^${name}`) }).first()).toBeVisible()
  }
  await axe(page)
  await page.keyboard.press('Escape')
  await expect(phone ? page.getByRole('button', { name: 'Open the menu' }) : button).toBeFocused()
  await expect(page.getByRole('banner').getByRole('link', { name: /Full diagnostic/ })).toHaveCount(0)

  await (phone ? page.getByRole('button', { name: 'Open the menu' }) : button).click()
  await page.getByRole('banner').getByRole('link', { name: /^Full diagnostic/ }).click()
  await expect(page).toHaveURL(/\/platform\/full-diagnostic$/)
  await expect(page.getByRole('heading', { level: 1, name: 'The Full diagnostic' })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('link', { name: /^Team view/ })).toHaveCount(0)
  expect(problems).toEqual([])
})

for (const [path, heading] of [
  ['/platform/leadership-team-scan', 'The Leadership Team Scan'],
  ['/platform/team-view', 'The team view'],
  ['/platform/leader-profile', 'The Leader Profile'],
  ['/platform/team-charter', 'The group’s charter'],
  ['/platform/full-diagnostic', 'The Full diagnostic'],
] as const) {
  test(`the feature page ${path}: screenshots of the real app, marked, and what it brings`, async ({ page }) => {
    const problems = watch(page)
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    for (const who of ['For you', 'For the leadership group', 'For the organisation']) await expect(page.getByText(who, { exact: true })).toBeVisible()
    // every screenshot has its description, loads, and is marked as sample data from a fictional group
    const shots = page.locator('main img[src^="/shots/"]')
    expect(await shots.count()).toBeGreaterThanOrEqual(2)
    for (const img of await shots.all()) {
      expect(await img.getAttribute('alt')).toMatch(/\w{4,}/)
      await img.scrollIntoViewIfNeeded()
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0)
    }
    await expect(page.getByText('Sample data').first()).toBeVisible()
    await expect(page.getByText('A fictional group: every name and answer is invented.').first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'More of the platform' })).toBeVisible()
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
  expect(sitemap).toContain('https://www.leaderpact.com/platform/team-charter')
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Sitemap: https://www.leaderpact.com/sitemap.xml')
  expect(robots).toContain('Disallow: /app')
  const llms = await (await request.get('/llms.txt')).text()
  expect(llms).toMatch(/^# LeaderPact/)
  expect(llms).toContain('(https://www.leaderpact.com/articles/how-to-build-trust-in-a-leadership-team)')
})
