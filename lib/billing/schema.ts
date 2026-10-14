import { z } from 'zod'

/**
 * What crosses the billing boundary (CLAUDE.md: Zod at every server boundary), shared with the checkout
 * that sends it. The database checks everything again (0013).
 */
export const INTERVALS = ['year', 'month'] as const
export const METHODS = ['card', 'invoice'] as const
export type Interval = (typeof INTERVALS)[number]
export type Method = (typeof METHODS)[number]

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null)

export const checkoutSchema = z
  .object({
    group: z.uuid(),
    interval: z.enum(INTERVALS),
    method: z.enum(METHODS),
    company: z.string().trim().min(1).max(120),
    orgNumber: optional(40),
    country: z.string().regex(/^[A-Z]{2}$/),
    invoiceEmail: z
      .string()
      .trim()
      .toLowerCase()
      .transform((v) => (v === '' ? null : v))
      .pipe(z.email().max(254).nullable())
      .nullable()
      .default(null),
    reference: optional(60),
  })
  .refine((c) => c.method !== 'invoice' || (c.orgNumber !== null && c.invoiceEmail !== null), { message: 'an invoice needs an organisation number and an invoice email', path: ['method'] })
export type CheckoutInput = z.input<typeof checkoutSchema>

export const confirmSchema = z.object({ checkout: z.uuid(), outcome: z.enum(['paid', 'failed']) })
export const groupSchema = z.object({ group: z.uuid() })
export const DEV_EVENTS = ['trial_ended', 'payment_failed', 'grace_ended', 'payment_received'] as const
export const devEventSchema = z.object({ group: z.uuid(), event: z.enum(DEV_EVENTS) })

export const REASONS = ['signed_out', 'not_leader', 'already', 'trial_used', 'invalid', 'unavailable', 'closed', 'no_subscription'] as const
export type BillingReason = (typeof REASONS)[number] | 'failed'

export const replySchema = z.union([
  z.object({ ok: z.literal(true), checkout: z.uuid().optional(), currency: z.string().optional(), amount_minor: z.number().optional(), paid: z.boolean().optional() }),
  z.object({ ok: z.literal(false), reason: z.enum(REASONS) }),
])

export type BillingResult<T extends object = object> = ({ ok: true } & T) | { ok: false; reason: BillingReason }
