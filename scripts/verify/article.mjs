/**
 * The editorial rules for one article, or all of them (lib/site/article-content.ts, D-34): the check a
 * writer runs while writing, and the same rules the unit tests hold every published article to.
 *
 *   node scripts/verify/article.mjs <slug>     one article
 *   node scripts/verify/article.mjs            every published article
 */
import { existsSync, readFileSync } from 'node:fs'
import { tsImport } from 'tsx/esm/api'

const { articleProblems, articleWords, ArticleContent } = await tsImport('../../lib/site/article-content.ts', import.meta.url)
const { PUBLISHED } = await tsImport('../../lib/site/articles.ts', import.meta.url)

const slugs = process.argv[2] ? [process.argv[2]] : PUBLISHED.map((a) => a.slug)
let failed = 0
for (const slug of slugs) {
  const file = `data/articles/${slug}.json`
  if (!existsSync(file)) {
    console.error(`${slug}: no ${file}`)
    failed++
    continue
  }
  let data
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    console.error(`${slug}: not valid JSON (${error.message})`)
    failed++
    continue
  }
  const problems = articleProblems(slug, data)
  if (problems.length) {
    failed++
    console.error(`${slug}: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  } else {
    const a = ArticleContent.parse(data)
    console.log(`${slug}: ${articleWords(a)} words, ${a.sources.length} sources, the rules kept`)
  }
}
process.exit(failed ? 1 : 0)
