import { z } from 'zod'

/**
 * The sample content the paid areas show on the Free plan (handoff 6.19), marked Sample wherever it shows.
 * One file, data/sample/lumio.v1.json: the design's own Lumio content (design/reference/proto-core-v5.js:
 * MEMBERS, SCALE_ROWS, initial()), with section 11's corrections: one diagnostic, four phases, no
 * team-leader feedback round, no pre-read flags, no milestones or targets (D-30). Parsed, never trusted.
 *
 * When the tables of milestones 9 to 15 exist, the sample comes from the demo organisation's rows instead
 * (REUSE 4.12), and this file goes.
 */
const day = z.iso.date()
const personKey = z.string().regex(/^[a-z]{2}$/)
const level = z.number().min(1).max(5).refine((n) => Number.isInteger(Math.round(n * 10)) && Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, 'one decimal')

export const sampleSchema = z
  .object({
    v: z.literal(1),
    group: z.string().min(1),
    people: z
      .array(
        z.object({
          key: personKey,
          name: z.string().min(1),
          job: z.string().min(1),
          role: z.enum(['leader', 'member']),
          state: z.enum(['active', 'invited']),
          since: z.string().regex(/^\d{4}-\d{2}$/),
          // the Leader Profile sharing level (handoff 6.17): nothing, domains, or domains and facets
          profile: z.enum(['none', 'domains', 'facets']),
        }),
      )
      .min(4)
      .max(15),
    charter: z.object({
      version: z.number().int().positive(),
      earlier: z.array(z.object({ version: z.number().int().positive(), agreed: day })),
      purpose: z.string().min(1),
      tasks: z.array(z.object({ key: z.string().min(1), title: z.string().min(1), right: z.enum(['decide', 'advise']), owner: personKey })).min(1),
      agreements: z.array(z.string().min(1)).min(1),
    }),
    rounds: z.array(
      z.object({
        name: z.string().min(1),
        kind: z.enum(['diagnostic', 'pulse']),
        // the four phases (handoff 6.10)
        phase: z.enum(['scheduled', 'answering', 'closed', 'released']),
        opens: day.nullable(),
        closes: day.nullable(),
        invited: z.number().int().min(4).max(15),
        answered: z.number().int().min(0).nullable(),
        /** the round whose results the sample shows on Results (D-65): Assess leads there from it */
        results: z.boolean().optional(),
      }),
    ),
    results: z.object({
      round: z.number().int().positive(),
      previous: z.number().int().positive(),
      closed: day,
      released: day,
      invited: z.number().int(),
      answered: z.number().int(),
      scales: z.array(z.object({ key: z.string().min(1), previous: level, level, agreement: z.enum(['high', 'medium', 'low']) })),
    }),
    plan: z.object({
      // at most 2 active focus areas (handoff 6.13); every action has an owner and a due date
      focus: z
        .array(z.object({ scale: z.string().min(1), actions: z.array(z.object({ title: z.string().min(1), owner: personKey, due: day, done: z.boolean() })).min(1) }))
        .max(2),
    }),
    meeting: z.object({
      title: z.string().min(1),
      on: day,
      at: z.string().regex(/^\d{2}:\d{2}$/),
      minutes: z.number().int().positive(),
      items: z
        .array(
          z.object({
            title: z.string().min(1),
            type: z.enum(['information', 'discussion', 'decision', 'follow_up']),
            outcome: z.string().min(1).nullable(),
            owner: personKey,
            minutes: z.number().int().positive(),
            task: z.string().min(1).nullable(),
          }),
        )
        .min(1),
    }),
  })
  .superRefine((s, ctx) => {
    const people = new Set(s.people.map((p) => p.key))
    const tasks = new Set(s.charter.tasks.map((t) => t.key))
    const owners = [...s.charter.tasks.map((t) => t.owner), ...s.plan.focus.flatMap((f) => f.actions.map((a) => a.owner)), ...s.meeting.items.map((i) => i.owner)]
    for (const o of owners) if (!people.has(o)) ctx.addIssue({ code: 'custom', message: `no person ${o}` })
    for (const i of s.meeting.items) if (i.task && !tasks.has(i.task)) ctx.addIssue({ code: 'custom', message: `no team task ${i.task}` })
    if (s.people.filter((p) => p.role === 'leader').length !== 1) ctx.addIssue({ code: 'custom', message: 'exactly one leader' })
    const shown = s.rounds.filter((r) => r.results)
    const [round] = shown
    if (shown.length !== 1 || !round) ctx.addIssue({ code: 'custom', message: 'exactly one round leads to the results' })
    else if (round.kind !== 'diagnostic' || round.phase !== 'released' || round.invited !== s.results.invited || round.answered !== s.results.answered)
      ctx.addIssue({ code: 'custom', message: 'the round that leads to the results is the released diagnostic they are of' })
  })

export type Sample = z.infer<typeof sampleSchema>
export type SamplePerson = Sample['people'][number]
