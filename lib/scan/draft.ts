import { z } from 'zod'
import { answerSchema, type Answers, type Scan } from '@/lib/scan/model'

/**
 * The scan's answers on the visitor's device (handoff 6.2): they stay here until the last question, and
 * an abandoned scan resumes on the same device for 7 days. Nothing is sent anywhere until the person
 * submits: the leader's answers reach the database only when their group exists (D-15), a member's when
 * they press "Submit anonymously" on the group's link (handoff 6.5). Each link keeps its own record.
 *
 * - **One record, in localStorage**, under one key: the version answered, the answers by item id, the
 *   question on screen and when it was last saved.
 * - **Seven days from the last save.** An older record is removed when it is read, so an abandoned scan
 *   does not wait on the device for ever.
 * - **Another version is not resumed.** If the published scan changes, the old answers are for other
 *   questions, so the record is removed and the scan starts again.
 * - **Parsed, never trusted.** The record is the visitor's own storage, so it is parsed like any input;
 *   an answer for an item the version does not ask is dropped.
 * - **Storage can refuse.** A private window, a full quota or blocked site data throw on access; then the
 *   scan still works for the visit and simply does not resume.
 */
export const DRAFT_KEY = 'leaderpact.scan'
/** A member's draft for one group's scan, opened from its invite link (handoff 6.5): one record per link */
export const joinDraftKey = (code: string) => `leaderpact.join.${code}`
export const DRAFT_DAYS = 7
const DAY_MS = 86_400_000

const draftSchema = z.object({
  v: z.literal(1),
  version: z.uuid(),
  answers: z.record(z.string(), answerSchema),
  position: z.number().int().min(0),
  savedAt: z.iso.datetime(),
})

export interface Draft {
  answers: Answers
  /** the question on screen, 0-based */
  position: number
}

type ReadStore = Pick<Storage, 'getItem' | 'removeItem'>
type WriteStore = Pick<Storage, 'setItem'>

/** The saved draft for this version of the scan, or null: none, unreadable, expired or for another version */
export function readDraft(store: ReadStore | null, scan: Scan, now: Date, key: string = DRAFT_KEY): Draft | null {
  if (!store) return null
  let raw: string | null
  try {
    raw = store.getItem(key)
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: z.infer<typeof draftSchema> | null = null
  try {
    const result = draftSchema.safeParse(JSON.parse(raw))
    if (result.success) parsed = result.data
  } catch {
    parsed = null
  }
  const age = parsed ? now.getTime() - Date.parse(parsed.savedAt) : Infinity
  if (!parsed || parsed.version !== scan.versionId || !(age >= 0 && age <= DRAFT_DAYS * DAY_MS)) {
    forget(store, key)
    return null
  }

  const asked = new Set(scan.items.map((item) => item.id))
  const answers = Object.fromEntries(Object.entries(parsed.answers).filter(([id]) => asked.has(id)))
  return { answers, position: Math.min(parsed.position, scan.items.length - 1) }
}

/** Saves the draft; false when the device refuses (the scan goes on without resuming) */
export function writeDraft(store: WriteStore | null, scan: Scan, draft: Draft, now: Date, key: string = DRAFT_KEY): boolean {
  if (!store) return false
  const record = { v: 1 as const, version: scan.versionId, answers: draft.answers, position: draft.position, savedAt: now.toISOString() }
  try {
    store.setItem(key, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

export function forget(store: Pick<Storage, 'removeItem'> | null, key: string = DRAFT_KEY): void {
  try {
    store?.removeItem(key)
  } catch {
    // nothing to do: storage that cannot be written holds nothing of ours
  }
}

/** window.localStorage, or null where reading it throws (blocked site data) or there is no window */
export function deviceStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
