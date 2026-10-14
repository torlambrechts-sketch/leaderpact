import { z } from 'zod'
import { READING_TYPES, STANDINGS } from '@/lib/scoring'
import { LAYERS } from '@/lib/results/build'

/**
 * Pulses as they cross the server boundary (handoff 6.16; 0020): the rhythm and the next pulse's questions
 * that the Assess page reads, a released pulse's result, and what starting, changing and stopping the rhythm
 * send. The database checks everything again.
 */
export const SOURCES = ['focus', 'agreement', 'rotating'] as const
export type Source = (typeof SOURCES)[number]

export const pulsesSchema = z.object({
  running: z.boolean(),
  next_at: z.string().nullable(),
  weeks: z.number().int().positive(),
  days: z.number().int().positive(),
  weeks_min: z.number().int().positive(),
  weeks_max: z.number().int().positive(),
  days_min: z.number().int().positive(),
  days_max: z.number().int().positive(),
  max_questions: z.number().int().positive(),
  max_rotating: z.number().int().min(0),
  wording_confirmed: z.boolean(),
  // what the next pulse would ask if it opened now, in the order it is built
  next: z.array(z.object({ source: z.enum(SOURCES), text: z.string().trim().min(1), scale: z.string().min(1).nullable() })),
  focus: z.number().int().min(0),
  agreements: z.number().int().min(0),
  leader: z.boolean(),
  can_manage: z.boolean(),
})
export type Pulses = z.infer<typeof pulsesSchema>

const level = z.number().min(1).max(5)

/**
 * A released pulse's result (`get_pulse_result`). Each row carries exactly what a result may show: a level
 * to one decimal, an agreement label and a standing, and the level the same question had in the pulse that
 * asked it last, for change. `strictObject` refuses a row with anything more (handoff 7).
 */
export const pulseResultSchema = z.object({
  round: z.uuid(),
  team: z.uuid(),
  number: z.number().int().positive(),
  opens_at: z.string(),
  closes_at: z.string(),
  k: z.number().int().min(4).max(8),
  invited: z.number().int().min(0),
  answered: z.number().int().min(0),
  margin: z.number().positive(),
  scales: z.array(
    z.strictObject({
      key: z.string().min(1),
      name: z.string().min(1),
      layer: z.enum(LAYERS),
      reading_type: z.enum(READING_TYPES),
      evidence: z.enum(['strong', 'moderate', 'mixed', 'not_rated']).nullable(),
      level,
      agreement: z.enum(['high', 'medium', 'low']),
      standing: z.enum(STANDINGS),
      before: level.nullable(),
    }),
  ),
  agreements: z.array(z.strictObject({ text: z.string().min(1), level, before: level.nullable() })),
  items: z.array(z.strictObject({ text: z.string().min(1), scale: z.string().min(1), source: z.enum(['focus', 'rotating']), level })),
})
export type PulseResult = z.infer<typeof pulseResultSchema>

export const rhythmSchema = z.strictObject({
  group: z.uuid(),
  weeks: z.number().int().min(1).max(52),
  days: z.number().int().min(1).max(30),
})
export const stopSchema = z.strictObject({ group: z.uuid() })

export const PULSE_REASONS = ['signed_out', 'not_leader', 'unavailable', 'invalid', 'already', 'open_round', 'too_few', 'not_running'] as const
export type PulseReason = (typeof PULSE_REASONS)[number] | 'failed'

/** The rhythm's writes answer {ok} (with the round, for a start) or a reason; for too few, the members and the threshold */
export const pulseReplySchema = z.union([
  z.strictObject({ ok: z.literal(true), round: z.uuid().optional() }),
  z.strictObject({ ok: z.literal(false), reason: z.enum(PULSE_REASONS), members: z.number().int().optional(), k: z.number().int().optional() }),
])
export type PulseActionResult = { ok: true } | { ok: false; reason: PulseReason; members?: number; k?: number }
