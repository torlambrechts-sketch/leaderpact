import { z } from 'zod'
import { changeBetween, cutoffsSchema, standingFor, type Change, type Cutoffs, type ReadingType, type Standing } from '@/lib/scoring'
import type { Sample } from '@/lib/sample/schema'

/**
 * The sample Results overview (handoff 6.12 and section 7), built from the sample's levels and agreement
 * labels and the model's own rows: each scale's name, layer, reading type and evidence rating from the
 * bank (data/instrument/bank.v1.json, the file the seed loads), and the cut-offs of version 1. Standing
 * and change come from lib/scoring, the same rules a real result uses. Nothing here is a real result.
 */
export const LAYERS = ['outcomes', 'conditions', 'processes', 'states'] as const
export type Layer = (typeof LAYERS)[number]

const factorSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  layer: z.enum(LAYERS),
  readingType: z.enum(['higher', 'lower', 'descriptive', 'conditional']),
  evidence: z.enum(['strong', 'moderate', 'mixed', 'not_rated']).nullable(),
  ordinal: z.number().int(),
})
export const bankFactorsSchema = z.object({ factors: z.array(factorSchema).min(1) })
export type Factor = z.infer<typeof factorSchema>

export interface SampleScaleRow {
  key: string
  name: string
  readingType: ReadingType
  /** null is an outcome: self-rated, no evidence rating */
  evidence: Factor['evidence']
  levelTenths: number
  agreement: 'high' | 'medium' | 'low'
  standing: Standing
  change: Change
}

const tenths = (level: number) => Math.round(level * 10)

/** The overview's rows by layer, outcomes first (handoff 6.12), each layer in the bank's order */
export function sampleResults(sample: Sample['results'], factors: readonly Factor[], cutoffs: Cutoffs): Record<Layer, SampleScaleRow[]> {
  const byKey = new Map(factors.map((f) => [f.key, f]))
  const out: Record<Layer, SampleScaleRow[]> = { outcomes: [], conditions: [], processes: [], states: [] }
  for (const s of sample.scales) {
    const f = byKey.get(s.key)
    if (!f) throw new Error(`sample: no scale ${s.key}`)
    const levelTenths = tenths(s.level)
    out[f.layer].push({
      key: f.key,
      name: f.name,
      readingType: f.readingType,
      evidence: f.evidence,
      levelTenths,
      agreement: s.agreement,
      standing: standingFor(f.readingType, levelTenths, s.agreement, cutoffs),
      change: changeBetween(tenths(s.previous), levelTenths, cutoffs),
    })
  }
  for (const layer of LAYERS) out[layer].sort((a, b) => byKey.get(a.key)!.ordinal - byKey.get(b.key)!.ordinal)
  return out
}

/** The cut-offs of a version, from the rows the seed loads */
export function cutoffsVersion(rows: unknown, version: number): Cutoffs {
  const row = z.array(z.looseObject({ version: z.number() })).parse(rows).find((r) => r.version === version)
  if (!row) throw new Error(`no cut-offs version ${version}`)
  return cutoffsSchema.parse(row)
}
