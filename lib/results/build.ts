import { changeBetween, type Change, type Cutoffs, type ReadingType, type Standing } from '@/lib/scoring'

/**
 * The results in three depths (handoff 6.12 and section 7), from the snapshot written at close and nothing
 * else: each scale's level, agreement label and standing are the stored ones (owner C6). What is worked out
 * here is only what the snapshot leaves to the reader: the order, the change since the round before, and the
 * guidance's tone.
 *
 * A result may show the level to one decimal, the agreement label and one standing (handoff 7, What a result
 * may show). Nothing here carries a lowest, highest or median, a spread, the agreement number, a band, a
 * mark per member, a distribution or a subgroup: the readers return none of them.
 */
export const LAYERS = ['outcomes', 'conditions', 'processes', 'states'] as const
export type Layer = (typeof LAYERS)[number]
export type Evidence = 'strong' | 'moderate' | 'mixed' | 'not_rated' | null
export type Agreement = 'high' | 'medium' | 'low'

/** One scale of a released round, as `get_results` returns it */
export interface ScaleResult {
  key: string
  name: string
  layer: Layer
  readingType: ReadingType
  evidence: Evidence
  ordinal: number
  /** the stored level, to one decimal */
  level: number
  agreement: Agreement
  standing: Standing
  n: number
}

/** The change since the round before: none for a first round, and none where the questions changed (owner C5) */
export type ResultChange = Change | { kind: 'first' } | { kind: 'not_comparable' }

export interface ScaleRow extends ScaleResult {
  levelTenths: number
  change: ResultChange
}

const tenths = (level: number) => Math.round(level * 10)

/**
 * The scales whose core items are the same in two instrument versions, by key: only those may show a change
 * between rounds of the two versions (owner C5). Items are compared by id, so a reworded item, which is a new
 * revision with a new id, makes its scale not comparable.
 */
export function comparableScales(a: readonly { factor: string; item: string }[], b: readonly { factor: string; item: string }[]): Set<string> {
  const sets = (rows: readonly { factor: string; item: string }[]) => {
    const m = new Map<string, Set<string>>()
    for (const r of rows) m.set(r.factor, (m.get(r.factor) ?? new Set()).add(r.item))
    return m
  }
  const sa = sets(a)
  const sb = sets(b)
  const same = new Set<string>()
  for (const [factor, items] of sa) {
    const other = sb.get(factor)
    if (other && other.size === items.size && [...items].every((i) => other.has(i))) same.add(factor)
  }
  return same
}

/** The change of one scale since the round before, or why there is none */
export function changeFor(key: string, levelTenths: number, previous: ReadonlyMap<string, number> | null, comparable: ReadonlySet<string> | null, cutoffs: Cutoffs): ResultChange {
  if (previous === null) return { kind: 'first' }
  const before = previous.get(key)
  if (before === undefined || (comparable !== null && !comparable.has(key))) return { kind: 'not_comparable' }
  return changeBetween(tenths(before), levelTenths, cutoffs)
}

/**
 * The overview's rows by layer, outcomes first (handoff 6.12), each layer in Appendix A's order. `previous`
 * is the round before's levels by key, or null for a first round; `comparable` the keys whose questions are
 * the same in both rounds, or null when both rounds asked one instrument version.
 */
export function overview(
  current: readonly ScaleResult[],
  previous: readonly ScaleResult[] | null,
  comparable: ReadonlySet<string> | null,
  cutoffs: Cutoffs,
): Record<Layer, ScaleRow[]> {
  const before = previous ? new Map(previous.map((s) => [s.key, s.level])) : null
  const out: Record<Layer, ScaleRow[]> = { outcomes: [], conditions: [], processes: [], states: [] }
  for (const s of [...current].sort((x, y) => x.ordinal - y.ordinal)) {
    const levelTenths = tenths(s.level)
    out[s.layer].push({ ...s, levelTenths, change: changeFor(s.key, levelTenths, before, comparable, cutoffs) })
  }
  return out
}

/**
 * Which guidance a scale's page gives (handoff 7, Guidance wording): the standing decides what is said, and
 * the scale's own evidence rating the tone. Strong is direct; moderate, and not yet rated, are worded as
 * likely to help; mixed or weak describes what it sees, with no flag. Low agreement says "your views differ"
 * instead of "improve this". An outcome is rated by the group itself and carries no evidence rating.
 */
export type Guidance = 'views_differ' | 'fact' | 'read_with' | 'priority_direct' | 'priority_likely' | 'describe' | 'watch' | 'strength' | 'outcome'

export function guidanceFor(s: Pick<ScaleResult, 'layer' | 'evidence' | 'standing'>): Guidance {
  if (s.standing === 'views_differ') return 'views_differ'
  if (s.standing === 'fact') return 'fact'
  if (s.standing === 'read_with') return 'read_with'
  if (s.layer === 'outcomes') return 'outcome'
  if (s.evidence === 'mixed') return 'describe'
  if (s.standing === 'priority') return s.evidence === 'strong' ? 'priority_direct' : 'priority_likely'
  return s.standing
}
