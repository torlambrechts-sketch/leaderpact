'use server'
import { callBilling, paymentProvider } from '@/lib/billing/provider'
import { checkoutSchema, confirmSchema, devEventSchema, groupSchema, type BillingResult } from '@/lib/billing/schema'
import { loadGroupPlan } from '@/lib/billing/load'

/**
 * The plan and billing writes (handoff 6.18), each through its definer function (0013), which checks the
 * caller again. Nothing here logs an amount, a company or an address (CLAUDE.md invariant 10): only codes.
 */
export async function startCheckout(input: unknown): Promise<BillingResult<{ checkout: string }>> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  const c = parsed.data
  const reply = await callBilling('startCheckout', 'start_checkout', {
    p_team: c.group,
    p_interval: c.interval,
    p_method: c.method,
    p_company: c.company,
    p_org_number: c.orgNumber,
    p_country: c.country,
    p_invoice_email: c.invoiceEmail,
    p_reference: c.reference,
  })
  if (!reply.ok) return reply
  return reply.checkout ? { ok: true, checkout: reply.checkout } : { ok: false, reason: 'failed' }
}

/** The adapter's result for a checkout the leader started: paid, or failed on demand in development */
export async function confirmCheckout(input: unknown): Promise<BillingResult<{ paid: boolean }>> {
  const parsed = confirmSchema.safeParse(input)
  const group = groupSchema.safeParse(input)
  if (!parsed.success || !group.success) return { ok: false, reason: 'invalid' }
  const plan = await loadGroupPlan(group.data.group)
  if (plan === null) return { ok: false, reason: 'failed' }
  if (plan === 'none') return { ok: false, reason: 'not_leader' }
  return paymentProvider(plan.adapter).confirm(parsed.data.checkout, parsed.data.outcome)
}

/** The group's one 14-day Team trial (owner D2a), with no billing details */
export async function startTrial(input: unknown): Promise<BillingResult> {
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return callBilling('startTrial', 'start_trial', { p_team: parsed.data.group })
}

export async function cancelSubscription(input: unknown): Promise<BillingResult> {
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return callBilling('cancelSubscription', 'cancel_subscription', { p_team: parsed.data.group })
}

export async function withdrawCancel(input: unknown): Promise<BillingResult> {
  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return callBilling('withdrawCancel', 'withdraw_cancel', { p_team: parsed.data.group })
}

/** The development adapter's later events, for showing grace and read-only; the database refuses them elsewhere */
export async function devBillingEvent(input: unknown): Promise<BillingResult> {
  const parsed = devEventSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  return callBilling('devBillingEvent', 'dev_billing_event', { p_team: parsed.data.group, p_event: parsed.data.event })
}
