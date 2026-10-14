/**
 * The articles: which exist, where they sit on the index and how they link to each other (D-34). The words
 * are data (data/articles/<slug>.json, lib/site/article-content.ts); this file holds only what is not words,
 * so adding an article is an entry here and a data file, never a component change.
 *
 * The plan has twenty (docs/marketing/seo-geo-strategy.md, section 4). A planned article is listed so the
 * plan, the keyword map and Sentral's content plan read from one place; it has no page until it is written
 * and its status says published.
 *
 * Articles inform and sell nothing (D-34, after Orgpuls D-235): no product, no price, no offer beside the
 * text. The site's header and footer are the way to the product.
 */

/** The index's sections, in the order it shows them; their words are `articles.groups.<group>` */
export const ARTICLE_GROUPS = ['start', 'conditions', 'meetings', 'dynamics'] as const
export type ArticleGroup = (typeof ARTICLE_GROUPS)[number]

/** The drawings beside an article's title and on its card (D-41, components/site/art/ArticleArt.tsx) */
export const ART_KINDS = ['layers', 'assess', 'pyramid', 'compass', 'charter', 'network', 'agenda', 'voice', 'bridge', 'debate'] as const
export type ArtKind = (typeof ART_KINDS)[number]

export type ArticleEntry = {
  slug: string
  group: ArticleGroup
  /** its drawing; a published article has one */
  art?: ArtKind
  /** the search the article is the one answer to (one page per intent), then the others in its cluster */
  queries: [string, ...string[]]
  status: 'published' | 'planned'
  /** YYYY-MM-DD; a planned article has none */
  published?: string
  modified?: string
  /** two published articles, by slug, shown under "Read next" */
  related?: [string, string]
  /** the free template that goes with it (lib/site/templates.ts), shown at its foot */
  template?: string
}

/** Newest first within a section: the order the index lists them in */
export const ARTICLES: ArticleEntry[] = [
  // where to start
  {
    slug: 'what-makes-a-leadership-team-effective',
    art: 'layers',
    group: 'start',
    queries: ['leadership team effectiveness', 'high performing leadership team', 'how to build a high performing leadership team'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['leadership-team-purpose', 'how-to-assess-a-leadership-team'],
    template: 'leadership-team-charter-template',
  },
  {
    slug: 'how-to-assess-a-leadership-team',
    art: 'assess',
    group: 'start',
    queries: ['how to assess a leadership team', 'leadership team effectiveness survey questions', 'executive team effectiveness assessment'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['what-makes-a-leadership-team-effective', 'five-dysfunctions-of-a-team-and-the-research'],
  },
  {
    slug: 'five-dysfunctions-of-a-team-and-the-research',
    art: 'pyramid',
    group: 'start',
    queries: ['five dysfunctions of a team', 'five dysfunctions of a team assessment', 'lencioni model research'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['how-to-build-trust-in-a-leadership-team', 'task-conflict-and-relationship-conflict'],
  },
  { slug: 'direction-alignment-and-commitment', group: 'start', queries: ['direction alignment commitment', 'leadership outcomes DAC'], status: 'planned' },
  { slug: 'anonymous-surveys-in-small-teams', group: 'start', queries: ['anonymous survey small team', 'survey anonymity threshold'], status: 'planned' },
  { slug: 'how-often-to-measure-a-leadership-team', group: 'start', queries: ['team pulse survey frequency', 'how often to survey a team'], status: 'planned' },

  // purpose, tasks and membership
  {
    slug: 'leadership-team-purpose',
    art: 'compass',
    group: 'conditions',
    queries: ['purpose of a leadership team', 'role of a leadership team', 'what is a leadership team for'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['leadership-team-charter', 'how-big-should-a-leadership-team-be'],
    template: 'leadership-team-charter-template',
  },
  {
    slug: 'leadership-team-charter',
    art: 'charter',
    group: 'conditions',
    queries: ['leadership team charter', 'team charter template', 'how to write a team charter'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['leadership-team-purpose', 'leadership-team-meeting-agenda'],
    template: 'leadership-team-charter-template',
  },
  {
    slug: 'how-big-should-a-leadership-team-be',
    art: 'network',
    group: 'conditions',
    queries: ['leadership team size', 'how big should a leadership team be', 'optimal team size'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['leadership-team-purpose', 'what-makes-a-leadership-team-effective'],
    template: 'leadership-team-charter-template',
  },
  { slug: 'the-team-leaders-role', group: 'conditions', queries: ['role of the leader of a leadership team', 'team leader role design'], status: 'planned' },
  { slug: 'leadership-team-composition', group: 'conditions', queries: ['leadership team composition', 'diversity in top management teams'], status: 'planned' },

  // meetings and decisions
  {
    slug: 'leadership-team-meeting-agenda',
    art: 'agenda',
    group: 'meetings',
    queries: ['leadership team meeting agenda', 'leadership team meeting agenda template', 'leadership team meeting topics'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['leadership-team-charter', 'task-conflict-and-relationship-conflict'],
    template: 'leadership-team-meeting-agenda-template',
  },
  { slug: 'why-leadership-team-meetings-fail', group: 'meetings', queries: ['ineffective leadership team meetings', 'meeting goal clarity'], status: 'planned' },
  { slug: 'decision-making-in-leadership-teams', group: 'meetings', queries: ['leadership team decision making', 'decision rights leadership team'], status: 'planned' },

  // how the team works together
  {
    slug: 'psychological-safety-in-leadership-teams',
    art: 'voice',
    group: 'dynamics',
    queries: ['psychological safety in leadership teams', 'psychological safety', 'psychological safety at the top'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['how-to-build-trust-in-a-leadership-team', 'task-conflict-and-relationship-conflict'],
  },
  {
    slug: 'how-to-build-trust-in-a-leadership-team',
    art: 'bridge',
    group: 'dynamics',
    queries: ['how to build trust in a leadership team', 'trust in leadership teams', 'building trust in a senior team'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['psychological-safety-in-leadership-teams', 'five-dysfunctions-of-a-team-and-the-research'],
  },
  {
    slug: 'task-conflict-and-relationship-conflict',
    art: 'debate',
    group: 'dynamics',
    queries: ['task conflict and relationship conflict', 'task conflict', 'conflict in leadership teams'],
    status: 'published',
    published: '2026-10-13',
    modified: '2026-10-14',
    related: ['psychological-safety-in-leadership-teams', 'leadership-team-meeting-agenda'],
    template: 'leadership-team-meeting-agenda-template',
  },
  { slug: 'behavioural-integration-in-leadership-teams', group: 'dynamics', queries: ['leadership team alignment', 'behavioural integration top management team'], status: 'planned' },
  { slug: 'political-behaviour-in-leadership-teams', group: 'dynamics', queries: ['politics in the leadership team', 'political behaviour in top teams'], status: 'planned' },
  { slug: 'team-learning-and-reflection', group: 'dynamics', queries: ['team reflexivity', 'after action review leadership team'], status: 'planned' },
]

export const PUBLISHED = ARTICLES.filter((a) => a.status === 'published')

/** A published article by its slug, or null */
export const articleBySlug = (slug: string) => PUBLISHED.find((a) => a.slug === slug) ?? null

export const ARTICLES_PATH = '/articles'
export const articlePath = (slug: string) => `${ARTICLES_PATH}/${slug}`
