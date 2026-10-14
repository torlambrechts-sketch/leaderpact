import { z } from 'zod'

/**
 * The diagnostic round as it crosses the server boundary (handoff 6.10 and 6.11; 0015): what the Assess page
 * and the questionnaire read, and what opening a round and submitting answers send. The database checks
 * everything again.
 */
export const PHASES = ['scheduled', 'answering', 'closed', 'released'] as const
export type Phase = (typeof PHASES)[number]

export const roundSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['diagnostic', 'pulse']),
  number: z.number().int().positive(),
  phase: z.enum(PHASES),
  opens_at: z.string(),
  closes_at: z.string().nullable(),
  extended: z.boolean(),
  invited: z.number().int().min(0).nullable(),
  // the threshold the round froze when it opened (CLAUDE.md invariant 1)
  k: z.number().int().min(4).max(8).nullable(),
  // a count, never who; null for a round that asked fewer than its threshold
  answered: z.number().int().min(0).nullable(),
  // the caller's own, while the round is open
  me: z.enum(['to_answer', 'answered']).nullable(),
})
export type Round = z.infer<typeof roundSchema>

export const roundsSchema = z.object({
  rounds: z.array(roundSchema),
  members: z.number().int().min(0),
  k: z.number().int().min(4).max(8),
  window_days: z.number().int().positive(),
  questions: z.number().int().min(0),
  leader: z.boolean(),
  can_open: z.boolean(),
})
export type Rounds = z.infer<typeof roundsSchema>

export const FORM_STATES = ['open', 'answered', 'closed', 'not_invited'] as const
export type FormState = (typeof FORM_STATES)[number]

export const formSchema = z.object({
  round: z.uuid(),
  kind: z.enum(['diagnostic', 'pulse']),
  team: z.uuid(),
  group: z.string().min(1),
  k: z.number().int().min(4).max(8).nullable(),
  closes_at: z.string().nullable(),
  state: z.enum(FORM_STATES),
  version: z.uuid(),
  items: z.array(z.object({ id: z.uuid(), text: z.string().trim().min(1) })).nullable(),
})
export type RoundForm = z.infer<typeof formSchema>

export const groupSchema = z.object({ group: z.uuid() })

/** One submission: every question of the round with its answer (owner C8: none may be skipped) */
export const submitSchema = z.object({
  round: z.uuid(),
  answers: z.array(z.object({ item: z.uuid(), value: z.number().int().min(1).max(5) })).min(1).max(72),
})

export const OPEN_REASONS = ['signed_out', 'not_leader', 'unavailable', 'open_round', 'too_few'] as const
export type OpenReason = (typeof OPEN_REASONS)[number] | 'invalid' | 'failed'

/** open_diagnostic's answer: the round's id, or a reason; for too few, the members and the threshold */
export const openReplySchema = z.union([
  z.strictObject({ ok: z.literal(true), round: z.uuid(), invited: z.number().int().min(0) }),
  z.strictObject({ ok: z.literal(false), reason: z.enum(OPEN_REASONS), members: z.number().int().optional(), k: z.number().int().optional() }),
])
export type OpenResult = { ok: true; round: string } | { ok: false; reason: OpenReason; members?: number; k?: number }

export const SUBMIT_REASONS = ['not_invited', 'closed', 'already_answered', 'invalid'] as const
export type SubmitReason = (typeof SUBMIT_REASONS)[number] | 'failed'

/**
 * submit_response's answer: {ok} or a reason; never an id (CLAUDE.md invariant 4). Strict, so a reply
 * carrying anything more is refused rather than passed on.
 */
export const submitReplySchema = z.union([
  z.strictObject({ ok: z.literal(true) }),
  z.strictObject({ ok: z.literal(false), reason: z.enum(SUBMIT_REASONS) }),
])
export type SubmitResult = { ok: true } | { ok: false; reason: SubmitReason }
