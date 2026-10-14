/**
 * Sends the public site's content inventory to Sentral (D-35): one signed `content.inventory` event to its
 * product-events door, which files each page's search in Growth › SEO's content plan and tracks every search
 * as a keyword. Run it after a deploy that adds or changes public pages, as the playbook's IndexNow step was
 * in Orgpuls; .github/workflows/content.yml runs it on every push to main that touches the site's content.
 *
 *   PLATFORM_EVENTS_URL=… PLATFORM_WEBHOOK_SECRET=… node scripts/platform/publish-content.mjs
 *   node scripts/platform/publish-content.mjs --dry     print the inventory, send nothing
 *
 * The secret is read from the environment and never printed. Without it the script says so and sends nothing.
 */
import { createHmac, randomInt } from 'node:crypto'
import { tsImport } from 'tsx/esm/api'

const { contentInventory } = await tsImport('../../lib/site/inventory.ts', import.meta.url)
const inventory = contentInventory()
const counts = `${inventory.items.length} pages (${inventory.items.filter((i) => i.status === 'published').length} live), ${inventory.keywords.length} searches`

if (process.argv.includes('--dry')) {
  console.log(JSON.stringify(inventory, null, 2))
  console.log(counts)
  process.exit(0)
}

const url = process.env.PLATFORM_EVENTS_URL?.trim()
const secret = process.env.PLATFORM_WEBHOOK_SECRET?.trim()
if (!url || !secret) {
  console.log(`PLATFORM_EVENTS_URL or PLATFORM_WEBHOOK_SECRET is not set; nothing sent (${counts})`)
  process.exit(0)
}

const event = {
  id: `${Date.now()}${String(randomInt(0, 1000)).padStart(3, '0')}`,
  kind: 'content.inventory',
  org_id: null,
  payload: inventory,
  created_at: new Date().toISOString(),
}
const body = JSON.stringify({ product: 'leaderpact', events: [event] })
const ts = Math.floor(Date.now() / 1000).toString()
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-platform-product': 'leaderpact',
    'x-platform-timestamp': ts,
    'x-platform-signature': `sha256=${createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')}`,
  },
  body,
})
const reply = await res.json().catch(() => ({}))
console.log(`Sentral answered ${res.status}: ${JSON.stringify(reply)} (${counts})`)
process.exit(res.ok ? 0 : 1)
