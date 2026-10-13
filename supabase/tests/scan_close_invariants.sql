-- scan_close_invariants.sql — the scheduled close and the team view's three states (0010; handoff 6.6 and
-- section 7, "When results open"; milestone 5: "the team view appears only at close; the under-4 path
-- gives one extension, then no view").
--
--      1  no client role may run the scheduled job
--      2  a scan not yet due is left open, and the job hands on nothing
--      3  open past its date but not yet closed by the job: still no team view, by link or by membership
--      4  due with 5 answers: released with one score per theme, readable by link and by membership
--      5  the released team view carries levels to one decimal and a label, never the agreement number
--      6  due with 3 answers and seats left: extended once, by 7 days, answers kept, no team view
--      7  due again after the extension: closed with no team view, answers and replace keys deleted
--      8  a closed or released scan is not touched again
--      9  where pg_cron exists, the job is scheduled every five minutes, once
--     10  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Deadlines are passed by moving a
-- closing date back with the session's guard trigger off for that one statement: now() does not advance
-- inside one transaction. Everything is rolled back.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/scan_close_invariants.sql

create unlogged table if not exists public._inv_scan_close(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_scan_close;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_leader uuid := gen_random_uuid();
  v_version uuid;
  v_wait uuid := gen_random_uuid();
  v_full uuid := gen_random_uuid();
  v_short uuid := gen_random_uuid();
  c_wait constant text := 'scanCloseTestWait00000001';
  c_full constant text := 'scanCloseTestFull00000001';
  c_short constant text := 'scanCloseTestShort0000001';
  v_answers jsonb[] := '{}';
  v_json jsonb;
  v_n int;
  v_m int;
  v_k int;
  v_txt text;
  v_ok boolean;
  v_closes timestamptz;
  r record;
begin
  -- 1 -------------------------------------------------------------- nobody but the job
  select count(*) into v_n from unnest(array['anon', 'authenticated']) role
  where has_function_privilege(role, 'app.close_due_scans()', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'no client role may run the scheduled job',
    'expected', '0 grants', 'actual', v_n || ' grants', 'pass', v_n = 0);

  begin
    select v.id into strict v_version from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'scan' and v.status = 'published' order by v.version desc limit 1;
    insert into auth.users (id, email) values (v_leader, 'scan-close-test-leader@example.invalid');
    insert into app.person (id, display_name) values (v_leader, 'Scan close test leader');
    insert into app.organisation (id, name) values (v_org, 'Scan close test');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Scan close test group');
    insert into app.membership (org_id, team_id, person_id, role) values (v_org, v_team, v_leader, 'leader');
    insert into app.scan_session (id, org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
    values (v_wait, v_org, v_team, v_version, c_wait, 8, 4, 7, now() - interval '1 day', now() + interval '6 days'),
           (v_full, v_org, v_team, v_version, c_full, 8, 4, 7, now() - interval '1 day', now() + interval '6 days'),
           (v_short, v_org, v_team, v_version, c_short, 8, 4, 7, now() - interval '1 day', now() + interval '6 days');
    for v_n in 1..6 loop
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 1 + (v_n + vi.ordinal) % 5) order by vi.ordinal)
        into v_json from app.instrument_version_item vi where vi.instrument_version_id = v_version;
      v_answers := v_answers || v_json;
    end loop;
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    for v_n in 1..5 loop perform app.submit_scan(c_full, v_answers[v_n]); end loop;
    for v_n in 1..3 loop perform app.submit_scan(c_short, v_answers[v_n]); end loop;
    perform app.submit_scan(c_wait, v_answers[1]);
    reset role;

    -- 2 ------------------------------------------------------------ not yet due
    v_n := app.close_due_scans();
    select count(*) into v_m from app.scan_session where org_id = v_org and phase = 'open';
    v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'a scan not yet due is left open, and the job hands on nothing',
      'expected', '0 handed on, 3 open', 'actual', v_n || ' handed on, ' || v_m || ' open', 'pass', v_n = 0 and v_m = 3);

    -- 3 ------------------------------------------------------------ past its date, before the job
    alter table app.scan_session disable trigger scan_session_fixed;
    update app.scan_session set closes_at = now() - interval '1 second' where id in (v_full, v_short);
    alter table app.scan_session enable trigger scan_session_fixed;
    perform set_config('request.jwt.claims', json_build_object('sub', v_leader, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from app.get_team_view(v_full);
    reset role;
    set local role anon;
    select count(*) into v_m from app.get_team_view_by_code(c_full);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'past its date but not yet closed: still no team view',
      'expected', '0 by membership, 0 by link', 'actual', v_n || ' by membership, ' || v_m || ' by link', 'pass', v_n = 0 and v_m = 0);

    -- 4 ------------------------------------------------------------ due with 5 answers: released
    v_k := app.close_due_scans();
    set local role anon;
    select count(*) into v_n from app.get_team_view_by_code(c_full);
    reset role;
    set local role authenticated;
    select count(*) into v_m from app.get_team_view(v_full);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'due with 5 answers: released, one score per theme, by link and by membership',
      'expected', '2 handed on, released, 6 by link, 6 by membership',
      'actual', v_k || ' handed on, ' || (select phase from app.scan_session where id = v_full) || ', ' || v_n || ' by link, ' || v_m || ' by membership',
      'pass', v_k = 2 and (select phase from app.scan_session where id = v_full) = 'released' and v_n = 6 and v_m = 6);

    -- 5 ------------------------------------------------------------ what the team view carries
    set local role anon;
    select bool_and(v.level = round(v.level, 1) and v.level between 1 and 5 and v.agreement in ('high', 'medium', 'low') and v.n = 5)
      into v_ok from app.get_team_view_by_code(c_full) v;
    reset role;
    select string_agg(x, ',' order by o) into v_txt
    from unnest((select proargnames from pg_proc where oid = 'app.get_team_view_by_code(text)'::regprocedure)) with ordinality u (x, o)
    where o > 1;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'levels to one decimal and a label, never the agreement number',
      'expected', 'true; theme_key,theme_name,ordinal,level,agreement,n', 'actual', coalesce(v_ok::text, 'null') || '; ' || v_txt,
      'pass', v_ok and v_txt = 'theme_key,theme_name,ordinal,level,agreement,n');

    -- 6 ------------------------------------------------------------ due with 3 answers: one extension
    select closes_at into v_closes from app.scan_session where id = v_short;
    select count(*) into v_n from app.scan_response_set where scan_session_id = v_short;
    set local role anon;
    select count(*) into v_m from app.get_team_view_by_code(c_short);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'due with 3 answers and seats left: extended once by 7 days, answers kept, no view',
      'expected', 'open, extended, +7 days, 3 sets, 0 themes',
      'actual', (select phase || ', extended ' || extended from app.scan_session where id = v_short) || ', +'
        || extract(day from v_closes - now())::int || ' days, ' || v_n || ' sets, ' || v_m || ' themes',
      'pass', (select phase = 'open' and extended from app.scan_session where id = v_short)
              and v_closes between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' + interval '1 minute'
              and v_n = 3 and v_m = 0);

    -- 7 ------------------------------------------------------------ due again: no team view, answers gone
    alter table app.scan_session disable trigger scan_session_fixed;
    update app.scan_session set closes_at = now() - interval '1 second' where id = v_short;
    alter table app.scan_session enable trigger scan_session_fixed;
    v_k := app.close_due_scans();
    select count(*) into v_n from app.scan_response_set where scan_session_id = v_short;
    select count(*) into v_m from app.scan_replace_key where scan_session_id = v_short;
    set local role anon;
    select v_m * 100 + count(*) into v_m from app.get_team_view_by_code(c_short);
    select phase into v_txt from app.get_scan_invite(c_short);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'due again: closed with no team view, answers and keys deleted',
      'expected', '1 handed on, closed, 0 sets, 0 keys and 0 themes', 'actual', v_k || ' handed on, ' || v_txt || ', ' || v_n || ' sets, ' || v_m,
      'pass', v_k = 1 and v_txt = 'closed' and v_n = 0 and v_m = 0);

    -- 8 ------------------------------------------------------------ closed scans stay as they are
    select count(*) into v_n from app.scan_theme_score where scan_session_id = v_full;
    alter table app.scan_session disable trigger scan_session_fixed;
    update app.scan_session set closes_at = now() - interval '2 seconds' where id = v_wait;
    alter table app.scan_session enable trigger scan_session_fixed;
    v_k := app.close_due_scans();
    v_k := v_k * 10 + app.close_due_scans();
    select count(*) into v_m from app.scan_theme_score where scan_session_id = v_full;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'a closed or released scan is not touched again',
      'expected', 'only the last open one: 10, snapshot 6 then 6, still released and closed',
      'actual', v_k || ', snapshot ' || v_n || ' then ' || v_m || ', '
        || (select string_agg(phase, ' and ' order by phase desc) from app.scan_session where id in (v_full, v_short)),
      'pass', v_k = 10 and v_n = 6 and v_m = 6
              and (select phase from app.scan_session where id = v_full) = 'released'
              and (select phase from app.scan_session where id = v_short) = 'closed');

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 9 -------------------------------------------------------------- the schedule
  if to_regclass('cron.job') is null then
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'where pg_cron exists, the job runs every five minutes, once',
      'expected', 'scheduled, or no pg_cron here', 'actual', 'no pg_cron here', 'pass', true);
  else
    execute $q$select count(*) from cron.job where jobname = 'leaderpact-close-due-scans'
               and schedule = '*/5 * * * *' and command = 'select app.close_due_scans()'$q$ into v_n;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'where pg_cron exists, the job runs every five minutes, once',
      'expected', '1 job', 'actual', v_n || ' job', 'pass', v_n = 1);
  end if;

  -- 10 ------------------------------------------------------------- nothing survives
  select count(*) into v_n from app.organisation where name = 'Scan close test';
  select v_n + count(*) into v_n from auth.users where email like 'scan-close-test-%@example.invalid';
  v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_scan_close
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_scan_close order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_scan_close;
  if v_failed is not null then
    raise exception 'scan close invariants failed: %', v_failed;
  end if;
  if v_count <> 10 then
    raise exception 'scan close invariants: expected 10 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_scan_close;
