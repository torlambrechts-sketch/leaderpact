import { describe, expect, it } from 'vitest'
import data from '@/data/sample/lumio.v1.json'
import { LUMIO } from '@/scripts/seed/fixture.mjs'
import { copyFindings } from '@/lib/i18n/copy-rules'
import { sampleSchema } from '@/lib/sample/schema'
import { SAMPLE, SAMPLE_RESULTS } from '@/lib/sample/load'

/**
 * The sample content of the paid areas on the Free plan (handoff 6.19, D-30): it parses, it is the fixture's
 * Lumio group, it keeps the copy rules, and it follows the rules a real group's content would.
 */
describe('the sample content', () => {
  it('parses, and the schema refuses what the rules refuse', () => {
    expect(sampleSchema.safeParse(data).success).toBe(true)
    const third = { ...SAMPLE.plan.focus[0]! }
    expect(sampleSchema.safeParse({ ...data, plan: { focus: [third, third, third] } }).success).toBe(false)
    expect(sampleSchema.safeParse({ ...data, people: SAMPLE.people.map((p) => ({ ...p, role: 'leader' })) }).success).toBe(false)
    const noOwner = { ...SAMPLE.meeting, items: [{ ...SAMPLE.meeting.items[0]!, owner: 'zz' }] }
    expect(sampleSchema.safeParse({ ...data, meeting: noOwner }).success).toBe(false)
  })

  it('is the Lumio leadership group of 8, the same people as the fixture, led by Kari Nordmann', () => {
    expect(SAMPLE.group).toBe(LUMIO.group.name)
    expect(SAMPLE.people.map((p) => p.name)).toEqual(LUMIO.people.map((p) => p.name))
    expect(SAMPLE.people.find((p) => p.role === 'leader')?.name).toBe('Kari Nordmann')
  })

  it('keeps the copy rules in every sentence it shows', () => {
    const text = [
      SAMPLE.charter.purpose,
      ...SAMPLE.charter.tasks.map((t) => t.title),
      ...SAMPLE.charter.agreements,
      ...SAMPLE.plan.focus.flatMap((f) => f.actions.map((a) => a.title)),
      SAMPLE.meeting.title,
      ...SAMPLE.meeting.items.flatMap((i) => [i.title, i.outcome ?? '']),
    ]
    for (const t of text) expect(copyFindings(t), t).toEqual([])
  })

  it('uses four phases, and counts no higher than the members invited', () => {
    for (const r of SAMPLE.rounds) {
      expect(['scheduled', 'answering', 'closed', 'released']).toContain(r.phase)
      if (r.answered !== null) expect(r.answered).toBeLessThanOrEqual(r.invited)
      if (r.phase === 'scheduled') expect(r.answered).toBeNull()
    }
  })

  it('ends its agenda with the closing item', () => {
    expect(SAMPLE.meeting.items.at(-1)?.outcome).toBe('One thing to keep and one to change.')
  })
})

describe('the sample Results overview', () => {
  const rows = Object.values(SAMPLE_RESULTS).flat()

  it('has 21 scales and 3 outcomes, the outcomes first and self-rated', () => {
    expect(rows).toHaveLength(24)
    expect(SAMPLE_RESULTS.outcomes).toHaveLength(3)
    expect(SAMPLE_RESULTS.outcomes.every((r) => r.evidence === null)).toBe(true)
    expect(rows.filter((r) => r.evidence !== null)).toHaveLength(21)
  })

  it('applies section 7: descriptive is a fact, task conflict reads with relationship conflict, low agreement differs', () => {
    const at = (key: string) => rows.find((r) => r.key === key)!
    expect(at('size_and_membership').standing).toBe('fact')
    expect(at('task_conflict').standing).toBe('read_with')
    expect(at('rewards').standing).toBe('views_differ')
    expect(at('clear_purpose').standing).toBe('strength')
    expect(at('dialogue').standing).toBe('priority')
    expect(at('meeting_goals').standing).toBe('watch')
    // lower is better: 1.9 is a strength
    expect(at('relationship_conflict').standing).toBe('strength')
  })

  it('shows no change below 0.6 points: every change in the sample is within normal variation', () => {
    expect(rows.every((r) => r.change.kind === 'within')).toBe(true)
  })
})
