import { z } from 'zod'
import { tokenSchema } from '@/lib/group/schema'

/**
 * An invitation waiting for its sign-in, on the person's device: the invitation page keeps the link's token
 * here when it sends the sign-in link, and after sign-in /app/new sends the person back to that page, which
 * joins them. It lasts a day; the sign-in link itself lasts 15 minutes. Its key, `leaderpact.invitation.`,
 * is apart from the scan's (`leaderpact.scan`, `leaderpact.join.`) and the profile's. Parsed, never trusted.
 */
const DAY_MS = 86_400_000
export const JOIN_KEY = 'leaderpact.invitation.pending'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const pendingSchema = z.object({ v: z.literal(1), token: tokenSchema, savedAt: z.iso.datetime() })

export function readPendingJoin(store: Store | null, now: Date): string | null {
  if (!store) return null
  try {
    const raw = store.getItem(JOIN_KEY)
    if (raw === null) return null
    const parsed = pendingSchema.safeParse(JSON.parse(raw))
    const age = parsed.success ? now.getTime() - Date.parse(parsed.data.savedAt) : Infinity
    if (parsed.success && age >= 0 && age <= DAY_MS) return parsed.data.token
  } catch {
    // unreadable: removed below
  }
  forgetPendingJoin(store)
  return null
}

export function writePendingJoin(store: Store | null, token: string, now: Date): boolean {
  if (!store || !tokenSchema.safeParse(token).success) return false
  try {
    store.setItem(JOIN_KEY, JSON.stringify({ v: 1, token, savedAt: now.toISOString() }))
    return true
  } catch {
    return false
  }
}

export function forgetPendingJoin(store: Pick<Storage, 'removeItem'> | null): void {
  try {
    store?.removeItem(JOIN_KEY)
  } catch {
    // storage refused: nothing to remove
  }
}
