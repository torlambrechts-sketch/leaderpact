import { z } from 'zod'
import type { Answers, ProfileTest } from '@/lib/profile/score'

/**
 * The Leader Profile on the person's device (handoff 6.17: "Save and resume"), in localStorage records of
 * its own. It shares no key with the scan (CLAUDE.md invariant 11): every key starts `leaderpact.profile.`.
 *
 * - **The draft**, one per test: the version answered, the answers by item id and the question on screen.
 *   It lasts 30 days from the last save, since the full test is 120 questions (D-32). A draft for another
 *   version is not resumed.
 * - **The finished test waiting for sign-in**: a visitor who keeps their result signs in by email, and the
 *   answers wait here until /app/me saves them through `save_profile`. It lasts 7 days, like the scan's save.
 *
 * Parsed, never trusted; an unreadable or expired record is removed. Storage can refuse; then the test
 * still works for the visit and simply does not resume.
 */
const DAY_MS = 86_400_000
export const DRAFT_DAYS = 30
export const PENDING_DAYS = 7
export const draftKey = (test: 'quick' | 'full') => `leaderpact.profile.draft.${test}`
export const PENDING_KEY = 'leaderpact.profile.pending'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const answers = z.record(z.string(), z.number().int().min(1).max(5))
const draftSchema = z.object({ v: z.literal(1), version: z.uuid(), answers, position: z.number().int().min(0), savedAt: z.iso.datetime() })
const pendingSchema = z.object({ v: z.literal(1), test: z.enum(['quick', 'full']), version: z.uuid(), answers, savedAt: z.iso.datetime() })

function read<T extends { savedAt: string }>(store: Store | null, key: string, schema: z.ZodType<T>, days: number, now: Date): T | null {
  if (!store) return null
  let value: T | null = null
  try {
    const raw = store.getItem(key)
    if (raw === null) return null
    const parsed = schema.safeParse(JSON.parse(raw))
    if (parsed.success) value = parsed.data
  } catch {
    value = null
  }
  const age = value ? now.getTime() - Date.parse(value.savedAt) : Infinity
  if (!value || !(age >= 0 && age <= days * DAY_MS)) {
    remove(store, key)
    return null
  }
  return value
}

function write(store: Store | null, key: string, value: unknown): boolean {
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function remove(store: Pick<Storage, 'removeItem'> | null, key: string): void {
  try {
    store?.removeItem(key)
  } catch {
    // storage that cannot be written holds nothing of ours
  }
}

export interface ProfileDraft {
  answers: Answers
  position: number
}

/** This test's draft for its published version, or null; answers for items the version does not ask are dropped */
export function readDraft(store: Store | null, test: Pick<ProfileTest, 'id' | 'key' | 'items'>, now: Date): ProfileDraft | null {
  const draft = read(store, draftKey(test.key), draftSchema, DRAFT_DAYS, now)
  if (!draft) return null
  if (draft.version !== test.id) {
    remove(store, draftKey(test.key))
    return null
  }
  const asked = new Set(test.items.map((i) => i.id))
  return { answers: Object.fromEntries(Object.entries(draft.answers).filter(([id]) => asked.has(id))), position: Math.min(draft.position, test.items.length - 1) }
}

export function writeDraft(store: Store | null, test: Pick<ProfileTest, 'id' | 'key'>, draft: ProfileDraft, now: Date): boolean {
  return write(store, draftKey(test.key), { v: 1, version: test.id, answers: draft.answers, position: draft.position, savedAt: now.toISOString() })
}

export interface PendingProfile {
  test: 'quick' | 'full'
  version: string
  answers: Answers
}

export function readPending(store: Store | null, now: Date): PendingProfile | null {
  const p = read(store, PENDING_KEY, pendingSchema, PENDING_DAYS, now)
  return p ? { test: p.test, version: p.version, answers: p.answers } : null
}

export function writePending(store: Store | null, pending: PendingProfile, now: Date): boolean {
  return write(store, PENDING_KEY, { v: 1, ...pending, savedAt: now.toISOString() })
}
