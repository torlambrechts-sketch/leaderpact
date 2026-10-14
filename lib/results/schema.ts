import { z } from 'zod'
import { READING_TYPES, STANDINGS, cutoffsSchema, type Cutoffs } from '@/lib/scoring'
import { LAYERS, type ScaleResult } from '@/lib/results/build'

/**
 * What the results' readers return (0007, 0016), parsed, never cast. A row carries exactly what a result may
 * show; `strictObject` refuses a row with anything more, so a reader that ever returned a spread or an
 * agreement number would fail here rather than reach a screen (handoff 7, What a result may show).
 */
export const resultRowSchema = z.strictObject({
  factor_key: z.string().min(1),
  factor_name: z.object({ en: z.string().min(1) }),
  layer: z.enum(LAYERS),
  reading_type: z.enum(READING_TYPES),
  evidence: z.enum(['strong', 'moderate', 'mixed', 'not_rated']).nullable(),
  ordinal: z.number().int().positive(),
  level: z.number().min(1).max(5),
  agreement: z.enum(['high', 'medium', 'low']),
  standing: z.enum(STANDINGS),
  n: z.number().int().min(4),
})

export const itemRowSchema = z.strictObject({
  item_code: z.string().min(1),
  item_text: z.object({ en: z.string().min(1) }),
  factor_key: z.string().min(1),
  level: z.number().min(1).max(5),
  n: z.number().int().min(4),
})

export const toScale = (r: z.infer<typeof resultRowSchema>): ScaleResult => ({
  key: r.factor_key,
  name: r.factor_name.en,
  layer: r.layer,
  readingType: r.reading_type,
  evidence: r.evidence,
  ordinal: r.ordinal,
  level: r.level,
  agreement: r.agreement,
  standing: r.standing,
  n: r.n,
})

/** A cut-off row as the table holds it (0003), in the rules' own names */
export const cutoffRowSchema = z
  .object({
    version: z.number(),
    agreement_high: z.number(),
    agreement_low: z.number(),
    higher_priority_below: z.number(),
    higher_strength_from: z.number(),
    lower_priority_from: z.number(),
    lower_strength_below: z.number(),
    change_margin: z.number(),
    valid_from: z.string(),
  })
  .transform((r) => ({
    validFrom: r.valid_from,
    cutoffs: cutoffsSchema.parse({
      version: r.version,
      agreementHigh: r.agreement_high,
      agreementLow: r.agreement_low,
      higherPriorityBelow: r.higher_priority_below,
      higherStrengthFrom: r.higher_strength_from,
      lowerPriorityFrom: r.lower_priority_from,
      lowerStrengthBelow: r.lower_strength_below,
      changeMargin: r.change_margin,
    }) as Cutoffs,
  }))

/** The cut-offs in force at a moment: the newest version that had started (app.cutoff_version, 0003) */
export function cutoffsAt(rows: readonly { validFrom: string; cutoffs: Cutoffs }[], at: string): Cutoffs | null {
  const t = Date.parse(at)
  const started = rows.filter((r) => Date.parse(r.validFrom) <= t).sort((a, b) => b.cutoffs.version - a.cutoffs.version)
  return started[0]?.cutoffs ?? null
}
