/**
 * The model as data, validated: the files in data/ that scripts/seed/model.mjs turns into the rows of
 * 0004 (CLAUDE.md, Model as data; REUSE 4.10). The rows are checked once more by
 * supabase/tests/model_invariants.sql; this is the check that stops a wrong file before it is a migration.
 *
 * 1. **21 scales and 3 outcomes** (handoff Appendix A): 6 conditions, 11 processes, 4 states and 3
 *    outcomes, listed in ordinal order 1 to 24. An outcome carries no evidence rating; a scale carries one.
 * 2. **The item bank** (Appendix B): four items per scale, listed scale by scale, coded `<scale>.<n>` with
 *    n the item's place in its scale. Each scale has three core items and one candidate.
 * 3. **The scan** (Appendix C): six themes, twelve distinct core items in order 1 to 12, two per theme.
 * 4. **Cut-offs** (handoff 7): the rule of lib/scoring/cutoffs.ts for each version (precision, ranges,
 *    orderings), with versions 1 to n, each starting after the one before.
 * 5. **Settings** (handoff 8, Configuration): min <= default <= max; a fixed setting has no range.
 * 6. **Plans** (handoff 1) with prices in whole, non-negative minor units.
 * 7. **Every name and item text keeps the copy rules** of handoff 10 (lib/i18n/copy-rules.ts): British
 *    spelling, no emoji, sentences under 25 words, one name per thing.
 *
 * Every rule fails loudly, with the path of what broke it. Wording is the handoff's, verbatim.
 */
import { z } from 'zod'
import { copyFindings } from '../i18n/copy-rules'
import { cutoffsSchema } from '../scoring/cutoffs'

export const LAYERS = ['conditions', 'processes', 'states', 'outcomes'] as const
/** Appendix A: "6 conditions, 11 processes, 4 states and 3 outcomes" */
export const LAYER_COUNTS: Record<(typeof LAYERS)[number], number> = { conditions: 6, processes: 11, states: 4, outcomes: 3 }
/** Appendix B: three core items and one candidate per scale */
export const CORE_PER_SCALE = 3
export const CANDIDATES_PER_SCALE = 1
/** Appendix C: twelve items in six themes, two each */
export const SCAN_THEMES = 6
export const ITEMS_PER_THEME = 2

export const FEATURES = [
  'scan', 'team_view', 'leader_profile', 'scan_history', 'charter', 'diagnostic', 'pulse', 'meetings', 'focus_areas',
] as const

const KEY = /^[a-z][a-z_]*[a-z]$/
const Key = z.string().regex(KEY, 'a key is lower case words joined by _')
const ItemCode = z.string().regex(/^[a-z][a-z_]*[a-z]\.[1-9][0-9]*$/, 'an item code is <scale key>.<n>')
const Ordinal = z.number().int().positive()

/** Text a person reads: trimmed, single-spaced, and kept to the copy rules of handoff 10 */
const Copy = z.string().min(1).superRefine((text, ctx) => {
  if (text !== text.trim() || /\s{2,}/.test(text)) ctx.addIssue({ code: 'custom', message: 'stray whitespace' })
  for (const finding of copyFindings(text)) ctx.addIssue({ code: 'custom', message: finding })
})

function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>()
  const twice = new Set<T>()
  for (const v of values) (seen.has(v) ? twice : seen).add(v)
  return [...twice]
}

type Ctx = z.RefinementCtx
const fail = (ctx: Ctx, message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', message, path })

/** Ordinals 1..n in list order: unique, gapless, and the order the rows are read in */
function inOrder(ctx: Ctx, values: readonly number[], what: string, path: (string | number)[]) {
  values.forEach((v, i) => {
    if (v !== i + 1) fail(ctx, `${what} ${v} at place ${i + 1}: list them in order, 1 to ${values.length}`, [...path, i])
  })
}

// ---------------------------------------------------------------- the item bank (Appendices A and B)
const Factor = z.strictObject({
  key: Key,
  name: Copy,
  layer: z.enum(LAYERS),
  // higher or lower is better; descriptive (no target); conditional (task conflict)
  readingType: z.enum(['higher', 'lower', 'descriptive', 'conditional']),
  // "Mixed or weak" is mixed, "Not yet rated" is not_rated; outcomes have none
  evidence: z.enum(['strong', 'moderate', 'mixed', 'not_rated']).nullable(),
  ordinal: Ordinal,
})

const Item = z.strictObject({
  code: ItemCode,
  factor: Key,
  text: Copy,
  use: z.enum(['core', 'candidate']),
})

export const Bank = z
  .strictObject({ version: Ordinal, factors: z.array(Factor), items: z.array(Item) })
  .superRefine((bank, ctx) => {
    const total = Object.values(LAYER_COUNTS).reduce((a, b) => a + b, 0)
    if (bank.factors.length !== total) fail(ctx, `${bank.factors.length} scales and outcomes; Appendix A has ${total}`, ['factors'])
    for (const layer of LAYERS) {
      const n = bank.factors.filter((f) => f.layer === layer).length
      if (n !== LAYER_COUNTS[layer]) fail(ctx, `${n} in ${layer}; Appendix A has ${LAYER_COUNTS[layer]}`, ['factors'])
    }
    inOrder(ctx, bank.factors.map((f) => f.ordinal), 'ordinal', ['factors'])
    bank.factors.forEach((f, i) => {
      if (f.layer === 'outcomes' && f.evidence !== null) fail(ctx, 'an outcome carries no evidence rating', ['factors', i, 'evidence'])
      if (f.layer !== 'outcomes' && f.evidence === null) fail(ctx, 'a scale carries an evidence rating', ['factors', i, 'evidence'])
    })
    for (const key of duplicates(bank.factors.map((f) => f.key))) fail(ctx, `scale ${key} appears twice`, ['factors'])
    for (const name of duplicates(bank.factors.map((f) => f.name))) fail(ctx, `the name "${name}" appears twice`, ['factors'])

    const perScale = CORE_PER_SCALE + CANDIDATES_PER_SCALE
    if (bank.items.length !== total * perScale) fail(ctx, `${bank.items.length} items; Appendix B has ${total * perScale}`, ['items'])
    const ordinal = new Map(bank.factors.map((f) => [f.key, f.ordinal]))
    const placed = new Map<string, number>()
    let last = 0
    bank.items.forEach((item, i) => {
      const at = ordinal.get(item.factor)
      if (at === undefined) return fail(ctx, `no scale ${item.factor}`, ['items', i, 'factor'])
      if (at < last) fail(ctx, `${item.code} is out of place: list the items scale by scale, in scale order`, ['items', i])
      last = at
      const n = (placed.get(item.factor) ?? 0) + 1
      placed.set(item.factor, n)
      if (item.code !== `${item.factor}.${n}`) fail(ctx, `item ${n} of ${item.factor} is coded ${item.code}; code it ${item.factor}.${n}`, ['items', i, 'code'])
    })
    for (const f of bank.factors) {
      const own = bank.items.filter((item) => item.factor === f.key)
      const core = own.filter((item) => item.use === 'core').length
      const candidate = own.length - core
      if (core !== CORE_PER_SCALE || candidate !== CANDIDATES_PER_SCALE) {
        fail(ctx, `${f.key} has ${core} core and ${candidate} candidate items; a scale has ${CORE_PER_SCALE} and ${CANDIDATES_PER_SCALE}`, ['items'])
      }
    }
    for (const code of duplicates(bank.items.map((item) => item.code))) fail(ctx, `item ${code} appears twice`, ['items'])
    for (const text of duplicates(bank.items.map((item) => item.text))) fail(ctx, `the text "${text}" appears twice`, ['items'])
  })

// ---------------------------------------------------------------- the Leadership Team Scan (Appendix C)
export const Scan = z
  .strictObject({
    version: Ordinal,
    themes: z.array(z.strictObject({ key: Key, name: Copy, ordinal: Ordinal })),
    items: z.array(z.strictObject({ order: Ordinal, theme: Key, code: ItemCode })),
  })
  .superRefine((scan, ctx) => {
    if (scan.themes.length !== SCAN_THEMES) fail(ctx, `${scan.themes.length} themes; the scan has ${SCAN_THEMES}`, ['themes'])
    inOrder(ctx, scan.themes.map((t) => t.ordinal), 'ordinal', ['themes'])
    for (const key of duplicates(scan.themes.map((t) => t.key))) fail(ctx, `theme ${key} appears twice`, ['themes'])
    for (const name of duplicates(scan.themes.map((t) => t.name))) fail(ctx, `the name "${name}" appears twice`, ['themes'])

    const expected = SCAN_THEMES * ITEMS_PER_THEME
    if (scan.items.length !== expected) fail(ctx, `${scan.items.length} items; the scan has ${expected}`, ['items'])
    inOrder(ctx, scan.items.map((s) => s.order), 'order', ['items'])
    for (const code of duplicates(scan.items.map((s) => s.code))) fail(ctx, `item ${code} is asked twice`, ['items'])
    const themes = new Set(scan.themes.map((t) => t.key))
    scan.items.forEach((s, i) => {
      if (!themes.has(s.theme)) fail(ctx, `no theme ${s.theme}`, ['items', i, 'theme'])
    })
    for (const t of scan.themes) {
      const n = scan.items.filter((s) => s.theme === t.key).length
      if (n !== ITEMS_PER_THEME) fail(ctx, `theme ${t.key} has ${n} items; a theme has ${ITEMS_PER_THEME}`, ['items'])
    }
  })

// ---------------------------------------------------------------- instruments (handoff 10 names)
export const Instruments = z
  .array(z.strictObject({ key: z.enum(['scan', 'diagnostic', 'pulse']), name: Copy }))
  .superRefine((list, ctx) => {
    for (const key of ['scan', 'diagnostic', 'pulse'] as const) {
      const n = list.filter((i) => i.key === key).length
      if (n !== 1) fail(ctx, `instrument ${key} appears ${n} times; once each`)
    }
  })

// ---------------------------------------------------------------- cut-offs (handoff 7; owner C6)
// The rule for one version lives in lib/scoring/cutoffs.ts, which scoring parses a stored row with: its
// precision (hundredths, tenths), ranges and orderings. A file row adds only the moment it starts.
const Cutoff = cutoffsSchema.safeExtend({ validFrom: z.iso.datetime() }).strict()

export const Cutoffs = z
  .array(Cutoff)
  .min(1)
  .superRefine((list, ctx) => {
    inOrder(ctx, list.map((c) => c.version), 'version', [])
    list.forEach((c, i) => {
      const before = list[i - 1]
      if (before && Date.parse(c.validFrom) <= Date.parse(before.validFrom)) fail(ctx, 'a later version starts later', [i, 'validFrom'])
    })
  })

// ---------------------------------------------------------------- settings (handoff 8, Configuration)
const Setting = z
  .strictObject({
    key: Key,
    scope: z.enum(['platform', 'organisation', 'group']),
    // a number, or for reminder days a list of numbers
    default: z.union([z.number(), z.array(z.number()).min(1)]),
    min: z.number().nullable(),
    max: z.number().nullable(),
    // no organisation or group may change it
    fixed: z.boolean(),
    unit: z.enum(['count', 'days', 'weeks', 'months', 'points']),
  })
  .superRefine((s, ctx) => {
    if (s.fixed && (s.min !== null || s.max !== null)) fail(ctx, 'a fixed setting has no range', ['min'])
    if (!s.fixed && (s.min === null || s.max === null)) fail(ctx, 'a setting that may change has a range', ['min'])
    if (s.min !== null && s.max !== null && s.min > s.max) fail(ctx, `min ${s.min} is above max ${s.max}`, ['min'])
    const values = Array.isArray(s.default) ? s.default : [s.default]
    for (const v of values) {
      if ((s.min !== null && v < s.min) || (s.max !== null && v > s.max)) fail(ctx, `default ${v} lies outside ${s.min} to ${s.max}`, ['default'])
    }
    if (values.some((v, i) => i > 0 && v <= (values[i - 1] ?? -Infinity))) fail(ctx, 'a list of days runs strictly upwards', ['default'])
    if (s.unit !== 'points' && [...values, s.min, s.max].some((v) => v !== null && !Number.isInteger(v))) {
      fail(ctx, `a setting in ${s.unit} is a whole number`, ['default'])
    }
  })

export const Settings = z.array(Setting).superRefine((list, ctx) => {
  for (const key of duplicates(list.map((s) => s.key))) fail(ctx, `setting ${key} appears twice`)
})

// ---------------------------------------------------------------- plans (handoff 1)
const Price = z.strictObject({
  interval: z.enum(['month', 'year']),
  currency: z.string().regex(/^[A-Z]{3}$/, 'an ISO 4217 code'),
  // minor units: 180000 is $1,800.00
  amountMinor: z.number().int().nonnegative(),
  version: Ordinal,
  validFrom: z.iso.datetime(),
})

const Plan = z
  .strictObject({
    key: z.string().regex(/^[a-z][a-z_]*$/),
    name: Copy,
    ordinal: Ordinal,
    // groups per subscription; members per group
    maxGroups: z.number().int().positive().nullable(),
    maxMembers: z.number().int().min(4).max(15),
    features: z.array(z.enum(FEATURES)),
    prices: z.array(Price),
  })
  .superRefine((p, ctx) => {
    for (const f of duplicates(p.features)) fail(ctx, `feature ${f} appears twice`, ['features'])
    for (const k of duplicates(p.prices.map((x) => `${x.interval} ${x.currency} v${x.version}`))) fail(ctx, `price ${k} appears twice`, ['prices'])
  })

export const Plans = z.array(Plan).superRefine((list, ctx) => {
  for (const key of duplicates(list.map((p) => p.key))) fail(ctx, `plan ${key} appears twice`)
  for (const n of duplicates(list.map((p) => p.ordinal))) fail(ctx, `ordinal ${n} appears twice`)
})

// ---------------------------------------------------------------- the whole model
export const Model = z
  .strictObject({ instruments: Instruments, bank: Bank, scan: Scan, cutoffs: Cutoffs, settings: Settings, plans: Plans })
  .superRefine((m, ctx) => {
    const items = new Map(m.bank.items.map((item) => [item.code, item]))
    m.scan.items.forEach((s, i) => {
      const item = items.get(s.code)
      if (!item) fail(ctx, `${s.code} is not in bank version ${m.bank.version}`, ['scan', 'items', i, 'code'])
      else if (item.use !== 'core') fail(ctx, `${s.code} is a candidate; the scan asks core items only`, ['scan', 'items', i, 'code'])
    })
  })

export type Model = z.infer<typeof Model>
export type Bank = z.infer<typeof Bank>
export type Scan = z.infer<typeof Scan>

/** Parse or throw, with every issue listed; for the generator and the tests */
export function parseModel(files: unknown): Model {
  const r = Model.safeParse(files)
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
    throw new Error(`data/ does not hold a valid model:\n${lines.join('\n')}`)
  }
  return r.data
}
