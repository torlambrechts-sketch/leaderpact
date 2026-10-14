// Origin: Orgpuls lib/marketing/meta.ts @ d9b1c52 (adapted: one site, one language, no second brand).
import type { Metadata } from 'next'
import { PRODUCT_NAME } from '@/lib/brand'
import { absolute } from './config'

/** The share card every page without its own uses */
export const DEFAULT_CARD = '/og/default.png'

/**
 * A public page's metadata: its title as written (no template adds to it), one canonical address with no
 * query, and the share card. The site is English only, so there are no language alternates.
 */
export function pageMeta({
  title,
  description,
  path,
  type = 'website',
  published,
  modified,
  image = DEFAULT_CARD,
}: {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
  published?: string
  modified?: string
  image?: string
}): Metadata {
  const url = absolute(path)
  const card = { url: absolute(image), width: 1200, height: 630, alt: title }
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName: PRODUCT_NAME,
      locale: 'en_GB',
      images: [card],
      ...(type === 'article' && published ? { publishedTime: `${published}T08:00:00Z`, modifiedTime: `${modified ?? published}T08:00:00Z` } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [card.url] },
  }
}

/** For the pages a search engine has no use for: a questionnaire, a result, a sign-in */
export const NOINDEX: Metadata['robots'] = { index: false, follow: false }
