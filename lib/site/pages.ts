import { PRODUCT_NAME } from '@/lib/brand'
import type { ArtKind } from './articles'
import { PageContent } from './page-content'
import platform from '@/data/pages/platform.json'
import research from '@/data/pages/research.json'
import anonymity from '@/data/pages/anonymity.json'
import tools from '@/data/pages/assessment-tools.json'

/**
 * The product pages (D-38): what the product is and does, for the searches that ask which tool to use.
 * Unlike the articles, they may name the product and point to the scan; every claim on them is one the
 * product enforces today, or is marked as in development. The product's name comes from lib/brand.ts as
 * `{product}`, so a new name is a one-line change.
 */
export const PRODUCT_PAGES = {
  platform: {
    art: 'loop',
    path: '/platform',
    file: platform,
    related: ['what-makes-a-leadership-team-effective', 'how-to-assess-a-leadership-team'],
    queries: ['leadership team platform', 'leadership team software'],
  },
  research: {
    art: 'research',
    path: '/research',
    file: research,
    related: ['what-makes-a-leadership-team-effective', 'psychological-safety-in-leadership-teams'],
    queries: ['team effectiveness model', 'leadership team effectiveness research'],
  },
  anonymity: {
    art: 'ballot',
    path: '/anonymity',
    file: anonymity,
    related: ['how-to-assess-a-leadership-team', 'psychological-safety-in-leadership-teams'],
    queries: ['anonymous leadership team survey', 'anonymous team survey'],
  },
  tools: {
    art: 'assess',
    path: '/leadership-team-assessment-tools',
    file: tools,
    related: ['how-to-assess-a-leadership-team', 'five-dysfunctions-of-a-team-and-the-research'],
    queries: ['leadership team assessment tools', 'best leadership team assessment', 'team effectiveness assessment tool'],
  },
} as const satisfies Record<string, { art: ArtKind; path: string; file: unknown; related: readonly [string, string]; queries: readonly [string, ...string[]] }>

export type ProductPageKey = keyof typeof PRODUCT_PAGES

/** `{product}` in every string of a page's data, replaced by the product's name */
const named = (value: unknown): unknown =>
  typeof value === 'string'
    ? value.replaceAll('{product}', PRODUCT_NAME)
    : Array.isArray(value)
      ? value.map(named)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, named(v)]))
        : value

export function loadPage(key: ProductPageKey): PageContent {
  return PageContent.parse(named(PRODUCT_PAGES[key].file))
}
