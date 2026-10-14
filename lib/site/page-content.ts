import { z } from 'zod'
import { Blocks, Copy } from './blocks'

/**
 * The words of a page that is not an article: a template's page (data/templates) and the product pages
 * (data/pages). Long text lives in data files, as the sample content does (D-30); the short words a
 * page's frame uses are messages.
 */
export const FaqItem = z.object({ q: Copy, a: Copy })

export const PageContent = z.object({
  title: Copy,
  description: Copy,
  /** the breadcrumb's name for the page */
  crumb: Copy,
  kicker: Copy,
  h1: Copy,
  lead: Copy,
  blocks: Blocks,
  faq: z.array(FaqItem).optional(),
  /** the product's steps, each with whether it is available today or in development (D-37) */
  steps: z.array(z.object({ status: z.enum(['available', 'development']), title: Copy, text: Copy })).optional(),
})
export type PageContent = z.infer<typeof PageContent>

export const TemplateContent = PageContent.extend({
  /** what the article's foot says about the template */
  teaser: Copy,
  /** the label of each file, by its name */
  files: z.record(z.string(), Copy),
})
export type TemplateContent = z.infer<typeof TemplateContent>
