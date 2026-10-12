/**
 * The measurement rules of handoff section 7, as pure functions: level, agreement, standing and change,
 * and the cut-offs they read. The database enforces the release rules again; `cases.json` holds the cases
 * the TypeScript here and the SQL there must both reproduce.
 */
export * from '@/lib/scoring/cutoffs'
export * from '@/lib/scoring/level'
export * from '@/lib/scoring/agreement'
export * from '@/lib/scoring/standing'
export * from '@/lib/scoring/change'
