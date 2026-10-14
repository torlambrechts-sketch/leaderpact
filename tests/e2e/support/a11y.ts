import { expect, type Page } from '@playwright/test'

/**
 * The accessibility checks of handoff 13 that axe does not make (milestone 18; D-56). axe-core already checks
 * contrast at 4.5 to 1, names, roles and links told apart from text by more than colour; these add:
 *
 * - **Touch targets of 44 px** below 768 px (CLAUDE.md, Design): every control on screen is at least 44 by 44,
 *   save a link inside a sentence (WCAG 2.5.5's inline exception) and a native radio or checkbox whose label is
 *   the target, which is measured instead.
 * - **Every control is reachable by keyboard**, with the focus ring: Tab walks the page; every element it reaches
 *   shows a 2 px outline (handoff section 4), and nothing the pointer can press is left out of the walk.
 * - **No information by colour alone**: a small coloured mark with no text is decoration beside its words
 *   (aria-hidden), or carries a name of its own; a meter says its value and label in words.
 */

const CONTROLS = [
  'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'summary',
  '[role="button"]', '[role="link"]', '[role="radio"]', '[role="checkbox"]', '[role="switch"]', '[role="tab"]', '[role="menuitem"]', '[role="option"]',
].join(',')

/** Controls under 44 by 44 px, described by their name and size; run below 768 px */
export async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const out: string[] = []
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"], [hidden], [inert]')
    }
    const name = (el: Element) =>
      (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('title') || el.getAttribute('name') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50)
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (!visible(el)) continue
      // a link inside a sentence takes the line's height (WCAG 2.5.5, inline)
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') {
        const block = el.parentElement?.closest('p, li, dd, td, label, span, small, figcaption, blockquote, h1, h2, h3, h4')
        const text = (block?.textContent ?? '').trim()
        if (block && text.length > ((el as HTMLElement).innerText ?? '').trim().length) continue
      }
      // a native radio or checkbox is pressed through its label
      let target: Element = el
      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) target = el.closest('label') ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null) ?? el
      // an element inside a larger control is pressed through it
      const outer = target.parentElement?.closest('a[href], button, label, [role="radio"], [role="checkbox"], [role="option"]')
      if (outer && outer !== target) continue
      const r = target.getBoundingClientRect()
      if (r.width < 43.5 || r.height < 43.5) out.push(`${name(el)} (${Math.round(r.width)} by ${Math.round(r.height)})`)
    }
    return out
  }, CONTROLS)
}

/** Tab through the page; the elements reached, each with whether its focus ring shows */
export async function tabWalk(page: Page, limit = 250): Promise<{ reached: Set<string>; ringless: string[]; trapped: boolean }> {
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    let n = 0
    for (const el of Array.from(document.querySelectorAll('*'))) if (!el.hasAttribute('data-a11y')) el.setAttribute('data-a11y', String(n++))
  })
  const reached = new Set<string>()
  const ringless: string[] = []
  let last = ''
  let repeats = 0
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab')
    const seen = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || /\d+px \d+px 0px [2-9]/.test(s.boxShadow)
      const label = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('name') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50)
      return { key: el.getAttribute('data-a11y') ?? '', label, ring }
    })
    if (!seen) {
      if (reached.size > 0) break
      continue
    }
    if (reached.has(seen.key)) break
    if (seen.key === last) {
      if (++repeats > 3) return { reached, ringless, trapped: true }
    } else repeats = 0
    last = seen.key
    reached.add(seen.key)
    if (!seen.ring) ringless.push(seen.label)
  }
  return { reached, ringless, trapped: false }
}

/**
 * What the pointer can press but the keyboard cannot reach: an element drawn with a pointer cursor that is no
 * control, has none inside it, and sits in none; and every enabled, visible control the walk left out. Radix's
 * radio groups and menus are one tab stop, entered then moved through with the arrows, so a radio counts as
 * reached when its group was.
 */
export async function unreachable(page: Page, reached: Set<string>): Promise<string[]> {
  return page.evaluate(
    ({ selector, keys }) => {
      const seen = new Set(keys)
      const out: string[] = []
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"], [hidden], [inert]')
      }
      const name = (el: Element) => (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50)
      for (const el of Array.from(document.querySelectorAll(selector))) {
        if (!visible(el) || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') continue
        if (el.getAttribute('tabindex') === '-1' && el.closest('[role="radiogroup"], [role="menu"], [role="listbox"], [role="tablist"]')) {
          const group = el.closest('[role="radiogroup"], [role="menu"], [role="listbox"], [role="tablist"]')!
          if (Array.from(group.querySelectorAll('[data-a11y]')).some((m) => seen.has(m.getAttribute('data-a11y') ?? ''))) continue
        }
        // a native radio is one tab stop per group, like Radix's
        if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
          if (Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`)).some((m) => seen.has(m.getAttribute('data-a11y') ?? ''))) continue
        }
        // a visually hidden input is pressed through its label, which the walk reaches through the input
        if (!seen.has(el.getAttribute('data-a11y') ?? '')) out.push(`not reached: ${name(el)}`)
      }
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        if (!visible(el) || getComputedStyle(el).cursor !== 'pointer') continue
        if (el.matches(selector) || el.closest(selector) || el.querySelector(selector) || el.closest('label')) continue
        out.push(`pointer, no control: ${name(el)}`)
      }
      return out
    },
    { selector: CONTROLS, keys: Array.from(reached) },
  )
}

/** Marks that carry meaning by colour alone: a small coloured shape with no text, not hidden and with no name */
export async function colourOnly(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || r.width > 24 || r.height > 24) continue
      if (el.closest('[aria-hidden="true"], svg, [hidden]') || (el.textContent ?? '').trim() !== '' || el.children.length > 0) continue
      const s = getComputedStyle(el)
      const filled = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent'
      if (!filled || s.visibility === 'hidden') continue
      if (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('role') === 'img') continue
      // the control's own parts (a radio's ring, a switch's thumb) are named by the control
      if (el.closest('button, a[href], label, [role="radio"], [role="checkbox"], [role="switch"], [role="option"], [role="meter"], [role="progressbar"], input')) continue
      out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ').slice(0, 3).join('.')}`)
    }
    for (const m of Array.from(document.querySelectorAll('[role="meter"], [role="progressbar"]'))) {
      if (!m.getAttribute('aria-valuetext') && !m.getAttribute('aria-label') && !m.getAttribute('aria-labelledby')) out.push(`a ${m.getAttribute('role')} with no words`)
    }
    return out
  })
}

/** All four, on the page as it stands: targets at the two phone widths, the walk and the marks at 1280 */
export async function checkA11y(page: Page, where: string) {
  const size = page.viewportSize() ?? { width: 1280, height: 800 }
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await smallTargets(page), `${where}: targets under 44 px at ${width} px`).toEqual([])
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  const walk = await tabWalk(page)
  expect(walk.trapped, `${where}: the keyboard is trapped`).toBe(false)
  expect(walk.ringless, `${where}: focus with no ring`).toEqual([])
  expect(await unreachable(page, walk.reached), `${where}: not reached by keyboard`).toEqual([])
  expect(await colourOnly(page), `${where}: colour alone`).toEqual([])
  await page.setViewportSize(size)
}
