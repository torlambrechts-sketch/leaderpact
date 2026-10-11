#!/usr/bin/env node
/**
 * The phone check, at 390 x 844 and 360 x 780, where the design has no layout at all (it is
 * min-width:1280px). The owner's answer B3 (REUSE_EVALUATION section 2.0): rules, axe and a person
 * reviewing the screenshots. Adapted from Orgpuls scripts/verify/mobile.mjs @ 6f5d441: the sideways
 * overflow measure and its culprit search carry over; the squeezed-text heuristic is replaced by the
 * minimum sizes of CLAUDE.md (Design) and handoff section 4 Type, and axe and console errors are added.
 *
 * Per path and width, in a fresh mobile context (isMobile, hasTouch):
 *   overflow   the page scrolls sideways (wide tables may scroll inside their own scroller,
 *              handoff section 4 Layout, so those are not culprits)
 *   text       body text under 15 px. Handoff section 4 Type: "The design sets most text at 12 to
 *              13.5 px. Keep that on desktop. On phones, body text is at least 15 px." Body is a role
 *              in its type scale, told apart from the others by size and weight: text at 400 or 500
 *              between the meta sizes (12 to 12.5 px) and 15 px, outside a control. Meta, micro labels,
 *              chips and control labels (600 and up, or inside a button, link, tab, radio or label) keep
 *              their sizes. data-allow-small exempts anything else on purpose
 *   input      an input, select or textarea whose font-size is under 16 px (iOS zooms on focus)
 *   target     an interactive element (a link, a button, a form control or an interactive ARIA role)
 *              whose box is under 44 x 44 px. A checkbox or radio inside a label is measured by its
 *              label; visually hidden inputs and a skip link parked off the page are not targets; a
 *              focusable region (a tab panel, a scroll box) is not a target either
 *   axe        any serious or critical violation
 *   console    any console error or page error
 * Full-page screenshots go to artifacts/mobile/<width>/ for a person to review: the rules cannot see
 * an ugly wrap, a cramped card or a bottom bar over content.
 *
 *   node scripts/verify/mobile.mjs                         /specimens and / on http://127.0.0.1:3100
 *   node scripts/verify/mobile.mjs --app http://127.0.0.1:3000 /specimens /scan
 *   node scripts/verify/mobile.mjs --widths 360 /specimens
 *
 * Writes artifacts/mobile/report.md and report.json. Exits 1 on any rule failure, or when a path is
 * not served.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { ROOT, launchBrowser } from './design-render.mjs'

const argv = process.argv.slice(2)
const VALUE_FLAGS = ['--app', '--out', '--widths']
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const paths = argv.filter((a, i) => a.startsWith('/') && !VALUE_FLAGS.includes(argv[i - 1]))
if (!paths.length) paths.push('/specimens', '/')
const APP = arg('app', 'http://127.0.0.1:3100').replace(/\/$/, '')
const OUT = resolve(arg('out', join(ROOT, 'artifacts', 'mobile')))
const PHONES = { 390: { width: 390, height: 844 }, 360: { width: 360, height: 780 } }
const widths = arg('widths', '390,360').split(',').map((w) => Number(w.trim()))
for (const w of widths) if (!PHONES[w]) PHONES[w] = { width: w, height: 800 }

const MIN_TEXT = 15
const MIN_INPUT = 16
const MIN_TARGET = 44

/** Runs in the page: every rule but axe. */
function inspect({ vw, MIN_TEXT, MIN_INPUT, MIN_TARGET }) {
  const sel = (el) => {
    const parts = []
    let x = el
    for (let depth = 0; x && x !== document.body && depth < 4; depth++) {
      if (x.id) {
        parts.unshift(`#${CSS.escape(x.id)}`)
        break
      }
      const spec = x.getAttribute('data-specimen')
      const part = x.getAttribute('data-part')
      let s = x.tagName.toLowerCase()
      if (spec) {
        parts.unshift(`[data-specimen="${spec}"]`)
        break
      }
      if (part) s += `[data-part="${part}"]`
      else {
        const cls = [...x.classList].slice(0, 2).map((c) => `.${CSS.escape(c)}`).join('')
        s += cls
        const sib = x.parentElement ? [...x.parentElement.children].filter((c) => c.tagName === x.tagName) : []
        if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(x) + 1})`
      }
      parts.unshift(s)
      x = x.parentElement
    }
    return parts.join(' > ')
  }
  // drawn for a sighted person: not display:none, not visibility:hidden, not transparent, not clipped
  // away to a pixel the way a visually hidden (sr-only) element is
  const rendered = (el) => {
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
    // parked off the page until focused, as a skip link is: not something a finger can reach
    const box = el.getBoundingClientRect()
    if (box.right + window.scrollX <= 0 || box.bottom + window.scrollY <= 0) return false
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a)
      const r = a.getBoundingClientRect()
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') return false
      if (r.width <= 1 && r.height <= 1 && cs.overflow !== 'visible') return false
    }
    return true
  }
  const scrollerOf = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX
      if (o === 'auto' || o === 'scroll') return a
    }
    return null
  }

  // overflow, measured against the device width (Orgpuls: with mobile emulation innerWidth widens
  // to fit content that will not shrink, which hides exactly this)
  const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw
  const wide = []
  if (overflow > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (!(r.right > vw + 1 && r.width > 0) || scrollerOf(el)) continue
      const p = el.parentElement?.getBoundingClientRect()
      if (!p || p.right <= vw + 1 || p.width < r.width) wide.push(`${sel(el)} (right edge at ${Math.round(r.right)} px)`)
    }
  }

  // body text under the minimum: the body role of the handoff's type scale, not every small word
  const META_MAX = 12.5
  const CONTROL = 'button, a, label, summary, [role="tab"], [role="radio"], [role="menuitem"], [role="option"]'
  const small = new Map()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.replace(/\s+/g, ' ').trim()
    const el = n.parentElement
    if (!text || !el || el.closest('script, style, noscript, template, [data-allow-small]')) continue
    const style = getComputedStyle(el)
    const size = parseFloat(style.fontSize)
    if (size >= MIN_TEXT - 0.01 || size <= META_MAX + 0.01 || parseInt(style.fontWeight, 10) >= 600) continue
    if (el.closest(CONTROL) || !rendered(el)) continue
    const range = document.createRange()
    range.selectNodeContents(n)
    if (![...range.getClientRects()].some((r) => r.width > 0 && r.height > 0)) continue
    const key = `${sel(el)} @ ${size}px`
    const entry = small.get(key) ?? { selector: sel(el), fontSize: `${size}px`, count: 0, sample: text.slice(0, 32) }
    entry.count++
    small.set(key, entry)
  }

  // inputs under 16 px
  const NOT_TYPED = ['hidden', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'button', 'reset', 'image']
  const inputs = []
  for (const el of document.querySelectorAll('input, select, textarea, [contenteditable=""], [contenteditable="true"]')) {
    if (el.tagName === 'INPUT' && NOT_TYPED.includes((el.getAttribute('type') || 'text').toLowerCase())) continue
    if (!rendered(el)) continue
    const size = parseFloat(getComputedStyle(el).fontSize)
    if (size < MIN_INPUT - 0.01) inputs.push({ selector: sel(el), fontSize: `${size}px` })
  }

  // targets under 44 x 44
  const INTERACTIVE = [
    'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'summary',
    '[role="button"]', '[role="link"]', '[role="tab"]', '[role="checkbox"]', '[role="radio"]', '[role="switch"]',
    '[role="menuitem"]', '[role="option"]', '[role="slider"]', '[role="combobox"]', '[role="spinbutton"]',
  ].join(', ')
  const targets = []
  const seen = new Set()
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (el.getAttribute('aria-hidden') === 'true' || getComputedStyle(el).pointerEvents === 'none') continue
    let box = el
    // a checkbox or radio is pressed through its label
    if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) box = el.closest('label') ?? (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ?? el
    if (!rendered(box) || seen.has(box)) continue
    seen.add(box)
    const r = box.getBoundingClientRect()
    if (r.width < MIN_TARGET - 0.5 || r.height < MIN_TARGET - 0.5) {
      targets.push({ selector: sel(box), size: `${Math.round(r.width * 10) / 10} x ${Math.round(r.height * 10) / 10}`, name: (box.getAttribute('aria-label') || box.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32) })
    }
  }

  return { overflow: Math.max(0, overflow), wide: wide.slice(0, 8), text: [...small.values()], inputs, targets }
}

const fileFor = (path) => `${path.replace(/^\//, '').replace(/[/?&=#]/g, '-') || 'root'}.png`

const browser = await launchBrowser()
const results = []
try {
  for (const w of widths) {
    mkdirSync(join(OUT, String(w)), { recursive: true })
    for (const path of paths) {
      const context = await browser.newContext({
        viewport: PHONES[w],
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        locale: 'en-GB',
        timezoneId: 'UTC',
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
      page.on('pageerror', (e) => consoleErrors.push(e.message))
      const r = { width: w, path, failures: [] }
      try {
        const res = await page.goto(APP + path, { waitUntil: 'networkidle', timeout: 30_000 })
        if (!res || !res.ok()) throw new Error(`answered ${res ? res.status() : 'nothing'}`)
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(400)
        Object.assign(r, await page.evaluate(inspect, { vw: w, MIN_TEXT, MIN_INPUT, MIN_TARGET }))
        const axe = await new AxeBuilder({ page }).analyze()
        r.axe = axe.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))
        r.axeOther = axe.violations.filter((v) => v.impact !== 'serious' && v.impact !== 'critical').map((v) => `${v.id} (${v.impact})`)
        const shot = join(OUT, String(w), fileFor(path))
        await page.screenshot({ path: shot, fullPage: true, animations: 'disabled', caret: 'hide' })
        r.screenshot = relative(ROOT, shot)
        r.console = consoleErrors
        if (r.overflow > 1) r.failures.push(`scrolls sideways by ${r.overflow} px: ${r.wide.join(' | ')}`)
        if (r.text.length) r.failures.push(`${r.text.reduce((n, t) => n + t.count, 0)} text node(s) under ${MIN_TEXT} px`)
        if (r.inputs.length) r.failures.push(`${r.inputs.length} input(s) under ${MIN_INPUT} px`)
        if (r.targets.length) r.failures.push(`${r.targets.length} target(s) under ${MIN_TARGET} x ${MIN_TARGET}`)
        if (r.axe.length) r.failures.push(`axe: ${r.axe.map((v) => `${v.id} (${v.impact}, ${v.nodes})`).join(', ')}`)
        if (r.console.length) r.failures.push(`${r.console.length} console error(s)`)
      } catch (e) {
        r.notServed = `${APP + path} ${e.message.split('\n')[0]}`
        r.failures.push(`not served: ${r.notServed}`)
        r.console = consoleErrors
      }
      await context.close()
      results.push(r)
      console.log(`${String(w).padEnd(4)} ${path.padEnd(20)} ${r.failures.length ? 'FAIL  ' + r.failures.join(' ; ') : 'ok'}`)
    }
  }
} finally {
  await browser.close()
}

// ---------------------------------------------------------------------------------------------- report

const failed = results.filter((r) => r.failures.length).length
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ when: new Date().toISOString(), app: APP, results }, null, 2) + '\n')
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const md = ['# Phone check: 390 and 360 px', '']
md.push(`Run ${new Date().toISOString()} against \`${APP}\`. The design has no phone layout, so this is rules, axe and a person (owner's answer B3). The rules: no sideways scroll; body text (400 or 500, above the meta sizes, outside a control) at least ${MIN_TEXT} px (handoff section 4 Type); inputs at least ${MIN_INPUT} px; targets at least ${MIN_TARGET} x ${MIN_TARGET}; no serious or critical axe violation; no console error.`, '')
md.push(`**${results.length - failed} of ${results.length} pass.**`, '')
md.push('| Width | Path | Result | Screenshot |', '|---|---|---|---|')
for (const r of results) md.push(`| ${r.width} | ${r.path} | ${r.failures.length ? esc(r.failures.join('; ')) : 'ok'} | ${r.screenshot ? `[${fileFor(r.path)}](${r.width}/${fileFor(r.path)})` : ''} |`)
md.push('')
for (const r of results.filter((x) => x.failures.length)) {
  md.push(`## ${r.width} px ${r.path}`, '')
  if (r.notServed) md.push(`Not served: ${esc(r.notServed)}`, '')
  if (r.overflow > 1) md.push(`Scrolls sideways by ${r.overflow} px. Outermost culprits:`, '', ...r.wide.map((x) => `- \`${esc(x)}\``), '')
  if (r.text?.length) {
    md.push(`Body text under ${MIN_TEXT} px (\`data-allow-small\` exempts one on purpose):`, '', '| Element | Size | Nodes | Starts with |', '|---|---|---|---|')
    md.push(...r.text.map((t) => `| \`${esc(t.selector)}\` | ${t.fontSize} | ${t.count} | ${esc(t.sample)} |`), '')
  }
  if (r.inputs?.length) md.push(`Inputs under ${MIN_INPUT} px:`, '', ...r.inputs.map((t) => `- \`${esc(t.selector)}\` ${t.fontSize}`), '')
  if (r.targets?.length) {
    md.push(`Targets under ${MIN_TARGET} x ${MIN_TARGET}:`, '', '| Element | Box | Name |', '|---|---|---|')
    md.push(...r.targets.map((t) => `| \`${esc(t.selector)}\` | ${t.size} | ${esc(t.name)} |`), '')
  }
  if (r.axe?.length) md.push('Axe, serious and critical:', '', ...r.axe.map((v) => `- ${v.id} (${v.impact}, ${v.nodes} node(s)): ${esc(v.help)}. ${v.targets.map((t) => `\`${esc(t)}\``).join(', ')}`), '')
  if (r.console?.length) md.push('Console errors:', '', ...r.console.slice(0, 10).map((e) => `- ${esc(e.slice(0, 300))}`), '')
}
const minor = results.filter((r) => r.axeOther?.length)
if (minor.length) md.push('## Axe, moderate and minor (not a failure)', '', ...minor.map((r) => `- ${r.width} px ${r.path}: ${r.axeOther.join(', ')}`), '')
md.push('## What a person still reviews', '', 'Open each screenshot. Look for: text that wraps badly or truncates meaning; cards squeezed into narrow columns; the bottom bar covering content or a button; a table that should scroll inside its card; focus rings cut off; anything that reads as a desktop page shrunk.', '')
writeFileSync(join(OUT, 'report.md'), md.join('\n') + '\n')
console.log(`\n${results.length - failed} of ${results.length} pass. Report: ${relative(ROOT, join(OUT, 'report.md'))}`)
process.exit(failed ? 1 : 0)
