import { changeBetween, type Change } from '@/lib/scoring'
import type { Pulses } from '@/lib/pulses/schema'

/**
 * What the pulse pages work out from the readers (handoff 6.16 and 7), and nothing more: the change of a
 * question since the pulse that asked it last, how many agreements wait for the next pulse, and the choices a
 * rhythm may take. The levels, labels and standings are the snapshot's own (0020).
 */

/** A pulse row's change: none when no earlier pulse asked the same thing; else shown from the margin, or within */
export type PulseChange = Change | { kind: 'first' }

const tenths = (level: number) => Math.round(level * 10)

export function pulseChange(before: number | null, level: number, margin: number): PulseChange {
  if (before === null) return { kind: 'first' }
  return changeBetween(tenths(before), tenths(level), { changeMargin: margin })
}

/** The working agreements that did not fit the next pulse: they rotate into a later one (handoff 6.16) */
export function agreementsWaiting(p: Pick<Pulses, 'agreements' | 'next'>): number {
  return Math.max(0, p.agreements - p.next.filter((q) => q.source === 'agreement').length)
}

/** Every whole number from a setting's least to its most, for a choice */
export function choices(min: number, max: number): number[] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) return []
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

/** The windows a rhythm allows: within the setting, and closing before the next pulse is due (0020) */
export function windowsFor(weeks: number, min: number, max: number): number[] {
  return choices(min, max).filter((d) => d < weeks * 7)
}
