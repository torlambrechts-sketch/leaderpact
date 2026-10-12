/**
 * A level on the five-point scale, drawn as a bar: its width is (level − 1) ÷ 4, so 1 is empty and 5 is
 * full (handoff section 4, LevelBar). Shown to one decimal (handoff section 7).
 */
export function levelWidth(level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.max(0, Math.min(1, (level - 1) / 4))
}

/**
 * A level the database has already rounded (a snapshot's numeric(2,1)), written with its one decimal. It
 * does not round a mean: floating point rounds 4.35 down. To compute a level, use lib/scoring, which
 * works in integer tenths exactly as the SQL does.
 */
export function levelText(level: number): string {
  return level.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
