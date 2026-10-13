/**
 * The countries a company may be billed in, named in British English (handoff 6.18: "Tax follows the
 * customer's country"). The codes are ISO 3166-1 alpha-2, read from the runtime's own region names, so no
 * list is kept here: every two-letter code the runtime names is a choice, except the groupings and the
 * placeholders that are not countries.
 */
// groupings, pseudo-regions, codes reserved for other uses, and withdrawn codes the runtime still names
const NOT_COUNTRIES = new Set([
  'EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ',
  'AC', 'CP', 'DG', 'EA', 'IC', 'TA',
  'AN', 'BU', 'CS', 'DD', 'FX', 'NT', 'SU', 'TP', 'YD', 'YU', 'ZR',
])

let cached: { code: string; name: string }[] | null = null

export function countries(): { code: string; name: string }[] {
  if (cached) return cached
  const names = new Intl.DisplayNames(['en-GB'], { type: 'region', fallback: 'none' })
  const out: { code: string; name: string }[] = []
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      if (NOT_COUNTRIES.has(code)) continue
      const name = names.of(code)
      if (name && name !== code) out.push({ code, name })
    }
  }
  cached = out.sort((x, y) => x.name.localeCompare(y.name, 'en-GB'))
  return cached
}

export const countryName = (code: string): string => new Intl.DisplayNames(['en-GB'], { type: 'region', fallback: 'code' }).of(code) ?? code
