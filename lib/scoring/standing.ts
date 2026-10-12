import type { AgreementLabel } from '@/lib/scoring/agreement'
import { cutoffTenths, type Cutoffs } from '@/lib/scoring/cutoffs'

/**
 * Standing (handoff section 7, Standing): every scale shows one, in words. It reads the scale's reading
 * type (Appendix A), the level as shown, at one decimal, and the agreement label, in this order:
 *
 *   1. a descriptive scale is a fact, with no target;
 *   2. a conditional scale (task conflict) is read with relationship conflict;
 *   3. low agreement is "views differ";
 *   4. otherwise the table:
 *
 *   | Reading type     | Priority          | Watch      | Strength          |
 *   | Higher is better | below 3.0         | 3.0 to 3.3 | 3.4 or above      |
 *   | Lower is better  | 3.5 or above      | 2.8 to 3.4 | below 2.8         |
 *
 * The numbers in the table are cut-offs of version 1; the function reads them from the row it is given.
 * The level is integer tenths and each cut-off is compared in tenths, so 2.9 is below 3.0 exactly.
 */
export type ReadingType = 'higher' | 'lower' | 'descriptive' | 'conditional'

export type Standing = 'priority' | 'watch' | 'strength' | 'views_differ' | 'fact' | 'read_with'

export const READING_TYPES = ['higher', 'lower', 'descriptive', 'conditional'] as const satisfies readonly ReadingType[]

export const STANDINGS = ['priority', 'watch', 'strength', 'views_differ', 'fact', 'read_with'] as const satisfies readonly Standing[]

type StandingCutoffs = Pick<Cutoffs, 'higherPriorityBelow' | 'higherStrengthFrom' | 'lowerPriorityFrom' | 'lowerStrengthBelow'>

/** A scale's standing from its reading type, its shown level in tenths and its agreement label */
export function standingFor(
  readingType: ReadingType,
  levelTenths: number,
  agreement: AgreementLabel,
  cutoffs: StandingCutoffs,
): Standing {
  if (!Number.isInteger(levelTenths) || levelTenths < 10 || levelTenths > 50) {
    throw new RangeError('a shown level is in tenths, from 10 to 50')
  }
  if (readingType === 'descriptive') return 'fact'
  if (readingType === 'conditional') return 'read_with'
  if (agreement === 'low') return 'views_differ'
  if (readingType === 'higher') {
    if (levelTenths < cutoffTenths(cutoffs.higherPriorityBelow)) return 'priority'
    if (levelTenths >= cutoffTenths(cutoffs.higherStrengthFrom)) return 'strength'
    return 'watch'
  }
  if (levelTenths >= cutoffTenths(cutoffs.lowerPriorityFrom)) return 'priority'
  if (levelTenths < cutoffTenths(cutoffs.lowerStrengthBelow)) return 'strength'
  return 'watch'
}
