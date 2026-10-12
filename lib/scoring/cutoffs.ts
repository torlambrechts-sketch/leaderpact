import { z } from 'zod'

/**
 * The cut-offs the scoring rules read (handoff section 7): two for agreement, four for standing and the
 * margin a change must reach. They are rows of data, versioned, and the pilot will reset them (handoff
 * sections 7 and 9; CLAUDE.md, Model as data). So no constant here holds a version's values: a caller
 * reads the row, parses it with `cutoffsSchema`, and a stored result keeps the version it was made with.
 *
 * Every rule compares in integers. An agreement cut-off is used in hundredths and a level cut-off or the
 * margin in tenths, so the schema refuses a value that is not a whole number of those: 0.705 would
 * otherwise be rounded to a different rule without anyone choosing it.
 */
export type Cutoffs = {
  version: number
  /** Agreement is high above this */
  agreementHigh: number
  /** Agreement is low at or below this */
  agreementLow: number
  /** Higher is better: priority below this */
  higherPriorityBelow: number
  /** Higher is better: strength from this */
  higherStrengthFrom: number
  /** Lower is better: priority from this */
  lowerPriorityFrom: number
  /** Lower is better: strength below this */
  lowerStrengthBelow: number
  /** A change shows from this many scale points */
  changeMargin: number
}

/** An agreement cut-off as integer hundredths: 0.70 is 70 */
export const cutoffHundredths = (value: number): number => Math.round(value * 100)

/** A level cut-off or the change margin as integer tenths: 3.4 is 34 */
export const cutoffTenths = (value: number): number => Math.round(value * 10)

/** True when `value` is a whole number of steps of 10^-places, allowing for its binary representation */
const inSteps = (places: number) => (value: number) => {
  const scaled = value * 10 ** places
  return Math.abs(scaled - Math.round(scaled)) < 1e-9
}

// the ranges are those of the table's check constraints, so a row the database holds parses here
const agreementCut = z.number().gt(0).lt(1).refine(inSteps(2), 'must be a whole number of hundredths')
const levelCut = z.number().gt(1).lt(5).refine(inSteps(1), 'must be a whole number of tenths')

export const cutoffsSchema = z
  .object({
    version: z.number().int().positive(),
    agreementHigh: agreementCut,
    agreementLow: agreementCut,
    higherPriorityBelow: levelCut,
    higherStrengthFrom: levelCut,
    lowerPriorityFrom: levelCut,
    lowerStrengthBelow: levelCut,
    changeMargin: z.number().gt(0).lt(4).refine(inSteps(1), 'must be a whole number of tenths'),
  })
  .superRefine((c, ctx) => {
    // compared as the rules use them, in integers
    if (cutoffHundredths(c.agreementLow) >= cutoffHundredths(c.agreementHigh)) {
      ctx.addIssue({ code: 'custom', path: ['agreementLow'], message: 'agreementLow must be below agreementHigh' })
    }
    if (cutoffTenths(c.higherPriorityBelow) >= cutoffTenths(c.higherStrengthFrom)) {
      ctx.addIssue({ code: 'custom', path: ['higherPriorityBelow'], message: 'higherPriorityBelow must be below higherStrengthFrom' })
    }
    if (cutoffTenths(c.lowerStrengthBelow) >= cutoffTenths(c.lowerPriorityFrom)) {
      ctx.addIssue({ code: 'custom', path: ['lowerStrengthBelow'], message: 'lowerStrengthBelow must be below lowerPriorityFrom' })
    }
  }) satisfies z.ZodType<Cutoffs>
