import quick from '@/data/profile/quick.v1.json'
import full from '@/data/profile/full.v1.json'

/**
 * Where each published test comes from (D-32): the citation and the IPIP page its items were read from, as the
 * data files that seed the rows record them. The public page lists them under its sources (D-62). A test
 * version with no file here shows no citation, rather than another version's.
 */
const SOURCES = [quick, full].map((d) => ({ key: d.key, version: d.version, citation: d.source.citation, url: d.source.items }))

export function testSource(key: string, version: number): { citation: string; url: string } | null {
  const found = SOURCES.find((s) => s.key === key && s.version === version)
  return found ? { citation: found.citation, url: found.url } : null
}
