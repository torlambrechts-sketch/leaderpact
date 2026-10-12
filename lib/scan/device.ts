import { z } from 'zod'
import { codeSchema, replaceKeySchema } from '@/lib/scan/link'

/**
 * What the device keeps beside the scan's draft (lib/scan/draft.ts), each in its own localStorage record,
 * parsed when read and dropped when unreadable. Storage can refuse; then each function says so and the
 * page goes on without it.
 *
 * - **The save** (handoff 6.3): the group name and size the leader typed on the save card, with a random
 *   request id, kept across the email sign-in so the group is made when they come back on this device.
 *   It holds no answer and no address. It lasts 7 days, like the draft.
 * - **The replace key** (handoff 6.5, owner C2): one per invite link, so a second submission from this
 *   browser replaces the first until the scan closes. It is a random token, not a person id; the
 *   database keeps only its hash.
 */
const DAY_MS = 86_400_000
export const SAVE_KEY = 'leaderpact.save'
export const SAVE_DAYS = 7
export const replaceStoreKey = (code: string) => `leaderpact.replace.${code}`

export const saveSchema = z.object({
  v: z.literal(1),
  name: z.string().trim().min(1).max(120),
  size: z.number().int().min(4).max(15),
  request: z.uuid(),
  savedAt: z.iso.datetime(),
})
export type PendingSave = Omit<z.infer<typeof saveSchema>, 'v' | 'savedAt'>

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function read<T>(store: Store | null, key: string, schema: z.ZodType<T>): T | null {
  if (!store) return null
  try {
    const raw = store.getItem(key)
    if (raw === null) return null
    const parsed = schema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // unreadable: dropped below
  }
  remove(store, key)
  return null
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

function remove(store: Pick<Storage, 'removeItem'> | null, key: string): void {
  try {
    store?.removeItem(key)
  } catch {
    // storage that cannot be written holds nothing of ours
  }
}

/** The save card's group, or null: none, unreadable or older than 7 days */
export function readSave(store: Store | null, now: Date): PendingSave | null {
  const save = read(store, SAVE_KEY, saveSchema)
  if (!save) return null
  const age = now.getTime() - Date.parse(save.savedAt)
  if (!(age >= 0 && age <= SAVE_DAYS * DAY_MS)) {
    remove(store, SAVE_KEY)
    return null
  }
  return { name: save.name, size: save.size, request: save.request }
}

export function writeSave(store: Store | null, save: PendingSave, now: Date): boolean {
  return write(store, SAVE_KEY, { v: 1, ...save, savedAt: now.toISOString() })
}

export function forgetSave(store: Store | null): void {
  remove(store, SAVE_KEY)
}

const replaceSchema = z.object({ v: z.literal(1), key: replaceKeySchema })

/** This browser's replace key for a link, or null */
export function readReplaceKey(store: Store | null, code: string): string | null {
  if (!codeSchema.safeParse(code).success) return null
  return read(store, replaceStoreKey(code), replaceSchema)?.key ?? null
}

/** Keeps the key a submission returned; a null key (the scan closed with it) removes the old one */
export function writeReplaceKey(store: Store | null, code: string, key: string | null): boolean {
  if (!codeSchema.safeParse(code).success) return false
  if (key === null) {
    remove(store, replaceStoreKey(code))
    return true
  }
  return write(store, replaceStoreKey(code), { v: 1, key })
}
