import { z } from 'zod'
import manifest from '@/data/shots.json'

/**
 * The product screenshots (D-44): pictures of the real app, taken by scripts/shots/capture.mjs from the
 * fixture's screenshot groups (scripts/seed/fixture.mjs --shots), a fictional demo organisation. The capture
 * writes data/shots.json; this reads it. A page names a picture by its id, and the words that go with it, its
 * description and caption, are the page's own data.
 */
const Shot = z.object({
  file: z.string().regex(/^\/shots\/[a-z0-9-]+\.webp$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  device: z.enum(['desktop', 'phone']),
})
export type Shot = z.infer<typeof Shot>

export const SHOTS: Record<string, Shot> = z.record(z.string(), Shot).parse(manifest)

/** A picture by its id, or null */
export const shotById = (id: string): Shot | null => SHOTS[id] ?? null
