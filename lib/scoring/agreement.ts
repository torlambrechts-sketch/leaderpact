import { cutoffHundredths, type Cutoffs } from '@/lib/scoring/cutoffs'

/**
 * Agreement (handoff section 7, Agreement): a within-group agreement index, shown only as a label.
 *
 * value = max(0, 1 − variance / 2.0), where the variance is the sample variance (n − 1) of the
 * respondents' scale scores and 2.0 is the variance of a flat five-point distribution. The formula is
 * proposed and to be confirmed, so it lives here and in its SQL twin only.
 *
 * A person's score is p = s / items, with s the integer sum of their answers. Then, in integers,
 *   variance = num / den,  num = n · Σs² − (Σs)²,  den = items² · n · (n − 1)
 * and the label is decided by cross-multiplying, with the cut-offs in hundredths (H, L):
 *   high ⇔ value > H ⇔ 100 · num < 2 · (100 − H) · den
 *   low  ⇔ value ≤ L ⇔ 100 · num ≥ 2 · (100 − L) · den
 *   medium otherwise.
 * The floor at 0 never changes a label: a value below 0 is low either way. Identical answers give
 * num = 0, so high. Nothing floating decides a label.
 */
export type AgreementLabel = 'high' | 'medium' | 'low'

export const AGREEMENT_LABELS = ['high', 'medium', 'low'] as const satisfies readonly AgreementLabel[]

type Moments = { num: number; den: number }

/** The variance of person scores as an exact fraction, from each person's sum over `items` items */
function moments(personSums: readonly number[], items: number): Moments {
  if (!Number.isSafeInteger(items) || items < 1) throw new RangeError('a scale has at least one item')
  const n = personSums.length
  // a sample variance needs two; a result never has fewer than four (the threshold, CLAUDE.md invariant 1)
  if (n < 2) throw new RangeError('agreement needs at least two respondents')
  let sum = 0
  let squares = 0
  for (const s of personSums) {
    if (!Number.isInteger(s) || s < items || s > 5 * items) {
      throw new RangeError('a person sum lies between 1 and 5 times the number of items')
    }
    sum += s
    squares += s * s
  }
  const num = n * squares - sum * sum
  const den = items * items * n * (n - 1)
  if (!Number.isSafeInteger(100 * num) || !Number.isSafeInteger(200 * den)) {
    throw new RangeError('too many respondents to compare exactly')
  }
  return { num, den }
}

/** The agreement label from each person's sum over the scale's items */
export function agreementLabel(
  personSums: readonly number[],
  items: number,
  cutoffs: Pick<Cutoffs, 'agreementHigh' | 'agreementLow'>,
): AgreementLabel {
  const { num, den } = moments(personSums, items)
  const high = cutoffHundredths(cutoffs.agreementHigh)
  const low = cutoffHundredths(cutoffs.agreementLow)
  if (100 * num < 2 * (100 - high) * den) return 'high'
  if (100 * num >= 2 * (100 - low) * den) return 'low'
  return 'medium'
}

/**
 * The agreement value itself, for the record a result stores. It is never shown: handoff section 7 forbids
 * showing the agreement number, because with 4 to 7 answers it points at a person. It never decides the
 * label either; `agreementLabel` does that exactly.
 */
export function agreementValue(personSums: readonly number[], items: number): number {
  const { num, den } = moments(personSums, items)
  return Math.max(0, 1 - num / (2 * den))
}
