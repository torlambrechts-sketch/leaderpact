/**
 * The Leader Profile's scoring (handoff 6.17 and 7), pure, for the device: the person sees their result
 * before anything is sent, and `app.save_profile` computes the same sums in SQL from the same answers
 * (0011; supabase/tests/profile_invariants.sql holds the cases both must give).
 *
 * - **A trait's sum** is the sum of its keyed answers: an answer as given on a plus-keyed item, 6 minus the
 *   answer on a minus-keyed one (the published keys). A facet's answers count for its domain too.
 * - **A band** compares the mean with the band set's limits in integers of hundredths: below the lower
 *   limit is lower, above the higher limit is higher, the rest middle (D-31). 56 over 24 items is exactly
 *   7/3, which is middle, in floating point and here alike.
 * - **No norm group is used** (handoff 9): the band is a position on the answer scale. Never good or bad.
 */
export type Band = 'lower' | 'middle' | 'higher'
export const BANDS = ['lower', 'middle', 'higher'] as const satisfies readonly Band[]

export interface BandSet {
  version: number
  lowerBelow: number
  higherAbove: number
}

export interface ProfileTrait {
  key: string
  kind: 'domain' | 'facet'
  domain: string
  name: string
  ordinal: number
}

export interface ProfileItem {
  id: string
  ordinal: number
  text: string
  trait: string
  keyed: 1 | -1
}

export interface ProfileTest {
  /** the published version's id: a draft for another version is not resumed */
  id: string
  key: 'quick' | 'full'
  version: number
  name: string
  traits: ProfileTrait[]
  items: ProfileItem[]
}

export type Sums = Record<string, { sum: number; n: number }>
export type Answers = Record<string, number>

const hundredths = (value: number) => Math.round(value * 100)

/** Every trait's sum and count from a full set of answers; throws on a missing or impossible answer */
export function traitSums(test: Pick<ProfileTest, 'traits' | 'items'>, answers: Answers): Sums {
  const domainOf = new Map(test.traits.map((t) => [t.key, t.domain]))
  const sums: Sums = {}
  const add = (key: string, v: number) => {
    const s = (sums[key] ??= { sum: 0, n: 0 })
    s.sum += v
    s.n += 1
  }
  for (const item of test.items) {
    const answer = answers[item.id]
    if (answer === undefined || !Number.isInteger(answer) || answer < 1 || answer > 5) throw new RangeError(`item ${item.ordinal} has no answer from 1 to 5`)
    const v = item.keyed === 1 ? answer : 6 - answer
    add(item.trait, v)
    const domain = domainOf.get(item.trait)
    if (domain === undefined) throw new RangeError(`item ${item.ordinal} scores no trait`)
    if (domain !== item.trait) add(domain, v)
  }
  return sums
}

/** Lower, middle or higher for a sum over n items, by a band set (D-31) */
export function band(sum: number, n: number, set: Pick<BandSet, 'lowerBelow' | 'higherAbove'>): Band {
  if (!Number.isInteger(sum) || !Number.isInteger(n) || n < 1 || sum < n || sum > 5 * n) throw new RangeError('a sum of n answers from 1 to 5')
  if (sum * 100 < hundredths(set.lowerBelow) * n) return 'lower'
  if (sum * 100 > hundredths(set.higherAbove) * n) return 'higher'
  return 'middle'
}

/** Where the mean sits on the answer scale, from 0 (all 1s) to 1 (all 5s): the dot on the bar */
export const position = (sum: number, n: number): number => Math.max(0, Math.min(1, (sum / n - 1) / 4))

export function isComplete(test: Pick<ProfileTest, 'items'>, answers: Answers): boolean {
  return test.items.every((item) => answers[item.id] !== undefined)
}

export function firstUnanswered(test: Pick<ProfileTest, 'items'>, answers: Answers): number {
  const i = test.items.findIndex((item) => answers[item.id] === undefined)
  return i === -1 ? 0 : i
}
