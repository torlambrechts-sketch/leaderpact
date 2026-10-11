#!/usr/bin/env node
/**
 * The side-by-side check: each component of handoff section 4 in the design and in the app, at 1280 px,
 * compared by computed style (the gate) and by pixels (information for a person).
 * Written for LeaderPact (REUSE_EVALUATION section 4.13: "region-diff.mjs becomes the side-by-side
 * tool" and "a new computed-style probe"); the sheet is Orgpuls scripts/verify/region-diff.mjs @ 6f5d441
 * (baseline | shot | diff, pixelmatch threshold 0.1), padded to the larger size instead of cropped.
 *
 * For every claim in scripts/verify/claims.json:
 *   - the design element is found in the prototype state the claim names (design-render.mjs), and must
 *     resolve to exactly one visible element; so must each of its parts;
 *   - the app element is found on the app's /specimens page by its locator ([data-specimen="<id>"]);
 *   - the listed computed-style properties are compared, the design's value or the claim's `expect`
 *     against the app's, and every difference is reported by name;
 *   - design | app | diff is written to artifacts/side-by-side/<id>.png, with the share of differing
 *     pixels against the claim's tolerance. The pixel figure never fails the run: copy, data and icon
 *     glyphs differ on purpose (handoff section 0: not a pixel-perfect reference).
 *
 * Status per claim: match, differs (with the properties), design-not-found or app-not-found. Exit 1 when
 * any claimed property differs or any locator is missing (the app not being served counts as missing).
 *
 *   node scripts/verify/side-by-side.mjs                       app at http://127.0.0.1:3100/specimens
 *   node scripts/verify/side-by-side.mjs --app http://127.0.0.1:3000 --only button-primary,pill
 *   node scripts/verify/side-by-side.mjs --design-only         check the design locators alone
 *
 * Options: --app <base url>, --path <page> (default /specimens), --only <id,id>, --claims <file>,
 * --out <dir> (default artifacts/side-by-side), --design-only.
 * Writes <out>/<id>.png, <out>/report.md and <out>/report.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { ROOT, launchBrowser, openDesign } from './design-render.mjs'

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const APP = arg('app', 'http://127.0.0.1:3100').replace(/\/$/, '')
const APP_PATH = arg('path', '/specimens')
const OUT = resolve(arg('out', join(ROOT, 'artifacts', 'side-by-side')))
const CLAIMS_FILE = resolve(arg('claims', join(ROOT, 'scripts', 'verify', 'claims.json')))
const ONLY = arg('only') ? new Set(arg('only').split(',').map((s) => s.trim()).filter(Boolean)) : null
const DESIGN_ONLY = flag('design-only')

const { claims: allClaims, viewport = { width: 1280, height: 900 } } = JSON.parse(readFileSync(CLAIMS_FILE, 'utf8'))
const claims = allClaims.filter((c) => !ONLY || ONLY.has(c.id))
if (ONLY) for (const id of ONLY) if (!allClaims.some((c) => c.id === id)) console.error(`warning: no claim "${id}"`)
mkdirSync(OUT, { recursive: true })

// ------------------------------------------------------------------------------------------ properties

const SIDES = ['top', 'right', 'bottom', 'left']
const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
const GROUPS = {
  padding: SIDES.map((s) => `padding-${s}`),
  margin: SIDES.map((s) => `margin-${s}`),
  'border-width': SIDES.map((s) => `border-${s}-width`),
  'border-style': SIDES.map((s) => `border-${s}-style`),
  'border-color': SIDES.map((s) => `border-${s}-color`),
  border: SIDES.flatMap((s) => [`border-${s}-width`, `border-${s}-style`, `border-${s}-color`]),
  ...Object.fromEntries(SIDES.map((s) => [`border-${s}`, [`border-${s}-width`, `border-${s}-style`, `border-${s}-color`]])),
  'border-radius': CORNERS.map((c) => `border-${c}-radius`),
  gap: ['row-gap', 'column-gap'],
}
const expand = (props) => [...new Set(props.flatMap((p) => GROUPS[p] ?? [p]))]

/**
 * Reads computed styles in the page. font-family is reduced to its first family; a corner radius is
 * resolved to the radius actually drawn (a percentage against the box, clamped to half its shorter
 * side), so 50 %, 9999px and 17px on a 34 px circle all read 17px; box-width/box-height are the
 * rendered box. Border widths are always read, so a colour on a side with no border can be ignored.
 */
function measureInPage(el, props) {
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const out = {}
  const half = Math.min(r.width, r.height) / 2
  for (const p of props) {
    if (p === 'box-width') out[p] = `${Math.round(r.width * 4) / 4}px`
    else if (p === 'box-height') out[p] = `${Math.round(r.height * 4) / 4}px`
    else if (p === 'font-family') out[p] = (cs.fontFamily.split(',')[0] || '').trim().replace(/^["']|["']$/g, '')
    else if (/^border-.*-radius$/.test(p)) {
      const raw = cs.getPropertyValue(p).split(' ')[0]
      const px = raw.endsWith('%') ? (parseFloat(raw) / 100) * Math.min(r.width, r.height) : parseFloat(raw) || 0
      out[p] = `${Math.round(Math.min(px, half) * 100) / 100}px`
    } else out[p] = cs.getPropertyValue(p)
  }
  for (const s of ['top', 'right', 'bottom', 'left']) out[`__border-${s}-width`] = cs.getPropertyValue(`border-${s}-width`)
  return out
}

function parseColor(v) {
  if (!v) return null
  v = v.trim().toLowerCase()
  if (v === 'transparent') return [0, 0, 0, 0]
  let m = v.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    let h = m[1]
    if (h.length <= 4) h = [...h].map((c) => c + c).join('')
    const n = [0, 2, 4, 6].map((i) => (h.length > i ? parseInt(h.slice(i, i + 2), 16) : 255))
    return [n[0], n[1], n[2], n[3] / 255]
  }
  m = v.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
  }
  return null
}
const isColorProp = (p) => /color$/.test(p) || p === 'background-color'
const px = (v) => (typeof v === 'string' && /^-?[\d.]+px$/.test(v.trim()) ? parseFloat(v) : null)

/** True when two computed values are the same for the eye: colours to a channel, lengths to 0.05 px. */
function same(prop, a, b) {
  if (a === b) return true
  if (isColorProp(prop)) {
    const x = parseColor(a)
    const y = parseColor(b)
    if (!x || !y) return false
    if (x[3] === 0 && y[3] === 0) return true
    return x.slice(0, 3).every((c, i) => Math.abs(c - y[i]) <= 1) && Math.abs(x[3] - y[3]) <= 0.01
  }
  if (prop === 'letter-spacing') {
    const n = (v) => (v === 'normal' ? 0 : px(v))
    return n(a) !== null && n(b) !== null && Math.abs(n(a) - n(b)) <= 0.05
  }
  if (prop === 'font-family') return a.toLowerCase() === b.toLowerCase()
  if (prop === 'font-weight') return Number(a) === Number(b)
  if (prop === 'box-shadow' || prop === 'backdrop-filter') return a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ')
  const tol = prop.startsWith('box-') ? 0.5 : 0.05
  if (px(a) !== null && px(b) !== null) return Math.abs(px(a) - px(b)) <= tol
  return false
}

/** A border colour on a side that has no border in either render is not a difference. */
function irrelevant(prop, d, a) {
  const m = prop.match(/^border-(top|right|bottom|left)-color$/)
  if (!m) return false
  const w = `__border-${m[1]}-width`
  return px(d?.[w]) === 0 && px(a?.[w]) === 0
}

function compare(props, expect = {}, design, app) {
  const diffs = []
  for (const p of props) {
    const want = expect[p]?.value ?? design[p]
    if (!expect[p] && irrelevant(p, design, app)) continue
    if (!same(p, want, app[p])) {
      diffs.push({ property: p, design: design[p], app: app[p], ...(expect[p] ? { expected: expect[p].value, reason: expect[p].reason } : {}) })
    }
  }
  return diffs
}

// --------------------------------------------------------------------------------------------- capture

/** Exactly-one-visible resolution: { el } or { error }. */
async function resolveOne(scope, selector, label) {
  const loc = scope.locator(selector)
  const n = await loc.count()
  const visible = []
  for (let i = 0; i < n; i++) if (await loc.nth(i).isVisible()) visible.push(loc.nth(i))
  if (visible.length === 1) return { el: visible[0] }
  return { error: `${label} "${selector}" resolves to ${visible.length} visible element(s) (${n} in the DOM)`, count: visible.length, first: visible[0] }
}

const alternatives = (v, fallback) => (Array.isArray(v) ? v : v ? [v] : [fallback])

/**
 * The first alternative with at least one visible match wins; with several matches the first is used
 * (and said). For the app side, whose markup is the build's own: a claim may name a data-part or
 * data-specimen first and a semantic fallback after it (a role, a heading, the first child).
 */
async function resolveFirst(scope, selectors, label) {
  const tried = []
  for (const selector of selectors) {
    const r = await resolveOne(scope, selector, label)
    if (r.el) return { el: r.el }
    if (r.first) return { el: r.first, note: `${r.error}; the first is compared` }
    tried.push(selector)
  }
  return { error: `${label}: none of ${tried.map((t) => `"${t}"`).join(', ')} resolves to a visible element` }
}

/**
 * A specimen may be marked on a wrapper (<span data-specimen="pill"><Pill/></span>). The element
 * compared is the first one down that draws something: descend while the element has exactly one
 * rendered child, no text of its own and no fill, border, padding, radius, shadow or blur.
 */
async function unwrap(page, el, id) {
  await el.evaluate((node, id) => {
    const drawn = (x) => {
      const cs = getComputedStyle(x)
      return (
        cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        ['top', 'right', 'bottom', 'left'].some((s) => parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 || parseFloat(cs.getPropertyValue(`padding-${s}`)) > 0) ||
        parseFloat(cs.borderTopLeftRadius) > 0 ||
        cs.boxShadow !== 'none' ||
        cs.backdropFilter !== 'none'
      )
    }
    let x = node
    for (;;) {
      const kids = [...x.children].filter((c) => getComputedStyle(c).display !== 'none' && !['SCRIPT', 'STYLE', 'TEMPLATE'].includes(c.tagName))
      const ownText = [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (kids.length !== 1 || ownText || drawn(x)) break
      x = kids[0]
    }
    x.setAttribute('data-verify-target', id)
  }, id)
  return page.locator(`[data-verify-target="${id}"]`).first()
}

/**
 * Pins nothing while capturing: a sticky or fixed element that is not the target (nor its ancestor or
 * descendant) is made static or hidden, so it cannot sit over the element being photographed. Sticky
 * to static keeps the layout; the change is undone after the shot.
 */
async function unpin(target) {
  return target.evaluate((el) => {
    const changed = []
    for (const x of document.querySelectorAll('body *')) {
      if (x === el || x.contains(el) || el.contains(x)) continue
      const pos = getComputedStyle(x).position
      if (pos === 'sticky') {
        changed.push([x, 'position', x.style.position])
        x.style.position = 'static'
      } else if (pos === 'fixed') {
        changed.push([x, 'visibility', x.style.visibility])
        x.style.visibility = 'hidden'
      }
    }
    window.__verifyUnpinned = changed
  })
}
async function repin(page) {
  await page.evaluate(() => {
    for (const [x, prop, v] of window.__verifyUnpinned || []) x.style[prop] = v
    window.__verifyUnpinned = []
  })
}

/** Measures the element and its parts; screenshots it. Returns { styles, parts, png, partErrors }. */
async function capture(page, el, claim, side) {
  // measured in view: the design's <iconify-icon> drops its svg while scrolled out of view after an
  // element shot (and draws it again in view), which would collapse an icon to 0 x 0 mid-measure
  await el.scrollIntoViewIfNeeded().catch(() => {})
  await el
    .evaluate(async (node) => {
      const until = Date.now() + 3000
      const drawn = () => [...node.querySelectorAll('iconify-icon')].every((i) => i.shadowRoot?.querySelector('svg'))
      while (!drawn() && Date.now() < until) await new Promise((r) => setTimeout(r, 50))
    })
    .catch(() => {})
  const props = expand(claim.properties ?? [])
  const styles = await el.evaluate(measureInPage, props)
  const parts = {}
  const partErrors = []
  for (const part of claim.parts ?? []) {
    let target = null
    if (side === 'design') {
      const r = await resolveOne(el, part.design, `part ${part.name}`)
      if (r.error) partErrors.push(r.error)
      target = r.el ?? null
    } else {
      const r = await resolveFirst(el, alternatives(part.app, `[data-part="${part.name}"]`), `part ${part.name}`)
      if (r.error) partErrors.push(r.error)
      target = r.el ?? null
    }
    if (target) parts[part.name] = await target.evaluate(measureInPage, expand(part.properties ?? []))
  }
  await el.scrollIntoViewIfNeeded().catch(() => {})
  await unpin(el)
  let png = null
  try {
    const mask = side === 'design' ? (claim.mask ?? []).map((m) => page.locator(m)) : []
    png = await el.screenshot({ animations: 'disabled', caret: 'hide', mask, maskColor: '#ff00ff', timeout: 10_000 })
  } catch {
    png = null
  } finally {
    await repin(page)
  }
  return { styles, parts, partErrors, png }
}

// ------------------------------------------------------------------------------------------ the sheet

const GUTTER = 12
const BG = [241, 237, 230, 255] // --bg, so a padded edge reads as page, not as content

function pad(img, w, h) {
  const out = new PNG({ width: w, height: h })
  for (let i = 0; i < w * h; i++) out.data.set(BG, i * 4)
  if (img) PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0)
  return out
}

/** design | app | diff, each padded to the larger size. Returns { file, diffPx, share }. */
function sheet(id, designPng, appPng) {
  const a = designPng ? PNG.sync.read(designPng) : null
  const b = appPng ? PNG.sync.read(appPng) : null
  const w = Math.max(a?.width ?? 1, b?.width ?? 1)
  const h = Math.max(a?.height ?? 1, b?.height ?? 1)
  const pa = pad(a, w, h)
  const pb = pad(b, w, h)
  const diff = new PNG({ width: w, height: h })
  let diffPx = null
  if (a && b) diffPx = pixelmatch(pa.data, pb.data, diff.data, w, h, { threshold: 0.1 })
  else for (let i = 0; i < w * h; i++) diff.data.set([255, 255, 255, 255], i * 4)
  const out = new PNG({ width: w * 3 + GUTTER * 4, height: h + GUTTER * 2 })
  for (let i = 0; i < out.width * out.height; i++) out.data.set([255, 255, 255, 255], i * 4)
  PNG.bitblt(pa, out, 0, 0, w, h, GUTTER, GUTTER)
  PNG.bitblt(pb, out, 0, 0, w, h, GUTTER * 2 + w, GUTTER)
  PNG.bitblt(diff, out, 0, 0, w, h, GUTTER * 3 + w * 2, GUTTER)
  const file = join(OUT, `${id}.png`)
  writeFileSync(file, PNG.sync.write(out))
  return { file, diffPx, share: diffPx === null ? null : diffPx / (w * h), size: { design: a && [a.width, a.height], app: b && [b.width, b.height] } }
}

// ------------------------------------------------------------------------------------------------ run

const browser = await launchBrowser()
const results = []
let appPage = null
let appProblem = null
const appConsole = []

if (!DESIGN_ONLY) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'UTC', reducedMotion: 'reduce' })
  appPage = await ctx.newPage()
  appPage.on('console', (m) => m.type() === 'error' && appConsole.push(m.text()))
  appPage.on('pageerror', (e) => appConsole.push(e.message))
  try {
    const res = await appPage.goto(APP + APP_PATH, { waitUntil: 'networkidle', timeout: 30_000 })
    if (!res || !res.ok()) appProblem = `${APP + APP_PATH} answered ${res ? res.status() : 'nothing'}`
    else {
      await appPage.evaluate(() => document.fonts.ready)
      await appPage.mouse.move(0, 0)
      await appPage.waitForTimeout(300)
    }
  } catch (e) {
    appProblem = `${APP + APP_PATH} is not served (${e.message.split('\n')[0]})`
  }
  if (appProblem) console.error(`app: ${appProblem}`)
}

// claims that share a state without steps share one fresh context; a state with steps gets its own
const stateKey = (s) => (s.steps?.length ? null : JSON.stringify({ ...s, layout: s.layout ?? 'horizontal' }))
const openStates = new Map()
async function designFor(claim) {
  const key = stateKey(claim.design.state)
  if (key && openStates.has(key)) return openStates.get(key)
  const d = await openDesign(browser, claim.design.state, { log: (m) => console.error(m) })
  if (key) openStates.set(key, d)
  return d
}

for (const claim of claims) {
  const r = { id: claim.id, what: claim.what, status: 'match', diffs: [], problems: [], excluded: { ...(claim.excluded ?? {}) } }
  for (const part of claim.parts ?? []) for (const [k, v] of Object.entries(part.excluded ?? {})) r.excluded[`${part.name}: ${k}`] = v
  const d = await designFor(claim)
  if (d.errors.length) r.problems.push(...d.errors.map((e) => `design: ${e}`))

  const dr = await resolveOne(d.page, claim.design.locator, 'design locator')
  let design = null
  if (dr.el) {
    design = await capture(d.page, dr.el, claim, 'design')
    if (design.partErrors.length) {
      r.status = 'design-not-found'
      r.problems.push(...design.partErrors.map((e) => `design ${e}`))
    }
  } else {
    r.status = 'design-not-found'
    r.problems.push(dr.error)
  }
  if (!stateKey(claim.design.state)) await d.close()
  if (DESIGN_ONLY && r.status === 'match') r.status = 'design-found'

  let app = null
  if (!DESIGN_ONLY && r.status === 'match') {
    if (appProblem) {
      r.status = 'app-not-found'
      r.problems.push(appProblem)
    } else {
      const ar = await resolveFirst(appPage, alternatives(claim.app?.locator, `[data-specimen="${claim.id}"]`), 'app locator')
      if (!ar.el) {
        r.status = 'app-not-found'
        r.problems.push(ar.error)
      } else {
        if (ar.note) r.problems.push(ar.note)
        const el = await unwrap(appPage, ar.el, claim.id)
        app = await capture(appPage, el, claim, 'app')
        if (app.partErrors.length) {
          r.status = 'app-not-found'
          r.problems.push(...app.partErrors.map((e) => `app ${e}`))
        }
      }
    }
  }

  if (design && app && r.status === 'match') {
    const props = expand(claim.properties ?? [])
    r.diffs.push(...compare(props, claim.expect, design.styles, app.styles))
    for (const part of claim.parts ?? []) {
      if (!design.parts[part.name] || !app.parts[part.name]) continue
      const pd = compare(expand(part.properties ?? []), part.expect, design.parts[part.name], app.parts[part.name])
      r.diffs.push(...pd.map((x) => ({ ...x, property: `${part.name}: ${x.property}` })))
    }
    if (r.diffs.length) r.status = 'differs'
  }
  if (design) {
    r.design = clean(design.styles)
    r.designParts = Object.fromEntries(Object.entries(design.parts).map(([k, v]) => [k, clean(v)]))
  }
  if (app) {
    r.app = clean(app.styles)
    r.appParts = Object.fromEntries(Object.entries(app.parts).map(([k, v]) => [k, clean(v)]))
  }
  const s = sheet(claim.id, design?.png, app?.png)
  r.sheet = relative(ROOT, s.file)
  r.pixels = { share: s.share, tolerance: claim.tolerance ?? null, within: s.share === null || claim.tolerance == null ? null : s.share <= claim.tolerance, size: s.size }
  results.push(r)
  const pix = s.share === null ? '' : `  pixels ${(s.share * 100).toFixed(1)}% (tolerance ${((claim.tolerance ?? 0) * 100).toFixed(0)}%)`
  console.log(
    `${r.status.padEnd(16)} ${claim.id.padEnd(24)}` +
      (r.diffs.length ? ` ${r.diffs.map((x) => x.property).join(', ')}` : '') +
      (r.status.endsWith('not-found') ? ` ${r.problems.join(' | ')}` : '') +
      pix,
  )
}

for (const d of openStates.values()) await d.close()
await browser.close()

function clean(o) {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('__')))
}

// ---------------------------------------------------------------------------------------------- report

const counts = results.reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {})
const failed = results.filter((r) => !['match', 'design-found'].includes(r.status)).length
const summary = {
  when: new Date().toISOString(),
  app: DESIGN_ONLY ? null : APP + APP_PATH,
  appProblem,
  designOnly: DESIGN_ONLY,
  viewport,
  counts,
  appConsoleErrors: appConsole.slice(0, 20),
  results,
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(summary, null, 2) + '\n')

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = []
md.push('# Side-by-side: design and app', '')
md.push(`Run ${summary.when} at ${viewport.width} x ${viewport.height}. Design: \`design/reference/LeaderPact App - Cream v2.dc.html\`, top-bar layout. App: ${DESIGN_ONLY ? 'not checked (--design-only)' : `\`${APP + APP_PATH}\``}.`, '')
md.push('Computed styles gate the run; the pixel share is for a person to read, never a gate (handoff section 0: not a pixel-perfect reference). Each sheet is design | app | diff, padded to the larger size; magenta boxes in the design are regions handoff section 11 removes.', '')
if (appProblem) md.push(`**The app was not reached:** ${esc(appProblem)}. Every claim reports app-not-found.`, '')
md.push(`**${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}** of ${results.length} claims.`, '')
md.push('| Component | Status | Differences | Pixels (tolerance) | Sheet |', '|---|---|---|---|---|')
for (const r of results) {
  const diffs = r.diffs.length ? r.diffs.map((x) => x.property).join(', ') : r.status.endsWith('not-found') ? esc(r.problems[0]) : ''
  const pix = r.pixels.share === null ? '' : `${(r.pixels.share * 100).toFixed(1)}% (${((r.pixels.tolerance ?? 0) * 100).toFixed(0)}%)${r.pixels.within === false ? ' over' : ''}`
  md.push(`| ${r.id} | ${r.status} | ${esc(diffs)} | ${pix} | [${r.id}.png](${r.id}.png) |`)
}
md.push('')
for (const r of results) {
  md.push(`## ${r.id}: ${r.status}`, '', esc(r.what), '')
  if (r.diffs.length) {
    md.push('| Property | Design | App | Expected | Why expected differs from the design |', '|---|---|---|---|---|')
    for (const x of r.diffs) md.push(`| ${x.property} | ${esc(x.design)} | ${esc(x.app)} | ${esc(x.expected ?? '')} | ${esc(x.reason ?? '')} |`)
    md.push('')
  }
  if (r.problems.length) md.push(...r.problems.map((p) => `- ${esc(p)}`), '')
  const ex = Object.entries(r.excluded)
  if (ex.length) md.push('Not compared, on purpose:', '', ...ex.map(([k, v]) => `- ${esc(k)}: ${esc(v)}`), '')
}
if (appConsole.length) md.push('## App console errors', '', ...appConsole.slice(0, 20).map((e) => `- ${esc(e)}`), '')
writeFileSync(join(OUT, 'report.md'), md.join('\n') + '\n')

console.log(`\n${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}. Report: ${relative(ROOT, join(OUT, 'report.md'))}`)
process.exit(failed ? 1 : 0)
