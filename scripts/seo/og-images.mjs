/**
 * The share cards (Orgpuls scripts/marketing/og-images.mjs, adapted): 1200 by 630 PNGs in public/og, drawn
 * by Chromium in the site's own fonts, so a card looks like the site. An article's card is the brand,
 * "Articles" and its heading; no product picture and no claims (Orgpuls D-235). Also the logo at 512 px,
 * which the Organization data names.
 *
 *   NEXT_DIST_DIR=.next-build npx next start -p 3100 &   (the fonts are read from the running site)
 *   node scripts/seo/og-images.mjs [--base http://localhost:3100]
 *
 * The outputs are committed, like the templates' files, so a deploy needs no browser.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { tsImport } from 'tsx/esm/api'

const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3100'
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium'
const { PRODUCT_NAME } = await tsImport('../../lib/brand.ts', import.meta.url)
const { allArticles } = await tsImport('../../lib/site/article-load.ts', import.meta.url)
const { allTemplates } = await tsImport('../../lib/site/template-load.ts', import.meta.url)
const { loadPage, PRODUCT_PAGES } = await tsImport('../../lib/site/pages.ts', import.meta.url)
const { allFeatures } = await tsImport('../../lib/site/features.ts', import.meta.url)
const messages = JSON.parse(readFileSync('messages/en.json', 'utf8'))
const fonts = readFileSync('app/fonts.css', 'utf8')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** One card: the logo and name, a kicker pill, the heading, and the site's address */
const card = ({ kicker, title }) => `<!doctype html><html><head><style>${fonts}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #f1ede6; font-family: Figtree, sans-serif; color: #111; padding: 36px; }
  .panel { height: 100%; border-radius: 28px; background: #e4d9c9; border: 1px solid #e4ddd2; padding: 56px 64px; display: flex; flex-direction: column; }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 700; font-size: 30px; }
  .mark { width: 42px; height: 42px; border-radius: 50%; background: #111; display: flex; align-items: center; justify-content: center; }
  .dot { width: 16px; height: 16px; border-radius: 50%; background: #fff; }
  .kicker { margin-top: 56px; align-self: flex-start; border-radius: 99px; background: #cccbdc; color: #3a3950; font-weight: 600; font-size: 24px; padding: 8px 20px; }
  h1 { margin-top: 26px; font-family: Poppins, sans-serif; font-weight: 500; letter-spacing: -0.03em; line-height: 1.08; font-size: ${title.length > 60 ? 54 : 64}px; max-width: 980px; text-wrap: balance; }
  .site { margin-top: auto; font-size: 24px; color: #55524a; }
</style></head><body><div class="panel">
  <div class="brand"><span class="mark"><span class="dot"></span></span>${esc(PRODUCT_NAME)}</div>
  <span class="kicker">${esc(kicker)}</span>
  <h1>${esc(title)}</h1>
  <div class="site">www.leaderpact.com</div>
</div></body></html>`

const cards = [
  { file: 'default', kicker: messages.landing.eyebrow, title: messages.landing.headline },
  { file: 'leadership-team-assessment', kicker: messages.landing.eyebrow, title: messages.landing.headline },
  { file: 'leader-profile', kicker: messages.profile.eyebrow, title: messages.profile.title },
  { file: 'articles', kicker: messages.site.articles.crumb, title: messages.site.articles.h1 },
  { file: 'templates', kicker: messages.site.articles.templates, title: messages.site.templates.h1 },
  ...Object.keys(PRODUCT_PAGES).map((k) => {
    const c = loadPage(k)
    return { file: PRODUCT_PAGES[k].path.slice(1), kicker: c.kicker, title: c.h1 }
  }),
  // the platform's feature pages (D-46)
  ...allFeatures().map(({ entry, content }) => ({ file: `platform/${entry.slug}`, kicker: messages.site.features.crumb, title: content.h1 })),
  ...allTemplates().map(({ template, content }) => ({ file: `templates/${template.slug}`, kicker: content.kicker, title: content.h1 })),
  ...allArticles().map(({ entry, content }) => ({ file: `articles/${entry.slug}`, kicker: messages.site.articles.crumb, title: content.h1 })),
]

mkdirSync('public/og/articles', { recursive: true })
mkdirSync('public/og/templates', { recursive: true })
mkdirSync('public/og/platform', { recursive: true })
const browser = await chromium.launch({ executablePath })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
// the site's origin, so /fonts/… in the stylesheet loads from the running server
await page.goto(`${base}/robots.txt`)
for (const c of cards) {
  await page.setContent(card(c), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `public/og/${c.file}.png` })
  console.log(`public/og/${c.file}.png`)
}
// the logo, for the Organization data
await page.setViewportSize({ width: 512, height: 512 })
await page.setContent('<!doctype html><body style="margin:0;width:512px;height:512px;display:flex;align-items:center;justify-content:center;background:#fff"><div style="width:432px;height:432px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center"><div style="width:166px;height:166px;border-radius:50%;background:#fff"></div></div></body>')
await page.screenshot({ path: 'public/icon-512.png' })
console.log('public/icon-512.png')
await browser.close()
