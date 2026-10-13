import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { replySchema, type BillingResult } from '@/lib/billing/schema'

/**
 * The payment provider (handoff 3: "behind a `PaymentProvider` interface, with a development adapter that
 * succeeds or fails on demand"; owner D1). No vendor is named, so two adapters exist, and the database says
 * which one runs (0013, `app.payment_adapter`): `none` on the hosted project, where a checkout can never be
 * paid, and `development` in a local or CI database. A vendor's adapter will add a checkout page of its own
 * and `parseWebhook`; tax is the vendor's (owner D2c).
 */
export type AdapterName = 'none' | 'development'

export interface StartedCheckout {
  checkout: string
  currency: string
  amountMinor: number
}

export interface PaymentProvider {
  readonly name: AdapterName
  /** whether a checkout can be paid with this adapter */
  readonly canPay: boolean
  /** the result of a checkout the person started: paid, or failed */
  confirm(checkout: string, outcome: 'paid' | 'failed'): Promise<BillingResult<{ paid: boolean }>>
  /** a vendor's notice of a payment; none arrives until a vendor is named */
  parseWebhook(request: Request): Promise<null>
}

/** A definer function's reply, parsed: ok with its fields, or the reason it refused */
export async function callBilling(where: string, rpc: string, args: Record<string, unknown>) {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    console.error(`[billing] ${where}: no Supabase configuration`)
    return { ok: false as const, reason: 'failed' as const }
  }
  const { data, error } = await supabase.schema('app').rpc(rpc, args)
  if (callFailed(where, error)) return { ok: false as const, reason: 'failed' as const }
  const reply = replySchema.safeParse(data)
  if (parseFailed(where, reply)) return { ok: false as const, reason: 'failed' as const }
  return reply.data
}

const development: PaymentProvider = {
  name: 'development',
  canPay: true,
  async confirm(checkout, outcome) {
    const reply = await callBilling('confirm', 'complete_checkout', { p_checkout: checkout, p_outcome: outcome })
    return reply.ok ? { ok: true, paid: reply.paid === true } : reply
  },
  async parseWebhook() {
    return null
  },
}

const none: PaymentProvider = {
  name: 'none',
  canPay: false,
  async confirm() {
    return { ok: false, reason: 'unavailable' }
  },
  async parseWebhook() {
    return null
  },
}

export const paymentProvider = (name: AdapterName): PaymentProvider => (name === 'development' ? development : none)
