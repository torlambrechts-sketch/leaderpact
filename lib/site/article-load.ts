import { ArticleContent } from './article-content'
import { articleBySlug, PUBLISHED, type ArticleEntry } from './articles'
import whatMakes from '@/data/articles/what-makes-a-leadership-team-effective.json'
import assess from '@/data/articles/how-to-assess-a-leadership-team.json'
import fiveDysfunctions from '@/data/articles/five-dysfunctions-of-a-team-and-the-research.json'
import purpose from '@/data/articles/leadership-team-purpose.json'
import charter from '@/data/articles/leadership-team-charter.json'
import size from '@/data/articles/how-big-should-a-leadership-team-be.json'
import agenda from '@/data/articles/leadership-team-meeting-agenda.json'
import safety from '@/data/articles/psychological-safety-in-leadership-teams.json'
import trust from '@/data/articles/how-to-build-trust-in-a-leadership-team.json'
import conflict from '@/data/articles/task-conflict-and-relationship-conflict.json'

/**
 * The published articles' words, imported so the build carries them and parsed once, so a file that breaks
 * the schema fails the build rather than a reader's page. tests/unit/articles.test.ts holds this list equal
 * to the registry's published articles.
 */
export const ARTICLE_FILES: Record<string, unknown> = {
  'what-makes-a-leadership-team-effective': whatMakes,
  'how-to-assess-a-leadership-team': assess,
  'five-dysfunctions-of-a-team-and-the-research': fiveDysfunctions,
  'leadership-team-purpose': purpose,
  'leadership-team-charter': charter,
  'how-big-should-a-leadership-team-be': size,
  'leadership-team-meeting-agenda': agenda,
  'psychological-safety-in-leadership-teams': safety,
  'how-to-build-trust-in-a-leadership-team': trust,
  'task-conflict-and-relationship-conflict': conflict,
}

const parsed = new Map<string, ArticleContent>()

/** A published article's words, or null when the slug is not a published article */
export function loadArticle(slug: string): { entry: ArticleEntry; content: ArticleContent } | null {
  const entry = articleBySlug(slug)
  const file = ARTICLE_FILES[slug]
  if (!entry || file === undefined) return null
  let content = parsed.get(slug)
  if (!content) {
    content = ArticleContent.parse(file)
    parsed.set(slug, content)
  }
  return { entry, content }
}

/** Every published article with its words, in registry order */
export const allArticles = () => PUBLISHED.flatMap((e) => loadArticle(e.slug) ?? [])
