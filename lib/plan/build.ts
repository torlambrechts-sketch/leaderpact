import type { ScaleResult } from '@/lib/results/build'
import type { Plan, PlanAction } from '@/lib/plan/schema'
import type { Standing } from '@/lib/scoring'

/**
 * What the Plan page and a scale's page work out from the plan and a released round's results (handoff 6.12
 * and 6.13). Nothing here makes a number: the levels, labels and standings are the snapshot's.
 */

// the standings a group most likely acts on first; a descriptive scale's fact is never offered
const RANK: Record<Standing, number> = { priority: 0, views_differ: 1, watch: 2, read_with: 3, strength: 4, fact: 5 }

/**
 * The scales to consider for a focus area, from a released round: the 21 scales less the descriptive ones and
 * those already active, by standing and then by level read the way the scale reads (lower is better turned
 * round), as the design orders them. At most `limit`.
 */
export function candidates(results: readonly ScaleResult[], active: ReadonlySet<string>, limit = 6): ScaleResult[] {
  // in tenths, as the level is stored, so a level turned round compares exactly
  const read = (s: ScaleResult) => Math.round((s.readingType === 'lower' ? 6 - s.level : s.level) * 10)
  return results
    .filter((s) => s.layer !== 'outcomes' && s.readingType !== 'descriptive' && !active.has(s.key))
    .sort((a, b) => RANK[a.standing] - RANK[b.standing] || read(a) - read(b) || a.ordinal - b.ordinal)
    .slice(0, limit)
}

/** Where one scale stands in the plan, for its page's "Make this a focus area" */
export type FocusPlace =
  | { kind: 'active' }
  | { kind: 'open' }
  | { kind: 'full' }
  | { kind: 'none' }

export function focusPlace(plan: Plan, scale: string, isOutcome: boolean): FocusPlace {
  if (isOutcome) return { kind: 'none' }
  const active = plan.focus_areas.filter((f) => f.status === 'active')
  if (active.some((f) => f.scale === scale)) return { kind: 'active' }
  if (!plan.can_choose) return { kind: 'none' }
  return active.length >= plan.max ? { kind: 'full' } : { kind: 'open' }
}

/** A person's open actions in the group, its meetings' included: the Home's "Needs you" counts them for that person alone */
export function myOpenActions(plan: Plan, fromMeetings: readonly Pick<PlanAction, 'mine' | 'status'>[] = []): number {
  const open = (a: Pick<PlanAction, 'mine' | 'status'>) => a.mine && a.status === 'open'
  return plan.focus_areas.reduce((n, f) => n + f.actions.filter(open).length, 0) + fromMeetings.filter(open).length
}
