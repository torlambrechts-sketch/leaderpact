import { cutoffTenths, type Cutoffs } from '@/lib/scoring/cutoffs'

/**
 * Change (handoff section 7, Change): the difference between two shown levels, in tenths. It shows only
 * when it is at least the margin (0.6 scale points in version 1); a smaller one reads "within normal
 * variation". 0.5 is within, 0.6 and −0.6 show.
 *
 * The comparison is in integer tenths. In floating point 3.8 − 3.2 is 0.5999999999999996, which would hide
 * a change the rule shows.
 *
 * The caller decides whether two levels may be compared at all: only two closed rounds of the same
 * instrument, and never a scan theme against a diagnostic scale, which are different measures.
 */
export type Change = { kind: 'shown'; deltaTenths: number } | { kind: 'within' }

/** The change from one shown level to another, both in tenths */
export function changeBetween(fromTenths: number, toTenths: number, cutoffs: Pick<Cutoffs, 'changeMargin'>): Change {
  for (const tenths of [fromTenths, toTenths]) {
    if (!Number.isInteger(tenths) || tenths < 10 || tenths > 50) {
      throw new RangeError('a shown level is in tenths, from 10 to 50')
    }
  }
  const deltaTenths = toTenths - fromTenths
  return Math.abs(deltaTenths) >= cutoffTenths(cutoffs.changeMargin) ? { kind: 'shown', deltaTenths } : { kind: 'within' }
}
