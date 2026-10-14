import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed, readFailed } from '@/lib/supabase/read'
import type { AdapterName } from '@/lib/billing/provider'

/**
 * What the plan and billing screens read (0013). A group's plan, access and trial for every current member
 * (`get_group_plan`); its billing details for its leader alone (row-level security); and the billing rules
 * held as settings. Parsed, never cast; a failed read is null.
 */
export type Access = 'free' | 'trial' | 'team' | 'grace' | 'read_only'

export interface GroupPlan {
  plan: 'free' | 'team'
  access: Access
  interval: 'year' | 'month' | null
  state: 'active' | 'past_due' | 'read_only' | 'cancelled' | null
  periodEnd: string | null
  graceEndsAt: string | null
  cancelEffectiveAt: string | null
  deletionDueAt: string | null
  trialEndsAt: string | null
  trialAvailable: boolean
  adapter: AdapterName
}

const planRow = z.object({
  plan: z.enum(['free', 'team']),
  access: z.enum(['free', 'trial', 'team', 'grace', 'read_only']),
  interval: z.enum(['year', 'month']).nullable(),
  state: z.enum(['active', 'past_due', 'read_only', 'cancelled']).nullable(),
  period_end: z.string().nullable(),
  grace_ends_at: z.string().nullable(),
  cancel_effective_at: z.string().nullable(),
  deletion_due_at: z.string().nullable(),
  trial_ends_at: z.string().nullable(),
  trial_available: z.boolean(),
  adapter: z.enum(['none', 'development']),
})

/** The group's plan for a current member; 'none' for anyone else; null when it cannot be read. Once per request. */
export const loadGroupPlan = cache(async (groupId: string): Promise<GroupPlan | 'none' | null> => {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').rpc('get_group_plan', { p_team: groupId })
  if (readFailed('loadGroupPlan', error, data)) return null
  const rows = z.array(planRow).safeParse(data)
  if (parseFailed('loadGroupPlan', rows)) return null
  const r = rows.data[0]
  if (!r) return 'none'
  return {
    plan: r.plan,
    access: r.access,
    interval: r.interval,
    state: r.state,
    periodEnd: r.period_end,
    graceEndsAt: r.grace_ends_at,
    cancelEffectiveAt: r.cancel_effective_at,
    deletionDueAt: r.deletion_due_at,
    trialEndsAt: r.trial_ends_at,
    trialAvailable: r.trial_available,
    adapter: r.adapter,
  }
})

export interface Billing {
  startedAt: string
  periodEnd: string
  interval: 'year' | 'month'
  currency: string
  amountMinor: number
  method: 'card' | 'invoice'
  company: string
  orgNumber: string | null
  country: string
  invoiceEmail: string | null
  reference: string | null
}

const billingRow = z.object({
  started_at: z.string(),
  current_period_end: z.string(),
  interval: z.enum(['year', 'month']),
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount_minor: z.number().int().min(0),
  method: z.enum(['card', 'invoice']),
  company_name: z.string().min(1),
  org_number: z.string().nullable(),
  country: z.string().regex(/^[A-Z]{2}$/),
  invoice_email: z.string().nullable(),
  reference: z.string().nullable(),
})

/** The group's billing details, for its leader; 'none' with no subscription or for anyone else; null on failure */
export async function loadBilling(groupId: string): Promise<Billing | 'none' | null> {
  if (!z.uuid().safeParse(groupId).success) return 'none'
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('app')
    .from('subscription')
    .select('started_at, current_period_end, interval, currency, amount_minor, method, company_name, org_number, country, invoice_email, reference')
    .eq('team_id', groupId)
    .maybeSingle()
  if (error) {
    callFailed('loadBilling', error)
    return null
  }
  if (data === null) return 'none'
  const row = billingRow.safeParse(data)
  if (parseFailed('loadBilling', row)) return null
  const b = row.data
  return {
    startedAt: b.started_at,
    periodEnd: b.current_period_end,
    interval: b.interval,
    currency: b.currency,
    amountMinor: b.amount_minor,
    method: b.method,
    company: b.company_name,
    orgNumber: b.org_number,
    country: b.country,
    invoiceEmail: b.invoice_email,
    reference: b.reference,
  }
}

const SETTINGS = ['retention_after_cancel_days', 'trial_days'] as const

/**
 * The billing rules held as setting rows (handoff 8; 0004, 0013): the days Team data is kept after a plan
 * or a trial ends (the organisation's retention, 90 by default) and the trial's length. Null on failure.
 */
export async function loadBillingRules(): Promise<{ retentionDays: number; trialDays: number } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('app').from('setting').select('key, default_value').in('key', [...SETTINGS])
  if (readFailed('loadBillingRules', error, data)) return null
  const rows = z.array(z.object({ key: z.enum(SETTINGS), default_value: z.number().int().min(1) })).safeParse(data)
  if (parseFailed('loadBillingRules', rows)) return null
  const value = (key: (typeof SETTINGS)[number]) => rows.data.find((r) => r.key === key)?.default_value
  const retentionDays = value('retention_after_cancel_days')
  const trialDays = value('trial_days')
  return retentionDays && trialDays ? { retentionDays, trialDays } : null
}
