import 'server-only'
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { anonClient } from '@/lib/supabase/anon'
import { parseFailed, readFailed } from '@/lib/supabase/read'

/**
 * The Team plan's prices, from the plan rows (handoff 1: test prices, held as data; 0004). Read as a
 * visitor reads them: plans and prices are reference data every role may read (0003). For each interval
 * the newest version in force is taken. Cached for ten minutes; a price changes only by a migration.
 */
export interface Price {
  amountMinor: number
  currency: string
  interval: 'month' | 'year'
}

export interface TeamPrices {
  year: Price
  month: Price
}

const priceRow = z.object({
  amount_minor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
  interval: z.enum(['month', 'year']),
})

async function fetchTeamPrices(): Promise<TeamPrices | null> {
  const client = anonClient()
  if (!client) return null
  const { data, error } = await client
    .schema('app')
    .from('plan_price')
    .select('amount_minor, currency, interval')
    .eq('plan_key', 'team')
    .lte('valid_from', new Date().toISOString())
    .order('version', { ascending: false })
  if (readFailed('loadTeamPrices', error, data)) throw new Error('read failed')
  const rows = z.array(priceRow).safeParse(data)
  if (parseFailed('loadTeamPrices', rows)) throw new Error('parse failed')
  const price = (interval: 'month' | 'year') => {
    const row = rows.data.find((r) => r.interval === interval)
    return row ? { amountMinor: row.amount_minor, currency: row.currency, interval } : null
  }
  const year = price('year')
  const month = price('month')
  return year && month ? { year, month } : null
}

const cachedTeamPrices = unstable_cache(fetchTeamPrices, ['plan:team:prices'], { revalidate: 600 })

/** The Team plan's prices per group, per year and per month, or null when they cannot be read */
export async function loadTeamPrices(): Promise<TeamPrices | null> {
  try {
    return await cachedTeamPrices()
  } catch {
    return null
  }
}

/** The Team plan's price per group per year, or null when it cannot be read; nothing is shown then */
export async function loadTeamPrice(): Promise<Price | null> {
  return (await loadTeamPrices())?.year ?? null
}

/** A price as the design writes it: "$1,800", whole units, the currency's narrow symbol */
export function formatPrice(price: Price): string {
  const digits = price.amountMinor % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: price.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(price.amountMinor / 100)
}
