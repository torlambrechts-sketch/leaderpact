import { execFileSync } from 'node:child_process'

/**
 * Passes a scan's closing date and runs its close (0010 close_scan), the way scripts/seed/fixture.mjs makes the
 * extended and the closed states: a flow sees each state arrive. A round's the same way (0007 close_round), as
 * supabase/tests/diagnostic_invariants.sql does. A local database only: the URL must name 127.0.0.1 or
 * localhost, and the scan or round is named by its id alone.
 */
const DB = process.env.DB_URL ?? process.env.DATABASE_URL ?? ''
export const canPassDeadline = () => /^postgres(ql)?:\/\/[^@]+@(127\.0\.0\.1|localhost)(:\d+)?\//.test(DB)

/** The scan's phase after its deadline has passed and the close has run: open (extended) or closed */
export function passScanDeadline(scanId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(scanId)) throw new Error('not a scan id')
  const sql = `alter table app.scan_session disable trigger scan_session_fixed;
update app.scan_session set closes_at = now() - interval '1 second' where id = '${scanId}';
alter table app.scan_session enable trigger scan_session_fixed;
select app.close_scan('${scanId}');
select phase from app.scan_session where id = '${scanId}';`
  const out = execFileSync('psql', [DB, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' })
  return out.trim().split('\n').at(-1) ?? ''
}

/** The round's phase after its deadline has passed and the close has run: released, answering (extended) or closed */
export function passRoundDeadline(roundId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(roundId)) throw new Error('not a round id')
  const sql = `alter table app.assessment_round disable trigger assessment_round_fixed;
update app.assessment_round set closes_at = now() - interval '1 second' where id = '${roundId}';
alter table app.assessment_round enable trigger assessment_round_fixed;
select app.close_round('${roundId}');
select phase from app.assessment_round where id = '${roundId}';`
  const out = execFileSync('psql', [DB, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' })
  return out.trim().split('\n').at(-1) ?? ''
}
