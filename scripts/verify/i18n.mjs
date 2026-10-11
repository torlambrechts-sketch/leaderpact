/**
 * The message catalogue: syntax, plurals and the copy rules.
 *
 * English is the only locale, so Orgpuls's parity check between catalogues would pass trivially and
 * is not ported. What can still go wrong, and fails no build:
 *
 * 1. A message is not valid ICU. next-intl compiles it at render time and throws.
 * 2. A plural lacks a category English needs (one, other).
 * 3. The copy breaks a rule of handoff section 10: American spelling, an emoji, a sentence of 25
 *    words or more, or a name from the "Not" column.
 *
 * The rules live in lib/i18n/icu-rules.ts (from Orgpuls) and lib/i18n/copy-rules.ts; the unit tests
 * run the same code.
 *
 *   node scripts/verify/i18n.mjs
 */
import { readFileSync } from 'node:fs'
import { tsImport } from 'tsx/esm/api'

const { flattenMessages, literalText, parseIcu, pluralGaps } = await tsImport('../../lib/i18n/icu-rules.ts', import.meta.url)
const { copyFindings } = await tsImport('../../lib/i18n/copy-rules.ts', import.meta.url)

const FILE = 'messages/en.json'
const messages = flattenMessages(JSON.parse(readFileSync(FILE, 'utf8')))
const problems = []

for (const [key, message] of Object.entries(messages)) {
  let ast
  try {
    ast = parseIcu(message)
  } catch (error) {
    problems.push(`${key}: not valid ICU (${error.message})`)
    continue
  }
  for (const gap of pluralGaps(ast, 'en-GB')) problems.push(`${key}: ${gap}`)
  for (const finding of copyFindings(literalText(ast))) problems.push(`${key}: ${finding}`)
}

if (problems.length) {
  console.error(`${FILE}: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  process.exit(1)
}
console.log(`${FILE}: ${Object.keys(messages).length} messages, valid ICU, plurals complete, copy rules kept`)
