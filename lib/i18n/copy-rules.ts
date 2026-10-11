/**
 * The copy rules of handoff section 10, as plain functions, so scripts/verify/i18n.mjs and
 * tests/unit/copy-rules.test.ts run the same code (the pattern of Orgpuls lib/i18n/icu-rules.ts).
 *
 * Each takes the literal text a message contributes (icu-rules `literalText`, placeholders removed)
 * and returns readable findings; empty means it passes.
 */

/** American spellings that British English writes differently. Matched as whole words. */
const AMERICAN: Record<string, string> = {
  color: 'colour',
  colors: 'colours',
  behavior: 'behaviour',
  behaviors: 'behaviours',
  center: 'centre',
  centers: 'centres',
  organization: 'organisation',
  organizations: 'organisations',
  organize: 'organise',
  organized: 'organised',
  prioritize: 'prioritise',
  prioritized: 'prioritised',
  analyze: 'analyse',
  analyzed: 'analysed',
  recognize: 'recognise',
  recognized: 'recognised',
  favorite: 'favourite',
  honor: 'honour',
  labor: 'labour',
  program: 'programme',
  canceled: 'cancelled',
  canceling: 'cancelling',
  license: 'licence (noun)',
  catalog: 'catalogue',
  dialog: 'dialogue',
  enroll: 'enrol',
  fulfill: 'fulfil',
  judgment: 'judgement',
  summarize: 'summarise',
  customize: 'customise',
  customized: 'customised',
  personalize: 'personalise',
  personalized: 'personalised',
  apologize: 'apologise',
  realize: 'realise',
  utilize: 'use',
}

export function americanisms(text: string): string[] {
  const out: string[] = []
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    const british = AMERICAN[word]
    if (british) out.push(`"${word}" is American spelling; write "${british}"`)
  }
  return [...new Set(out)]
}

/** Pictographs and their joiners. Arrows and typographic marks are not emoji. */
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}]/u

export function emoji(text: string): string[] {
  return EMOJI.test(text) ? ['contains an emoji; the product has none'] : []
}

/** Sentences of 25 words or more. A sentence ends at . ! or ? followed by a space or the end. */
export function longSentences(text: string, limit = 25): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => (s.match(/\S+/g) ?? []).length >= limit)
    .map((s) => `a sentence of ${(s.match(/\S+/g) ?? []).length} words; keep it under ${limit}: "${s.slice(0, 60)}…"`)
}

/**
 * One name per thing (handoff section 10): the names in the "Not" column. Each pattern carries the
 * name to use instead. "Validated" is allowed only inside "not yet validated".
 */
const FORBIDDEN: { pattern: RegExp; use: string }[] = [
  { pattern: /\bthroughline\b/i, use: 'the product name, from lib/brand.ts' },
  { pattern: /(?<!leadership )\bteam scan\b/i, use: 'Leadership Team Scan' },
  { pattern: /\b24 scales\b/i, use: '21 scales and 3 outcomes' },
  { pattern: /\bteam report\b/i, use: 'Team view' },
  { pattern: /\b(extensive|standard) diagnostic\b/i, use: 'Full diagnostic' },
  { pattern: /\bfit check\b/i, use: 'Task match, or time check' },
  { pattern: /\bproven\b/i, use: 'Research-based, not yet validated' },
  { pattern: /(?<!not yet )\bvalidated\b/i, use: 'Research-based, not yet validated' },
  { pattern: /\bmost chosen\b/i, use: 'nothing: no claim that is not true today' },
]

export function forbiddenNames(text: string): string[] {
  return FORBIDDEN.filter((f) => f.pattern.test(text)).map((f) => `"${text.match(f.pattern)?.[0]}" is not our name for it; use ${f.use}`)
}

export function copyFindings(text: string): string[] {
  return [...americanisms(text), ...emoji(text), ...longSentences(text), ...forbiddenNames(text)]
}
