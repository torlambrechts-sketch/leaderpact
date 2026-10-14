import { z } from 'zod'
import { blockText, Blocks, Copy, linksIn, plain, Source, wordCount, type Block } from './blocks'
import { ARTICLES, ARTICLES_PATH } from './articles'

/**
 * An article's words (data/articles/<slug>.json) and the editorial rules they keep (D-33). The rules are
 * code, so the unit tests and the writer's check (scripts/verify/article.mjs) run the same ones:
 *
 * 1. **The answer first.** The lead answers the title's question in its first sentence.
 * 2. **Sells nothing.** No product name, no price, no offer, no sign-up. Links in the text go only to
 *    other published articles. The free template sits at the foot, as a resource (Orgpuls D-243).
 * 3. **Every claim has a source.** At least five, each a record a reader can find, by DOI where one exists.
 * 4. **The copy rules** of handoff section 10: British spelling, sentences under 25 words, no emoji,
 *    nothing "proven" or "validated".
 * 5. **Fit for search:** a title of at most 65 characters, a description of at most 155, a heading per
 *    question, and enough text to answer it.
 */
export const ArticleContent = z.object({
  /** the <title>, at most 65 characters, opening with the words of the search it answers */
  title: Copy,
  /** the meta description, at most 155 characters, promising what the article gives */
  description: Copy,
  h1: Copy,
  /** two to four sentences; the first answers the question */
  lead: Copy,
  /** three to five points a reader can take away, for a reader in a hurry and an answer engine alike */
  takeaways: z.array(Copy).min(3).max(5),
  blocks: Blocks,
  sources: z.array(Source).min(5),
})
export type ArticleContent = z.infer<typeof ArticleContent>

/** Words a reader reads in the whole article: lead, takeaways and blocks */
export const articleWords = (a: ArticleContent) =>
  wordCount(a.blocks) + [a.lead, ...a.takeaways].map(plain).join(' ').split(/\s+/).filter(Boolean).length

/** The product and the offer, which an article never names (rule 2) */
const SELLING = /leaderpact|leadership team scan|leader profile|sign up|sign-up|free trial|subscribe|our (?:platform|product|tool)|\$\s?\d|£\s?\d|€\s?\d/i

export const LIMITS = { title: 65, description: 155, minWords: 1100, maxWords: 2600, minH2: 4 } as const

/** Every rule an article's words break, as readable lines; empty means it keeps them all */
export function articleProblems(slug: string, data: unknown): string[] {
  const parsed = ArticleContent.safeParse(data)
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
  const a = parsed.data
  const out: string[] = []
  const entry = ARTICLES.find((e) => e.slug === slug)
  if (!entry) out.push(`${slug} is not in lib/site/articles.ts`)

  if (a.title.length > LIMITS.title) out.push(`title: ${a.title.length} characters; at most ${LIMITS.title}`)
  if (a.description.length > LIMITS.description) out.push(`description: ${a.description.length} characters; at most ${LIMITS.description}`)
  const words = articleWords(a)
  if (words < LIMITS.minWords || words > LIMITS.maxWords) out.push(`${words} words; write ${LIMITS.minWords} to ${LIMITS.maxWords}`)
  const h2 = a.blocks.filter((b: Block) => b.t === 'h2').length
  if (h2 < LIMITS.minH2) out.push(`${h2} h2 headings; at least ${LIMITS.minH2}`)
  if (a.blocks[0]?.t === 'h3') out.push('the first block is an h3; an h3 follows an h2')

  const text = [a.title, a.description, a.h1, a.lead, ...a.takeaways, ...blockText(a.blocks)]
  for (const t of text) if (SELLING.test(plain(t))) out.push(`sells or names the product: "${plain(t).match(SELLING)?.[0]}"`)

  const published = new Set(ARTICLES.filter((e) => e.status === 'published').map((e) => `${ARTICLES_PATH}/${e.slug}`))
  for (const href of linksIn(text)) {
    const path = href.split('#')[0] ?? ''
    if (!published.has(path)) out.push(`links to ${href}; the text links only to published articles`)
    if (path === `${ARTICLES_PATH}/${slug}`) out.push('links to itself')
  }

  const urls = a.sources.map((s) => s.url)
  if (new Set(urls).size !== urls.length) out.push('a source is listed twice')
  return out
}
