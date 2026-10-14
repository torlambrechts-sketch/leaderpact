import type { Live, LiveItem } from '@/lib/live/schema'

/**
 * What the live page works out (handoff 6.15): the current item's clock, and whether the page may change
 * anything. The server's clock rules: the page keeps the offset between its own and the server's.
 */

/** The current item's time box and the time it has run, in seconds, at a moment on the server's clock */
export function clock(item: Pick<LiveItem, 'minutes' | 'extra' | 'elapsed'>, startedAt: string | null, serverNow: number) {
  const box = ((item.minutes ?? 0) + item.extra) * 60
  const running = startedAt === null ? 0 : Math.max(0, Math.floor((serverNow - Date.parse(startedAt)) / 1000))
  const spent = item.elapsed + running
  return { box, spent, left: box - spent, over: spent > box, running: startedAt !== null }
}

/** Minutes and seconds, as a clock shows them: 7:05, or 0:00 */
export function mmss(seconds: number) {
  const s = Math.abs(Math.trunc(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Whether the page may change anything. With sync on it is read-only until Realtime has joined, and again
 * whenever the connection drops (handoff 6.15). With sync off (the live_meeting flag) it runs without
 * Realtime: changes save, and others see them when they reload.
 */
export type Connection = 'joining' | 'joined' | 'lost' | 'off'
export function connection(sync: boolean, status: string | null): Connection {
  if (!sync) return 'off'
  if (status === 'SUBSCRIBED') return 'joined'
  if (status === null) return 'joining'
  return 'lost'
}

export function writable(c: Connection) {
  return c === 'joined' || c === 'off'
}

/** The item being discussed, if any */
export function currentItem(live: Pick<Live, 'items' | 'current'>) {
  return live.items.find((i) => i.id === live.current) ?? null
}

/** A due date in words, British English: 13 November 2026 */
export function dayWords(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
}
