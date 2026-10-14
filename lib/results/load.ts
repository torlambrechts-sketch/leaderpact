import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { callFailed, parseFailed } from '@/lib/supabase/read'
import { comparableScales, type ScaleResult } from '@/lib/results/build'
import { cutoffRowSchema, cutoffsAt, itemRowSchema, resultRowSchema, toScale } from '@/lib/results/schema'
import type { Cutoffs } from '@/lib/scoring'

/**
 * What the results pages read (0007, 0016), each parsed. Results come only through `get_results` and
 * `get_item_results`, which answer a current member for a released round at or above its threshold, and
 * nothing otherwise. Each loader answers null when the read fails.
 */
async function client(where: string) {
  try {
    return await createClient()
  } catch {
    console.error(`[read] ${where}: no Supabase configuration`)
    return null
  }
}

/** A released round's scales, or an empty list where the reader may not see it */
export async function loadScaleResults(round: string): Promise<ScaleResult[] | null> {
  if (!z.uuid().safeParse(round).success) return []
  const supabase = await client('loadScaleResults')
  if (!supabase) return null
  const { data, error } = await supabase.schema('app').rpc('get_results', { p_round: round })
  if (callFailed('loadScaleResults', error)) return null
  const parsed = z.array(resultRowSchema).safeParse(data)
  return parseFailed('loadScaleResults', parsed) ? null : parsed.data.map(toScale)
}

/** A released round's items of one scale: text and level, nothing else (handoff 6.12) */
export async function loadItemResults(round: string, scale: string): Promise<{ code: string; text: string; level: number }[] | null> {
  if (!z.uuid().safeParse(round).success) return []
  const supabase = await client('loadItemResults')
  if (!supabase) return null
  const { data, error } = await supabase.schema('app').rpc('get_item_results', { p_round: round })
  if (callFailed('loadItemResults', error)) return null
  const parsed = z.array(itemRowSchema).safeParse(data)
  if (parseFailed('loadItemResults', parsed)) return null
  return parsed.data.filter((r) => r.factor_key === scale).map((r) => ({ code: r.item_code, text: r.item_text.en, level: r.level }))
}

/**
 * The scales two rounds may be compared on (owner C5): every scale when they asked one instrument version,
 * else those whose core items are the same in both.
 */
export async function loadComparable(round: string, previous: string): Promise<{ all: true } | { all: false; keys: Set<string> } | null> {
  const supabase = await client('loadComparable')
  if (!supabase) return null
  const rounds = await supabase.schema('app').from('assessment_round').select('id, instrument_version_id').in('id', [round, previous])
  if (callFailed('loadComparable.rounds', rounds.error)) return null
  const versions = z.array(z.object({ id: z.uuid(), instrument_version_id: z.uuid() })).safeParse(rounds.data)
  if (parseFailed('loadComparable.rounds', versions)) return null
  const a = versions.data.find((r) => r.id === round)?.instrument_version_id
  const b = versions.data.find((r) => r.id === previous)?.instrument_version_id
  if (!a || !b) return null
  if (a === b) return { all: true }
  const items = await supabase.schema('app').from('instrument_version_item').select('instrument_version_id, item_id, item(factor(key))').in('instrument_version_id', [a, b])
  if (callFailed('loadComparable.items', items.error)) return null
  const rows = z
    .array(z.object({ instrument_version_id: z.uuid(), item_id: z.uuid(), item: z.object({ factor: z.object({ key: z.string() }) }) }))
    .safeParse(items.data)
  if (parseFailed('loadComparable.items', rows)) return null
  const of = (v: string) => rows.data.filter((r) => r.instrument_version_id === v).map((r) => ({ factor: r.item.factor.key, item: r.item_id }))
  return { all: false, keys: comparableScales(of(a), of(b)) }
}

/** The cut-offs in force when a round closed: its standings were made with them, and its change uses their margin */
export async function loadCutoffsAt(at: string): Promise<Cutoffs | null> {
  const supabase = await client('loadCutoffsAt')
  if (!supabase) return null
  const { data, error } = await supabase.schema('app').from('cutoff_set').select('*')
  if (callFailed('loadCutoffsAt', error)) return null
  const parsed = z.array(cutoffRowSchema).safeParse(data)
  if (parseFailed('loadCutoffsAt', parsed)) return null
  return cutoffsAt(parsed.data, at)
}

/** A scale's definition: its newest wording in force (0016) */
export async function loadDefinition(scale: string): Promise<string | null> {
  const supabase = await client('loadDefinition')
  if (!supabase) return null
  const { data, error } = await supabase
    .schema('app')
    .from('factor_text')
    .select('version, definition, valid_from, factor!inner(key)')
    .eq('factor.key', scale)
    .lte('valid_from', new Date().toISOString())
    .order('version', { ascending: false })
    .limit(1)
  if (callFailed('loadDefinition', error)) return null
  const parsed = z.array(z.object({ definition: z.object({ en: z.string().min(1) }) })).safeParse(data)
  if (parseFailed('loadDefinition', parsed)) return null
  return parsed.data[0]?.definition.en ?? null
}
