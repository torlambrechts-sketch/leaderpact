/**
 * Builds the free guide (D-60), "How leadership teams really work", into private/templates/: the print view of
 * every published article (app/print/guide), printed to A4 by Chromium. The output is committed, like the Word
 * templates, so a deploy needs no browser.
 *
 *   NEXT_DIST_DIR=.next-build npx next build && NEXT_DIST_DIR=.next-build npx next start -p 3100 -H 127.0.0.1 &
 *   node scripts/templates/guide.mjs [--base http://127.0.0.1:3100] [--edition 2026-10-16]
 *
 * It also writes private/templates/guide-manifest.json: the articles in the guide, in order, each with a hash of
 * its words, and a hash of the guide's own words. tests/unit/guide.test.ts holds them equal to the files, so an
 * article changed without a rebuild fails the suite instead of shipping a stale guide.
 *
 * The page's links to this site become absolute (www.leaderpact.com), and a chapter's source marks point to its
 * own list: every article numbers its sources from 1. Local only: it refuses a server that is not on this machine.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const ROOT = new URL('../../', import.meta.url).pathname
const argv = process.argv.slice(2)
const arg = (name, fallback) => (argv.indexOf(name) >= 0 ? argv[argv.indexOf(name) + 1] : fallback)
const BASE = arg('--base', 'http://127.0.0.1:3100')
const EDITION = arg('--edition', new Date().toISOString().slice(0, 10))
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE) || !/^\d{4}-\d{2}-\d{2}$/.test(EDITION)) {
  console.error('guide: run against a local server, with --edition as YYYY-MM-DD; refused')
  process.exit(2)
}

const read = (path) => readFileSync(join(ROOT, path), 'utf8')
const sha = (text) => createHash('sha256').update(text).digest('hex')
const PRODUCT = /PRODUCT_NAME = '([^']+)'/.exec(read('lib/brand.ts'))?.[1]
const SITE_HOST = /SITE_HOST = '([^']+)'/.exec(read('lib/site/config.ts'))?.[1]
const FILE = /GUIDE_FILE = '([^']+)'/.exec(read('lib/site/templates.ts'))?.[1]
if (!PRODUCT || !SITE_HOST || !FILE) throw new Error('guide: the product name, the site host or the file name was not found')

/** The guide's own words: what tests/unit/guide.test.ts hashes the same way */
function copyHash(messages) {
  return sha(JSON.stringify({ guide: messages.site.guide, groups: messages.site.articles.groups }))
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--lang=en-GB', '--font-render-hinting=none'] })
try {
  const page = await browser.newPage({ locale: 'en-GB' })
  const res = await page.goto(`${BASE}/print/guide?edition=${EDITION}`, { waitUntil: 'networkidle' })
  if (!res?.ok()) throw new Error(`guide: the print view answered ${res?.status()}`)
  await page.evaluate(() => document.fonts.ready)

  const slugs = await page.evaluate((site) => {
    for (const a of document.querySelectorAll('a[href^="/"]')) a.setAttribute('href', `https://${site}${a.getAttribute('href')}`)
    for (const chapter of document.querySelectorAll('article[data-chapter]')) {
      const n = chapter.getAttribute('data-chapter')
      for (const el of chapter.querySelectorAll('[id^="source-"]')) el.id = `c${n}-${el.id}`
      for (const a of chapter.querySelectorAll('a[href^="#source-"]')) a.setAttribute('href', `#c${n}-${a.getAttribute('href').slice(1)}`)
    }
    return [...document.querySelectorAll('article[data-slug]')].map((a) => a.getAttribute('data-slug'))
  }, SITE_HOST)
  if (slugs.length === 0) throw new Error('guide: the print view has no chapters')

  const footer = `<div style="width:100%;padding:0 16mm;display:flex;justify-content:space-between;font:8px Helvetica,Arial,sans-serif;color:#55524a;"><span>${PRODUCT} · ${SITE_HOST}</span><span class="pageNumber"></span></div>`
  await page.pdf({
    path: join(ROOT, 'private', 'templates', FILE),
    format: 'A4',
    // the site's 17 px body is large on paper; at 0.8 the page lays out at desktop width and reads at about 10 pt
    scale: 0.8,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer,
    margin: { top: '16mm', right: '16mm', bottom: '18mm', left: '16mm' },
    tagged: true,
    outline: true,
  })

  const manifest = {
    file: FILE,
    edition: EDITION,
    articles: slugs.map((slug) => ({ slug, sha256: sha(read(`data/articles/${slug}.json`)) })),
    copy: copyHash(JSON.parse(read('messages/en.json'))),
  }
  writeFileSync(join(ROOT, 'private', 'templates', 'guide-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`guide: ${slugs.length} chapters → private/templates/${FILE}`)
} finally {
  await browser.close()
}
