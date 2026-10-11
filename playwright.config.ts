import { defineConfig } from '@playwright/test'

/**
 * The flows of handoff section 13, with axe, at the widths LeaderPact is built for: the design's
 * 1280 px and phones from 360 px. Adapted from Orgpuls playwright.config.ts @ 6f5d441: en-GB and UTC
 * instead of nb-NO and Europe/Oslo, and no pseudo-locale project.
 *
 * A cloud session's image ships Chromium at /opt/pw-browsers; PLAYWRIGHT_CHROMIUM points at it so
 * nothing is downloaded. CI installs Playwright's own and leaves the variable unset.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined
const port = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'en-GB',
    timezoneId: 'UTC',
    launchOptions: { executablePath, args: ['--font-render-hinting=none'] },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'phone-360', use: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npx next start -p ${port} -H 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
