/**
 * The product screenshots on the public site (D-47), taken from the real app with the fixture's screenshot groups.
 *
 *   eval "$(bash scripts/qa/local-pg.sh)" && eval "$(bash scripts/qa/local-api.sh)"
 *   node scripts/seed/fixture.mjs --db "$DATABASE_URL" --e2e --shots
 *   NEXT_DIST_DIR=.next-build npx next build && NEXT_DIST_DIR=.next-build npx next start -p 3100 -H 127.0.0.1 &
 *   node scripts/shots/capture.mjs [--base http://127.0.0.1:3100] [only-these-ids …]
 *
 * Every picture is the product as it renders today, signed in as one of the fixture's invented people (D-27: a
 * minted session on the local Data API), never edited afterwards. The names and answers are the fixture's, so
 * every picture is marked as a fictional demo group where the site shows it. The requests carry the production
 * host, so an invite link reads www.leaderpact.com, not the local server.
 *
 * A picture keeps the whole screen, the whole page (`full`), its top `clip` CSS pixels, where the rest is a
 * footer or a form the page is not about, or one `region` of it: an app page's content without the top bar,
 * cut at `maxHeight` where the page runs long. A phone picture can instead keep the screen with one element (`view`)
 * scrolled to its middle, as the phone shows it, its tab bar in place.
 *
 * Writes public/shots/<id>.webp and data/shots.json (each picture's file, size and device), which
 * lib/site/shots.ts reads. Local only: it refuses an API that is not on 127.0.0.1 or localhost.
 */
import { createHmac } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { SHOTS, localOnly } from '../seed/fixture.mjs'

const argv = process.argv.slice(2)
const at = argv.indexOf('--base')
const BASE = at >= 0 ? argv[at + 1] : 'http://127.0.0.1:3100'
const only = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base')
const SECRET = process.env.LOCAL_API_JWT_SECRET
const API = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!SECRET || !API || !localOnly(API) || !localOnly(BASE)) {
  console.error('shots: run against the local Data API and a local server (scripts/qa/local-api.sh); refused')
  process.exit(2)
}

const G = SHOTS.group.id
const SALES = SHOTS.sales.group.id
const [kari, ola, ingrid] = SHOTS.people
const henrik = SHOTS.people[7]
const OPTION = ['', 'Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']
/** A personal view with some spread: the scan's twelve answers, two per theme */
const SCAN_ANSWERS = [4, 5, 2, 3, 4, 3, 2, 2, 4, 3, 5, 4]

const DESKTOP = { width: 1180, height: 820, device: 'desktop' }
/** An app page's content, without the app's top bar, so the words stay readable at the size a page shows them */
const CONTENT = 'main > div'
const PHONE = { width: 390, height: 844, device: 'phone' }

/** Each picture: who is signed in, where, at which size, what to do first, and what to keep */
const PICTURES = [
  {
    id: 'scan-question',
    at: PHONE,
    path: '/scan',
    steps: async (page) => {
      for (const value of SCAN_ANSWERS.slice(0, 4)) {
        await page.getByRole('radio', { name: OPTION[value], exact: true }).click()
        await page.getByRole('button', { name: 'Next' }).click()
      }
      await page.getByRole('radio', { name: OPTION[SCAN_ANSWERS[4]], exact: true }).click()
    },
    clip: 720,
  },
  {
    id: 'scan-personal-view',
    at: PHONE,
    path: '/scan',
    steps: async (page) => {
      for (const [i, value] of SCAN_ANSWERS.entries()) {
        await page.getByRole('radio', { name: OPTION[value], exact: true }).click()
        if (i < SCAN_ANSWERS.length - 1) await page.getByRole('button', { name: 'Next' }).click()
      }
      await page.getByRole('button', { name: 'See my view' }).click()
      await page.getByRole('heading', { level: 1, name: 'Your reading of the team' }).waitFor()
    },
    full: true,
    clip: 800,
  },
  { id: 'invite-counter', as: ingrid, at: DESKTOP, path: `/app/${SALES}/invite`, region: CONTENT },
  { id: 'join-link', at: PHONE, path: `/j/${SHOTS.sales.scan.code}`, clip: 712 },
  { id: 'team-view', as: kari, at: DESKTOP, path: `/app/${G}/team`, region: CONTENT },
  { id: 'home', as: kari, at: DESKTOP, path: `/app/${G}/home`, region: CONTENT },
  { id: 'charter', as: kari, at: DESKTOP, path: `/app/${G}/group`, region: CONTENT },
  {
    id: 'members',
    as: kari,
    at: DESKTOP,
    path: `/app/${G}/group`,
    steps: async (page) => {
      await page.getByRole('tab', { name: 'Members' }).or(page.getByRole('link', { name: 'Members' })).first().click()
      await page.waitForLoadState('networkidle')
    },
    region: CONTENT,
  },
  { id: 'people', as: kari, at: DESKTOP, path: `/app/${G}/people`, region: CONTENT },
  // the round answering, at the top of Assess; the pulses below it have pictures of their own
  { id: 'assess', as: kari, at: DESKTOP, path: `/app/${G}/assess`, region: CONTENT, maxHeight: 305 },
  { id: 'diagnostic-intro', as: henrik, at: DESKTOP, path: `/app/${G}/assess/${SHOTS.round}`, region: CONTENT },
  {
    id: 'diagnostic-question',
    as: henrik,
    at: PHONE,
    path: `/app/${G}/assess/${SHOTS.round}`,
    steps: async (page) => {
      await page.getByRole('button', { name: 'Start' }).click()
      await page.getByRole('radio', { name: OPTION[4], exact: true }).click()
    },
    clip: 660,
  },
  { id: 'results', as: kari, at: DESKTOP, path: `/app/${G}/results`, region: CONTENT, maxHeight: 900 },
  {
    id: 'results-scale',
    as: kari,
    at: DESKTOP,
    path: `/app/${G}/results`,
    steps: async (page) => {
      await page.getByRole('link', { name: 'Meeting goals' }).first().click()
      // a client-side navigation: wait for the scale's own address before the picture
      await page.waitForURL(/\/results\/meeting_goals/)
      await page.waitForLoadState('networkidle')
    },
    region: CONTENT,
    maxHeight: 600,
  },
  // the focus area and its actions; then the scales to consider, which round 1's results offer for the open place
  { id: 'plan', as: kari, at: DESKTOP, path: `/app/${G}/plan`, region: CONTENT, maxHeight: 640 },
  { id: 'plan-candidates', as: kari, at: DESKTOP, path: `/app/${G}/plan`, region: 'main section:has(> ul[aria-label="Scales to consider"])', maxHeight: 470 },
  {
    // a member adds an action on a phone: what will be done, an owner and a due date
    id: 'plan-add-action',
    as: ola,
    at: PHONE,
    path: `/app/${G}/plan`,
    steps: async (page) => {
      await page.getByRole('button', { name: /^Add an action/ }).first().click()
      await page.getByLabel('What will be done').fill('Agree a template for decision papers')
      await page.getByLabel('Owner').selectOption({ label: 'Ola Hansen (you)' })
      await page.getByLabel('Due date').fill(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      await page.evaluate(() => document.activeElement?.blur?.())
    },
    view: 'main form',
  },
  // the next meeting's agenda: the time check, the task match, items ready or not, and the open actions beside them
  { id: 'meetings-agenda', as: kari, at: DESKTOP, path: `/app/${G}/meetings`, region: CONTENT, maxHeight: 1080 },
  {
    // the sales group's meeting, live, as its leader runs it: the current item, its timer, the decision and the agenda
    id: 'meetings-live',
    as: ingrid,
    at: DESKTOP,
    path: `/app/${SALES}/meetings`,
    steps: async (page) => {
      await page.getByRole('link', { name: 'Join the live meeting' }).click()
      await page.waitForLoadState('networkidle')
      // the room reads the meeting after it renders; measure once the current item and the agenda stand
      await page.getByText(/^Item 1 of/).waitFor()
      await page.getByRole('heading', { name: 'Agenda' }).waitFor()
      await page.waitForTimeout(800)
    },
    // the meeting's grid, below its header: locally there is no Realtime, and the header says the sync is off
    region: 'main > div > div > div:has(> div > section)',
    maxHeight: 600,
  },
  {
    // yesterday's meeting, held: each item as it closed, the decision, the action and the parking lot
    id: 'meetings-summary',
    as: kari,
    at: DESKTOP,
    path: `/app/${G}/meetings`,
    steps: async (page) => {
      await page.getByRole('link', { name: /Leadership meeting$/ }).last().click()
      await page.waitForLoadState('networkidle')
      await page.getByRole('link', { name: 'See the summary' }).click()
      await page.waitForLoadState('networkidle')
    },
    region: CONTENT,
  },
  // the pulses: the rhythm and the next pulse's questions beside the rounds, then pulse 2's result with its change
  { id: 'pulse-rhythm', as: kari, at: DESKTOP, path: `/app/${G}/assess`, region: CONTENT, maxHeight: 760 },
  {
    id: 'pulse-result',
    as: kari,
    at: DESKTOP,
    path: `/app/${G}/assess`,
    steps: async (page) => {
      await page.getByRole('link', { name: 'See the results' }).first().click()
      await page.waitForURL(/results\?round=/)
      await page.waitForLoadState('networkidle')
    },
    region: CONTENT,
    maxHeight: 660,
  },
  { id: 'leader-profile', as: kari, at: DESKTOP, path: '/app/me', region: CONTENT },
  {
    id: 'leader-profile-question',
    at: PHONE,
    path: '/leader-profile/quick',
    steps: async (page) => {
      // the page's own start, not the header's "Start the scan"
      const main = page.getByRole('main')
      const start = main.getByRole('button', { name: /^Start/ }).or(main.getByRole('link', { name: /^Start/ }))
      if (await start.count()) await start.first().click()
      await page.getByRole('radio').nth(3).click()
    },
    clip: 720,
  },
]

/** A session cookie for a fixture person, as @supabase/ssr writes it (tests/e2e/support/session.ts) */
async function signInAs(context, person) {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: person.id, email: person.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}`
  const token = `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`
  const session = {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'local-only',
    user: { id: person.id, aud: 'authenticated', role: 'authenticated', email: person.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() },
  }
  const name = `sb-${new URL(API).hostname.split('.')[0]}-auth-token`
  await context.addCookies([{ name, value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`, url: BASE, sameSite: 'Lax' }])
}

const MANIFEST = 'data/shots.json'
const manifest = (() => {
  try {
    return JSON.parse(readFileSync(MANIFEST, 'utf8'))
  } catch {
    return {}
  }
})()
mkdirSync('public/shots', { recursive: true })

// British English for what the browser draws itself, such as a date field
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--lang=en-GB'], env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB' } })
for (const p of PICTURES.filter((p) => !only.length || only.includes(p.id))) {
  const context = await browser.newContext({
    viewport: { width: p.at.width, height: p.at.height },
    deviceScaleFactor: 2,
    // the production host, so a link the page builds names the site, not this server (lib/auth/origin.ts)
    extraHTTPHeaders: { 'x-forwarded-host': 'www.leaderpact.com', 'x-forwarded-proto': 'https' },
    reducedMotion: 'reduce',
    locale: 'en-GB',
  })
  if (p.as) await signInAs(context, p.as)
  const page = await context.newPage()
  await page.goto(BASE + p.path, { waitUntil: 'networkidle' })
  if (p.steps) await p.steps(page)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  if (p.view) await page.locator(p.view).first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
  // measured from the top of the page: a page reached by a link may open scrolled
  if (p.region) await page.evaluate(() => window.scrollTo(0, 0))
  const box = p.region ? await page.locator(p.region).first().boundingBox() : null
  const pad = 16
  const png = await page.screenshot({
    fullPage: !!p.full || !!box,
    animations: 'disabled',
    ...(p.clip ? { clip: { x: 0, y: 0, width: p.at.width, height: p.clip } } : {}),
    ...(box
      ? {
          clip: {
            x: Math.max(0, box.x - pad),
            y: Math.max(0, box.y - pad),
            width: Math.min(p.at.width, box.width + 2 * pad),
            // a long page keeps its top `maxHeight` CSS pixels
            height: Math.min(box.height + 2 * pad, p.maxHeight ?? Infinity),
          },
        }
      : {}),
  })
  const file = `public/shots/${p.id}.webp`
  // at most 1,600 pixels wide: sharp on a large screen, small enough to load quickly
  const image = sharp(png).resize({ width: Math.min(1600, p.at.width * 2), withoutEnlargement: true }).webp({ quality: 86 })
  const { width, height } = await image.toFile(file)
  manifest[p.id] = { file: `/shots/${p.id}.webp`, width, height, device: p.at.device }
  console.log(`shots: ${p.id} ${width}×${height} (${p.path})`)
  await context.close()
}
await browser.close()
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n')
