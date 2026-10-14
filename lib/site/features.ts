import { z } from 'zod'
import { PRODUCT_NAME } from '@/lib/brand'
import type { ArtKind } from './articles'
import { Copy } from './blocks'
import { PageContent } from './page-content'
import scan from '@/data/features/leadership-team-scan.json'
import teamView from '@/data/features/team-view.json'
import profile from '@/data/features/leader-profile.json'
import charter from '@/data/features/team-charter.json'
import diagnostic from '@/data/features/full-diagnostic.json'

/**
 * The platform's feature pages (D-44): one page per feature the product has today, under /platform, each with
 * screenshots of the real app (lib/site/shots.ts) and what the feature brings to the person, the leadership
 * group and the organisation. They describe and sell nothing: no price, no offer (D-38). A feature that is
 * not built has no page; the overview lists it as in development. The order is the loop's (handoff 1).
 */
export const FEATURES = [
  {
    slug: 'leadership-team-scan',
    file: scan,
    art: 'scan',
    icon: 'scan',
    queries: ['leadership team scan', 'free leadership team assessment', 'quick team effectiveness survey'],
    related: ['how-to-assess-a-leadership-team', 'what-makes-a-leadership-team-effective'],
  },
  {
    slug: 'team-view',
    file: teamView,
    art: 'teamview',
    icon: 'team',
    queries: ['leadership team survey results', 'team survey agreement', 'how to read team survey results'],
    related: ['how-to-assess-a-leadership-team', 'psychological-safety-in-leadership-teams'],
  },
  {
    slug: 'leader-profile',
    file: profile,
    art: 'profile',
    icon: 'profile',
    queries: ['leader personality profile', 'big five test for leaders', 'free personality test for managers'],
    related: ['how-to-build-trust-in-a-leadership-team', 'psychological-safety-in-leadership-teams'],
  },
  {
    slug: 'team-charter',
    file: charter,
    art: 'charter',
    icon: 'charter',
    queries: ['leadership team charter software', 'team charter tool', 'team decision rights'],
    related: ['leadership-team-charter', 'leadership-team-purpose'],
  },
  {
    slug: 'full-diagnostic',
    file: diagnostic,
    art: 'diagnostic',
    icon: 'diagnostic',
    queries: ['leadership team diagnostic', 'team effectiveness diagnostic', 'leadership team effectiveness assessment'],
    related: ['how-to-assess-a-leadership-team', 'what-makes-a-leadership-team-effective'],
  },
] as const satisfies readonly {
  slug: string
  file: unknown
  art: ArtKind
  icon: string
  queries: readonly [string, ...string[]]
  related: readonly [string, string]
}[]

export type FeatureSlug = (typeof FEATURES)[number]['slug']
export type FeatureIcon = (typeof FEATURES)[number]['icon']

export const PLATFORM_PATH = '/platform'
export const featurePath = (slug: string) => `${PLATFORM_PATH}/${slug}`

/** A feature page's words: a product page's, with its name in the menu and one line on what it does */
export const FeatureContent = PageContent.extend({
  /** its name in the Platform menu and on the other features' cards */
  nav: Copy,
  /** one line on what it does, under its name in the menu */
  summary: Copy,
})
export type FeatureContent = z.infer<typeof FeatureContent>

/** `{product}` in every string of a page's data, replaced by the product's name */
const named = (value: unknown): unknown =>
  typeof value === 'string'
    ? value.replaceAll('{product}', PRODUCT_NAME)
    : Array.isArray(value)
      ? value.map(named)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, named(v)]))
        : value

export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug) ?? null

export function loadFeature(slug: string): FeatureContent | null {
  const f = featureBySlug(slug)
  return f ? FeatureContent.parse(named(f.file)) : null
}

/** Every feature with its words, in the loop's order: for the menu, the overview and the sitemap */
export const allFeatures = () => FEATURES.map((f) => ({ entry: f, content: FeatureContent.parse(named(f.file)) }))
