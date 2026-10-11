#!/usr/bin/env node
/**
 * Renders the design reference, `design/reference/LeaderPact App - Cream v2.dc.html`, at one prototype
 * state, in headless Chromium, so the visual checks can look at the design beside the app.
 * Written for LeaderPact (handoff section 4, REUSE_EVALUATION section 4.13); the launch and settle rules
 * follow Orgpuls scripts/verify/baseline-v3.mjs @ 6f5d441.
 *
 * The design is untrusted code: support.js compiles and runs the prototype's own scripts. So it only
 * ever runs here, in headless Chromium, and every request is routed:
 *
 *   http://design.invalid/*          the files of design/reference/ (nothing outside that folder)
 *   unpkg.com                        React 18.3.1, ReactDOM 18.3.1 and @babel/standalone 7.29.0 from
 *                                    node_modules/.cache/dc-vendor/, fetched once and checked against
 *                                    the SRI hashes support.js itself declares
 *   fonts.googleapis.com / gstatic   the app's committed fonts (app/fonts.css + public/fonts/), so the
 *                                    design and the app draw with the same files. If the app has no
 *                                    fonts.css yet, Google Fonts is let through and a warning printed
 *   code.iconify.design / api.iconify.design   let through (the icons)
 *   anything else                    aborted, and reported
 *
 * A state is opened by seeding the prototype's store, localStorage['lt-proto-p6'], before the first
 * script runs, in a fresh browser context per state. proto-core-v5.js reads the store in
 * createStore(): a stored object whose `v` is 'v5.0' is kept, and every top-level key it lacks is
 * filled from initial(). So a partial seed works, and any key of initial() can be set.
 *
 * The layout switch. The prototype opens in its SIDEBAR layout: initial() holds
 * `ui: { nav: 'vertical', wide: false }`, and view() derives `ui.horizontal = s.ui.nav !== 'vertical'`
 * (proto-core-v5.js L370 and L929-932). Its own controls flip it through A.setNav('horizontal') /
 * A.toggleNav() (L501-503: the Settings Appearance tab and the floating Prototype panel). We build the
 * top bar only (handoff section 4 Layout, section 11 Whole product), so every state is seeded with
 * `ui: { nav: 'horizontal', wide: false }` unless --layout vertical is asked for.
 *
 * The floating "Prototype" control (fixed, bottom right) is hidden after render by default: handoff
 * section 11 removes it, and it would otherwise sit over the elements being captured.
 *
 *   node scripts/verify/design-render.mjs --route home --plan team
 *   node scripts/verify/design-render.mjs --route results --plan team --role member --full
 *   node scripts/verify/design-render.mjs --all            every route, free and team
 *   node scripts/verify/design-render.mjs --route home --layout vertical   the sidebar, for comparison
 *
 * Options: --route, --plan free|team, --role leader|member, --layout horizontal|vertical,
 * --seed '<json merged into the store>', --out <dir> (default artifacts/design), --full (full page),
 * --keep-proto (leave the Prototype control visible). Exits 1 on a page error, an unresolved
 * binding or a request the routing had to abort.
 *
 * As a module:
 *   import { launchBrowser, openDesign } from './design-render.mjs'
 *   const browser = await launchBrowser()
 *   const d = await openDesign(browser, { route: 'home', plan: 'team' })
 *   await d.page.locator('...').screenshot(...)
 *   await d.close()
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DESIGN_DIR = join(ROOT, 'design', 'reference')
export const DESIGN_FILE = 'LeaderPact App - Cream v2.dc.html'
export const DESIGN_ORIGIN = 'http://design.invalid'
export const DESIGN_URL = `${DESIGN_ORIGIN}/${encodeURIComponent(DESIGN_FILE)}`
export const STORE_KEY = 'lt-proto-p6'
export const STORE_VERSION = 'v5.0'
export const VENDOR_DIR = join(ROOT, 'node_modules', '.cache', 'dc-vendor')
export const VIEWPORT = { width: 1280, height: 900 }
export const LAUNCH_ARGS = ['--font-render-hinting=none']

export const ROUTES = [
  'landing', 'scan', 'personal', 'invite', 'home', 'group', 'people',
  'assess', 'results', 'develop', 'meetings', 'live', 'me', 'settings',
]
export const PLANS = ['free', 'team']
export const ROLES = ['leader', 'member']
export const LAYOUTS = ['horizontal', 'vertical']

const FONT_CSS = join(ROOT, 'app', 'fonts.css')
const FONT_DIR = join(ROOT, 'public', 'fonts')
const FONT_PREFIX = 'https://fonts.gstatic.com/__leaderpact__/'
const PASS_HOSTS = new Set(['code.iconify.design', 'api.iconify.design'])
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}
const CORS = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }

/** The Chromium every visual check uses: the cloud image's when PLAYWRIGHT_CHROMIUM names it. */
export function chromiumExecutable() {
  return process.env.PLAYWRIGHT_CHROMIUM || undefined
}

export async function launchBrowser(extra = {}) {
  const executablePath = chromiumExecutable()
  return chromium.launch({
    headless: true,
    args: LAUNCH_ARGS,
    ...(executablePath ? { executablePath } : {}),
    ...extra,
  })
}

/**
 * The three runtime files support.js loads from unpkg, read from support.js itself (src/cdn.ts:
 * REACT_URL / REACT_SRI and the like), so a newer support.js brings its own pins.
 */
export function vendorPins() {
  const src = readFileSync(join(DESIGN_DIR, 'support.js'), 'utf8')
  const pins = []
  for (const name of ['REACT', 'REACT_DOM', 'BABEL']) {
    const url = src.match(new RegExp(`var ${name}_URL = "([^"]+)"`))?.[1]
    const sri = src.match(new RegExp(`var ${name}_SRI = "([^"]+)"`))?.[1]
    if (!url || !sri) throw new Error(`support.js no longer declares ${name}_URL / ${name}_SRI`)
    if (!url.startsWith('https://unpkg.com/')) throw new Error(`${name}_URL is not on unpkg.com: ${url}`)
    pins.push({ name, url, sri, file: join(VENDOR_DIR, new URL(url).pathname.slice(1)) })
  }
  return pins
}

const sriOf = (buf, algo) => `${algo}-${createHash(algo).update(buf).digest('base64')}`
const matchesSri = (buf, sri) => sriOf(buf, sri.split('-')[0]) === sri

/**
 * Fetches React, ReactDOM and Babel into node_modules/.cache/dc-vendor/ once, and verifies every copy
 * against its SRI hash, on download and on every later read. A file that does not match is refused,
 * never served. Returns a map of unpkg URL to bytes.
 */
export async function ensureVendor({ log = () => {} } = {}) {
  const out = new Map()
  for (const pin of vendorPins()) {
    let buf = existsSync(pin.file) ? readFileSync(pin.file) : null
    if (buf && !matchesSri(buf, pin.sri)) {
      log(`dc-vendor: cached ${pin.url} does not match its SRI hash; fetching it again`)
      buf = null
    }
    if (!buf) {
      let res
      try {
        res = await fetch(pin.url, { redirect: 'follow' })
      } catch (e) {
        throw new Error(
          `could not fetch ${pin.url} (${e.cause?.code || e.message}). Behind a proxy, run with ` +
            'NODE_USE_ENV_PROXY=1, or place the file in node_modules/.cache/dc-vendor/ by hand.',
        )
      }
      if (!res.ok) throw new Error(`${pin.url} answered ${res.status}`)
      buf = Buffer.from(await res.arrayBuffer())
      if (!matchesSri(buf, pin.sri)) {
        throw new Error(`${pin.url} does not match the SRI hash in support.js (${pin.sri}); refusing it`)
      }
      mkdirSync(dirname(pin.file), { recursive: true })
      writeFileSync(pin.file, buf)
      log(`dc-vendor: fetched and verified ${pin.url}`)
    }
    out.set(pin.url, buf)
  }
  return out
}

/**
 * The app's fonts as a Google Fonts stylesheet: app/fonts.css with every url() that names a file in
 * public/fonts/ pointed at a routed gstatic path. Null when the app has no fonts yet.
 */
export function localFontCss() {
  if (!existsSync(FONT_CSS) || !existsSync(FONT_DIR)) return null
  const css = readFileSync(FONT_CSS, 'utf8')
  const files = new Set(listFiles(FONT_DIR).map((f) => relative(FONT_DIR, f).split(sep).join('/')))
  const missing = []
  const rewritten = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, _q, ref) => {
    const clean = ref.split(/[?#]/)[0].replace(/^(\.\.\/)*(public\/)?/, '').replace(/^\/?fonts\//, '').replace(/^\//, '')
    if (files.has(clean)) return `url("${FONT_PREFIX}${clean}")`
    missing.push(ref)
    return whole
  })
  const families = [...css.matchAll(/font-family\s*:\s*(['"]?)([^;'"]+)\1/g)].map((m) => m[2].trim())
  return { css: rewritten, families: [...new Set(families)], missing }
}

function listFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listFiles(p))
    else out.push(p)
  }
  return out
}

/** A file under `root`, or null when the path would leave it. */
function fileUnder(root, rel) {
  const p = resolve(root, rel)
  if (p !== root && !p.startsWith(root + sep)) return null
  return existsSync(p) && statSync(p).isFile() ? p : null
}

/** The object written to localStorage['lt-proto-p6'] for a state. */
export function seedFor(state = {}) {
  const { route = 'home', plan = 'free', role = 'leader', layout = 'horizontal', seed = {} } = state
  if (!ROUTES.includes(route)) throw new Error(`unknown route "${route}" (one of ${ROUTES.join(', ')})`)
  if (!PLANS.includes(plan)) throw new Error(`unknown plan "${plan}"`)
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"`)
  if (!LAYOUTS.includes(layout)) throw new Error(`unknown layout "${layout}"`)
  return { v: STORE_VERSION, route, plan, role, ui: { nav: layout, wide: false }, ...seed }
}

export const stateName = (s = {}) =>
  [s.route ?? 'home', s.plan ?? 'free', s.role ?? 'leader', s.layout ?? 'horizontal'].join('-') +
  (s.seed && Object.keys(s.seed).length ? '-' + createHash('sha1').update(JSON.stringify(s.seed)).digest('hex').slice(0, 6) : '')

let vendorPromise = null
let fontWarned = false

/**
 * Opens one prototype state in a fresh context and waits until it has settled: the runtime has
 * mounted, no binding is unresolved, the fonts are loaded and every visible icon has drawn.
 * Returns { page, context, errors, blocked, warnings, close }.
 *
 * `state.steps` runs after the settle, for states the store cannot seed (a toast is cleared on load):
 * [{ click: '<playwright selector>' }, { wait: <ms> }]. Toasts clear after 3.8 s, so capture promptly.
 */
export async function openDesign(browser, state = {}, opts = {}) {
  const { log = (m) => console.error(m), hideProto = true, timeout = 30_000 } = opts
  vendorPromise ??= ensureVendor({ log })
  const vendor = await vendorPromise
  const fonts = localFontCss()
  const warnings = []
  if (!fonts) {
    const w = 'app/fonts.css or public/fonts/ is missing: Google Fonts is let through, so the design draws with Google\'s font files, not the app\'s'
    warnings.push(w)
    if (!fontWarned) log(`warning: ${w}`)
    fontWarned = true
  } else {
    for (const fam of ['Figtree', 'Poppins']) {
      if (!fonts.families.some((f) => f.replace(/['"]/g, '') === fam)) {
        warnings.push(`app/fonts.css declares no "${fam}" family; the design falls back for it`)
      }
    }
    if (fonts.missing.length) warnings.push(`app/fonts.css names files not in public/fonts: ${fonts.missing.join(', ')}`)
    if (!fontWarned) for (const w of warnings) log(`warning: ${w}`)
    fontWarned = true
  }

  const context = await browser.newContext({
    viewport: opts.viewport ?? VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'en-GB',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const errors = []
  const blocked = []

  await context.route('**/*', async (route) => {
    const req = route.request()
    let url
    try {
      url = new URL(req.url())
    } catch {
      blocked.push(req.url())
      return route.abort('blockedbyclient')
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
    if (url.origin === DESIGN_ORIGIN) {
      const file = fileUnder(DESIGN_DIR, decodeURIComponent(url.pathname).replace(/^\/+/, ''))
      if (!file) {
        blocked.push(req.url())
        return route.fulfill({ status: 404, headers: CORS, body: 'not in design/reference' })
      }
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': MIME[extname(file)] ?? 'application/octet-stream' },
        body: readFileSync(file),
      })
    }
    if (url.hostname === 'unpkg.com') {
      const key = `https://unpkg.com${url.pathname}`
      const body = vendor.get(key)
      if (!body) {
        blocked.push(req.url())
        return route.abort('blockedbyclient')
      }
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': MIME['.js'] }, body })
    }
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      if (!fonts) return route.continue()
      if (url.hostname === 'fonts.googleapis.com') {
        return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': MIME['.css'] }, body: fonts.css })
      }
      const rel = url.href.startsWith(FONT_PREFIX) ? decodeURIComponent(url.href.slice(FONT_PREFIX.length)) : null
      const file = rel && fileUnder(FONT_DIR, rel)
      if (!file) {
        blocked.push(req.url())
        return route.abort('blockedbyclient')
      }
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': MIME[extname(file)] ?? 'font/woff2' },
        body: readFileSync(file),
      })
    }
    if (PASS_HOSTS.has(url.hostname) && url.protocol === 'https:') return route.continue()
    blocked.push(req.url())
    return route.abort('blockedbyclient')
  })

  await context.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {}
    },
    [STORE_KEY, JSON.stringify(seedFor(state))],
  )

  const page = await context.newPage()
  page.setDefaultTimeout(timeout)
  const iconNet = { pending: 0 }
  page.__iconNet = iconNet
  const isIcon = (r) => /^https:\/\/(api|code)\.iconify\.design\//.test(r.url())
  page.on('request', (r) => isIcon(r) && iconNet.pending++)
  page.on('requestfinished', (r) => isIcon(r) && iconNet.pending--)
  page.on('requestfailed', (r) => isIcon(r) && iconNet.pending--)
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })

  const close = () => context.close().catch(() => {})
  try {
    await page.goto(DESIGN_URL, { waitUntil: 'load' })
    await settle(page, { timeout, hideProto })
    for (const step of state.steps ?? []) {
      if (step.click) {
        await page.locator(step.click).first().click()
        await page.waitForTimeout(250)
      }
      if (step.wait) await page.waitForTimeout(step.wait)
    }
    if (state.steps?.length) await settle(page, { timeout, hideProto })
  } catch (e) {
    errors.push(`settle: ${e.message.split('\n')[0]}`)
  }
  return { page, context, errors, blocked, warnings, close, state, seed: seedFor(state) }
}

/** Waits until the prototype has mounted with the store, the fonts are in and the icons are drawn. */
export async function settle(page, { timeout = 30_000, hideProto = true } = {}) {
  await page.waitForFunction(
    () => {
      const root = document.getElementById('dc-root')
      if (!root || !window.LTCore) return false
      if (document.documentElement.classList.contains('sc-dc-streaming')) return false
      if (document.querySelector('.sc-placeholder, .sc-interp.sc-missing, .sc-logic-error')) return false
      return root.innerText.trim().length > 0
    },
    null,
    { timeout },
  )
  if (hideProto) {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('#dc-root div')) {
        const s = el.style
        if (s.position === 'fixed' && s.right === '20px' && s.bottom === '20px' && s.zIndex === '55') {
          el.style.display = 'none'
          el.setAttribute('data-verify-hidden', 'prototype-control (handoff section 11)')
        }
      }
    })
  }
  // the stylesheet is display=swap and a face loads only when text uses it: load every weight the
  // design names up front, so no text is captured in a fallback face mid-swap
  await page
    .evaluate(() =>
      Promise.race([
        Promise.all([
          ...['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 16px "Figtree"`)),
          ...['400', '500', '600'].map((w) => document.fonts.load(`${w} 16px "Poppins"`)),
        ]),
        new Promise((r) => setTimeout(r, 10_000)),
      ]),
    )
    .catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  // icons come from api.iconify.design: wait for those requests to go quiet, then for the svgs
  const net = page.__iconNet
  if (net) {
    const until = Date.now() + 10_000
    let quietSince = Date.now()
    while (Date.now() < until) {
      if (net.pending > 0) quietSince = Date.now()
      else if (Date.now() - quietSince >= 300) break
      await page.waitForTimeout(50)
    }
  }
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('iconify-icon')].every((el) => {
          const r = el.getBoundingClientRect()
          if (!r.width && !r.height) return true
          return !!el.shadowRoot?.querySelector('svg')
        }),
      null,
      { timeout: 2_000 },
    )
    .catch(() => {})
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.mouse.move(0, 0)
  await page.waitForTimeout(250)
}

/** Visible icons that drew no svg (an icon name the iconify set no longer has, or a blocked fetch). */
export async function missingIcons(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('iconify-icon')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return (r.width || r.height) && !el.shadowRoot?.querySelector('svg')
      })
      .map((el) => el.getAttribute('icon')),
  )
}

/** Counts what a render must not contain: literal {{ bindings left in the text. */
export async function unresolvedBindings(page) {
  return page.evaluate(() => (document.body.innerText.match(/\{\{/g) || []).length)
}

/** Opens a state, screenshots it, closes it. Returns { file, errors, blocked, warnings, unresolved }. */
export async function renderDesign(browser, state, { out = join(ROOT, 'artifacts', 'design'), fullPage = false, hideProto = true, log } = {}) {
  mkdirSync(out, { recursive: true })
  const d = await openDesign(browser, state, { hideProto, log })
  try {
    const file = join(out, `${stateName(state)}.png`)
    const unresolved = await unresolvedBindings(d.page).catch(() => -1)
    await d.page.screenshot({ path: file, fullPage, animations: 'disabled', caret: 'hide' })
    return { file, errors: d.errors, blocked: d.blocked, warnings: d.warnings, unresolved }
  } finally {
    await d.close()
  }
}

// ---------------------------------------------------------------------------------------------- CLI

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const argv = process.argv.slice(2)
  const flag = (n) => argv.includes(`--${n}`)
  const arg = (n, d) => {
    const i = argv.indexOf(`--${n}`)
    return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
  }
  const layout = arg('layout', 'horizontal')
  const role = arg('role', 'leader')
  const seed = arg('seed') ? JSON.parse(arg('seed')) : {}
  const states = flag('all')
    ? ROUTES.flatMap((route) => PLANS.map((plan) => ({ route, plan, role, layout, seed })))
    : [{ route: arg('route', 'home'), plan: arg('plan', 'free'), role, layout, seed }]
  const out = resolve(arg('out', join(ROOT, 'artifacts', 'design')))

  const browser = await launchBrowser()
  let failed = 0
  try {
    for (const state of states) {
      const r = await renderDesign(browser, state, { out, fullPage: flag('full'), hideProto: !flag('keep-proto') })
      const bad = r.errors.length || r.blocked.length || r.unresolved !== 0
      if (bad) failed++
      console.log(
        `${bad ? 'FAIL' : 'ok  '}  ${stateName(state).padEnd(34)} ${relative(ROOT, r.file)}` +
          (r.unresolved ? `  unresolved {{: ${r.unresolved}` : '') +
          (r.errors.length ? `  errors: ${r.errors.slice(0, 3).join(' | ')}` : '') +
          (r.blocked.length ? `  blocked: ${[...new Set(r.blocked)].slice(0, 5).join(' ')}` : ''),
      )
    }
  } finally {
    await browser.close()
  }
  process.exit(failed ? 1 : 0)
}
