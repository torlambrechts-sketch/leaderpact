import type { AgendaItem } from '@/lib/meetings/schema'

/**
 * What the agenda works out from its items (handoff 6.14): the time check, the count of ready items, and what
 * an item still needs to be ready. Nothing here is stored.
 */

/** The time check: the items' minutes against the meeting's length */
export function timeCheck(items: readonly Pick<AgendaItem, 'minutes'>[], length: number) {
  const planned = items.reduce((sum, i) => sum + (i.minutes ?? 0), 0)
  const state = planned > length ? ('over' as const) : planned < length ? ('left' as const) : ('fits' as const)
  return { planned, length, state, difference: Math.abs(length - planned) }
}

export type Missing = 'type' | 'outcome' | 'owner' | 'minutes'

/** What an item needs before it is ready: a type, a desired outcome, an owner who is a member, and a time box */
export function missing(item: Pick<AgendaItem, 'type' | 'outcome' | 'owner' | 'owner_current' | 'minutes'>): Missing[] {
  const out: Missing[] = []
  if (!item.type) out.push('type')
  if (!item.outcome) out.push('outcome')
  if (!item.owner || !item.owner_current) out.push('owner')
  if (item.minutes === null) out.push('minutes')
  return out
}

/** Ready items out of total (handoff 6.14) */
export function readiness(items: readonly Pick<AgendaItem, 'ready'>[]) {
  return { ready: items.filter((i) => i.ready).length, total: items.length }
}

/** The meeting to show: the one asked for, else the next, else the most recent */
export function chosenMeeting<T extends { id: string; next: boolean }>(meetings: readonly T[], asked: string | undefined): T | null {
  return meetings.find((m) => m.id === asked) ?? meetings.find((m) => m.next) ?? meetings[0] ?? null
}
