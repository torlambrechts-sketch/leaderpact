import { z } from 'zod'

/**
 * What crosses the person's own settings at the server boundary (handoff 6.18; 0022, 0023), shared with the
 * screens that send it. The database checks each value again: a summary frequency it knows, a time zone
 * Postgres knows.
 */
export const SUMMARIES = ['weekly', 'monthly', 'off'] as const
export type Summary = (typeof SUMMARIES)[number]

/** An IANA zone name as Intl and Postgres spell it ("Europe/Oslo", "UTC"); null for none */
export const timeZoneSchema = z.string().max(64).regex(/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/)

export const notificationsSchema = z.strictObject({ summary: z.enum(SUMMARIES), timeZone: timeZoneSchema.nullable() })
export const deleteAccountSchema = z.strictObject({ confirm: z.literal('delete') })

export const notificationsRowSchema = z.object({ email: z.string().nullable(), summary: z.enum(SUMMARIES), time_zone: z.string().nullable() })

export const setReplySchema = z.union([z.object({ ok: z.literal(true) }), z.object({ ok: z.literal(false), reason: z.enum(['signed_out', 'invalid']) })])

export const exportReplySchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.literal('signed_out') }),
  z.object({ ok: z.literal(false), reason: z.literal('too_many'), retry: z.number().int().positive() }),
])

export const deleteReplySchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.literal('signed_out') }),
  z.object({ ok: z.literal(false), reason: z.literal('sole_leader'), groups: z.array(z.string()).min(1) }),
])

export type SettingsResult = { ok: true } | { ok: false; reason: 'signed_out' | 'invalid' | 'failed' }
export type DeleteResult = { ok: false; reason: 'signed_out' | 'invalid' | 'failed' } | { ok: false; reason: 'sole_leader'; groups: string[] }
/** The export route's answer: 200 {ok}, 429 {retry} in seconds, or 401 / 500 */
export type ExportResult = { ok: true } | { ok: false; reason: 'signed_out' | 'failed' } | { ok: false; reason: 'too_many'; retry: number }
