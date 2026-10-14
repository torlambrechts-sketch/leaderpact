// Origin: Orgpuls lib/marketing/schema.ts @ d9b1c52 (adapted: one site, research sources as citations, no offers).
import { PRODUCT_NAME } from '@/lib/brand'
import { absolute, CONTACT_MAIL, PUBLISHER, SITE_URL } from './config'
import { plain, sourceLabel, type Source } from './blocks'

/**
 * JSON-LD for the public pages. Every value is copy the page itself shows, or a fact the product enforces,
 * so what a search engine or an answer engine is told and what a visitor reads cannot drift apart. Nothing
 * here is written for crawlers alone (docs/marketing/seo-geo-strategy.md, section 2).
 */
type Node = Record<string, unknown>

const ORG_ID = `${SITE_URL}/#organization`
const SITE_ID = `${SITE_URL}/#website`

export function organization(): Node {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: PRODUCT_NAME,
    url: SITE_URL,
    logo: absolute('/icon-512.png'),
    email: CONTACT_MAIL,
    ...(PUBLISHER.legalName ? { legalName: PUBLISHER.legalName } : {}),
    ...(PUBLISHER.sameAs.length ? { sameAs: PUBLISHER.sameAs } : {}),
  }
}

export function website(description: string): Node {
  return { '@type': 'WebSite', '@id': SITE_ID, url: SITE_URL, name: PRODUCT_NAME, description, inLanguage: 'en-GB', publisher: { '@id': ORG_ID } }
}

/**
 * The product as software. No offers: the paid plan cannot be bought yet (handoff milestone 8), and a
 * price a visitor cannot pay is not a fact (D-33). The free tools are named in the description the page shows.
 */
export function software(description: string): Node {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: PRODUCT_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description,
    publisher: { '@id': ORG_ID },
  }
}

export function webPage(path: string, name: string, description: string, type = 'WebPage'): Node {
  return { '@type': type, '@id': `${absolute(path)}#page`, url: absolute(path), name, description, inLanguage: 'en-GB', isPartOf: { '@id': SITE_ID } }
}

export function breadcrumbs(trail: { name: string; path: string }[]): Node {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absolute(c.path) })),
  }
}

export function faqPage(path: string, items: { q: string; a: string }[]): Node {
  return {
    '@type': 'FAQPage',
    '@id': `${absolute(path)}#faq`,
    mainEntity: items.map((i) => ({ '@type': 'Question', name: plain(i.q), acceptedAnswer: { '@type': 'Answer', text: plain(i.a) } })),
  }
}

export function article(a: {
  path: string
  headline: string
  description: string
  published: string
  modified: string
  words: number
  image: string
  sources: Source[]
  about: string[]
}): Node {
  return {
    '@type': 'Article',
    '@id': `${absolute(a.path)}#article`,
    headline: a.headline,
    description: a.description,
    inLanguage: 'en-GB',
    datePublished: a.published,
    dateModified: a.modified,
    wordCount: a.words,
    mainEntityOfPage: absolute(a.path),
    image: absolute(a.image),
    keywords: a.about.join(', '),
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    citation: a.sources.map((s) => ({ '@type': 'CreativeWork', name: sourceLabel(s), url: s.url, datePublished: String(s.year) })),
  }
}

export const graph = (...nodes: Node[]) => ({ '@context': 'https://schema.org', '@graph': nodes })
