import { z } from 'zod'
import { Blocks, Copy } from './blocks'
import { named } from './pages'
import privacy from '@/data/pages/privacy.json'

/**
 * The words of a legal page (D-61): the privacy notice, in the blocks the site's long text is written in, so it
 * keeps the copy rules and a change is data, not a component. `updated` is the day the notice last changed;
 * the page prints it under the title.
 */
export const LegalContent = z.object({
  title: Copy,
  description: Copy,
  h1: Copy,
  lead: Copy,
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  blocks: Blocks,
})
export type LegalContent = z.infer<typeof LegalContent>

const LEGAL = { privacy } as const

export function loadLegal(key: keyof typeof LEGAL): LegalContent {
  return LegalContent.parse(named(LEGAL[key]))
}
