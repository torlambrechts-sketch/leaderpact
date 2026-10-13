-- 0010_scan_close.sql — the scheduled job that closes a scan on its date (handoff 6.4, 6.6 and 8: "a
-- scheduled job opens pulses, sends reminders and closes rounds"; milestone 5).
--
-- 1. **A scan closes on its own in two ways.** At the last seat, inside the answer's transaction
--    (`submit_scan`, 0006). On its date, here: `close_due_scans` hands every open scan whose closing date
--    has passed to `close_scan` (0006), which decides once: the snapshot and the reshuffle at or above k;
--    below k one 7-day extension while seats are left; then no team view and the answers deleted (owner
--    C9). Nothing here decides anything `close_scan` does not.
-- 2. **Nobody but the job runs it.** No client role is granted it (0001), and the leader cannot close
--    early (handoff 6.4). It runs as the job's owner.
-- 3. **pg_cron runs it every five minutes**, where the extension exists: on Supabase, hosted and in CI.
--    A plain PostgreSQL (scripts/qa/local-pg.sh) has no pg_cron; there the function exists and nothing
--    schedules it, and the suites call it themselves. The job's log records that it ran and how many
--    scans it handed on: a count, never an answer (CLAUDE.md invariant 10).
-- 4. **A scan locked by an answer is passed over** this time (`skip locked`) and taken on the next run, so
--    the job never waits on a member's submission, and the two never close one scan twice.

create function app.close_due_scans() returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_n int := 0;
begin
  for v_id in
    select ss.id from app.scan_session ss
    where ss.phase = 'open' and ss.closes_at <= now()
    order by ss.closes_at
    for update skip locked
  loop
    perform app.close_scan(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
comment on function app.close_due_scans() is
  'The scheduled job: every open scan past its closing date goes to close_scan. Returns how many. No client may run it.';

do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    grant usage on schema cron to postgres;
    -- by name, so applying this again replaces the job rather than adding a second
    perform cron.schedule('leaderpact-close-due-scans', '*/5 * * * *', 'select app.close_due_scans()');
  end if;
end $$;
