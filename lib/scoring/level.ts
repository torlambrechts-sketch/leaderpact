/**
 * Level (handoff section 7, Level): how much of what a scale measures the group reports.
 *
 * A person's scale score is the mean of the scale's items: three core items for a diagnostic scale, two
 * for a scan theme. The level is the mean of those across respondents, shown to one decimal. Every
 * respondent answers every item, so the level is the sum of all answers over items × respondents.
 *
 * It is worked out in integers and rounded half up to integer tenths (39 is 3.9). No floating-point
 * division decides the digit shown: a float mean of person means can put 3.75 at 3.7499999999999996, and
 * `(4.35).toFixed(1)` writes 4.3; here they are 3.8 and 4.4. A shown level travels as tenths from here
 * on, and standing and change compare tenths (standing.ts, change.ts).
 *
 * The SQL side computes the same numbers; `cases.json` holds the cases both must agree on.
 */

/** Throws unless every answer is an integer from 1 to 5 (handoff section 7, Answer format) */
function checkAnswers(answers: readonly number[]): void {
  for (const answer of answers) {
    if (!Number.isInteger(answer) || answer < 1 || answer > 5) {
      throw new RangeError('an answer is an integer from 1 to 5')
    }
  }
}

/** One person's answers to a scale's items, added up: the integer the person's score is that over the items */
export function personSum(answers: readonly number[]): number {
  if (answers.length === 0) throw new RangeError('a person answers at least one item')
  checkAnswers(answers)
  return answers.reduce((total, answer) => total + answer, 0)
}

/**
 * The mean of `count` answers that add up to `total`, rounded half up to integer tenths:
 * floor((20 · total + count) / (2 · count)), in integers.
 */
export function levelTenths(total: number, count: number): number {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError('a level needs at least one answer')
  if (!Number.isSafeInteger(total) || total < count || total > 5 * count) {
    throw new RangeError('a total of answers lies between 1 and 5 times their count')
  }
  const numerator = 20 * total + count
  const denominator = 2 * count
  if (!Number.isSafeInteger(numerator)) throw new RangeError('too many answers to add up exactly')
  return (numerator - (numerator % denominator)) / denominator
}

/**
 * A scale's level from each respondent's answers to its items (one inner array per person, all the same
 * length), in tenths.
 */
export function scaleLevel(persons: readonly (readonly number[])[]): number {
  const first = persons[0]
  if (!first) throw new RangeError('a level needs at least one respondent')
  const items = first.length
  let total = 0
  for (const answers of persons) {
    if (answers.length !== items) throw new RangeError('every respondent answers the same items')
    total += personSum(answers)
  }
  return levelTenths(total, items * persons.length)
}

/** An item's level from every respondent's answer to it, in tenths */
export function itemLevel(answers: readonly number[]): number {
  return levelTenths(personSum(answers), answers.length)
}

/**
 * One person's own score on a scale or scan theme, as their personal view shows it: the mean of their
 * answers to its items, in tenths. A scan theme has two items, so this is (a + b) / 2. It is indicative
 * (handoff section 7).
 */
export function personLevel(answers: readonly number[]): number {
  return levelTenths(personSum(answers), answers.length)
}

/**
 * Integer tenths written with one decimal: 39 is "3.9", -6 is "-0.6". A negative value (a change) takes
 * an ASCII hyphen-minus, as PostgreSQL writes a numeric; a screen chooses its own minus sign.
 */
export function formatTenths(tenths: number): string {
  if (!Number.isSafeInteger(tenths)) throw new RangeError('tenths are an integer')
  const size = Math.abs(tenths)
  return `${tenths < 0 ? '-' : ''}${Math.floor(size / 10)}.${size % 10}`
}

/** A value written with exactly one decimal, such as "3.9" or "-0.6", as integer tenths */
export function parseTenths(text: string): number {
  const match = /^(-?)(\d+)\.(\d)$/.exec(text)
  if (!match) throw new RangeError('a shown level has exactly one decimal')
  const tenths = Number(match[2]) * 10 + Number(match[3])
  return match[1] && tenths !== 0 ? -tenths : tenths
}
