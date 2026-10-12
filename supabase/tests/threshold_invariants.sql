-- threshold_invariants.sql — the anonymity threshold is 4, may rise to 8 and is never lowered; a round
-- freezes it when it opens; readers apply the round's own (CLAUDE.md invariant 1; owner C10; REUSE 4.5).
--
--    1  a new organisation's threshold is 4, and so is the threshold in force
--    2  raising it to 6 is accepted and audited: from, to
--    3  lowering it from 6 to 5 is refused, for the table's owner too
--    4  3 and 9 are refused: the bounds are app.k_floor() and app.k_max()
--    5  a client cannot change it at all
--    6  a scheduled round has no threshold; opening freezes the organisation's
--    7  a later raise leaves an open round's threshold alone, and reaches a round opened after it
--    8  an open round's threshold cannot be changed
--    9  readers apply the round's threshold: 5 answers under k 6 give no result
--   10  a scan's threshold is fixed once the scan exists
--   11  a scan whose threshold is above its seats closes full with no team view
--   12  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/threshold_invariants.sql

create unlogged table if not exists public._inv_threshold(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_threshold;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_p uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_diag_ver uuid;
  v_scan_ver uuid;
  v_round uuid := gen_random_uuid();
  v_round2 uuid := gen_random_uuid();
  v_round3 uuid := gen_random_uuid();
  v_scan uuid := gen_random_uuid();
  v_code text := 'thresholdTestCode_000000001';
  v_txt text;
  v_n int;
  v_json jsonb;
  v_answers jsonb;
  v_scan_answers jsonb;
begin
  begin
    select v.id into strict v_diag_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'diagnostic' and v.status = 'published' order by v.version desc limit 1;
    select v.id into strict v_scan_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'scan' and v.status = 'published' order by v.version desc limit 1;
    select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 4) order by vi.ordinal) into v_answers
    from app.instrument_version_item vi where vi.instrument_version_id = v_diag_ver;
    select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 4) order by vi.ordinal) into v_scan_answers
    from app.instrument_version_item vi where vi.instrument_version_id = v_scan_ver;

    insert into auth.users (id, email) select u, 'k-test-' || u || '@example.invalid' from unnest(v_p) u;
    insert into app.person (id, display_name) select u, 'Test person' from unnest(v_p) u;
    insert into app.organisation (id, name) values (v_org, 'Threshold test');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Group');
    insert into app.membership (org_id, team_id, person_id, role)
    select v_org, v_team, u, case when o = 1 then 'leader' else 'member' end from unnest(v_p) with ordinality x (u, o);

    -- 1
    v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'a new organisation''s threshold is 4, and so is the one in force',
      'expected', '4, 4', 'actual', (select threshold from app.organisation where id = v_org) || ', ' || app.k_threshold(v_org),
      'pass', (select threshold from app.organisation where id = v_org) = 4 and app.k_threshold(v_org) = 4);

    -- 6 (before the raise): a scheduled round has none; opening freezes 4 ... then raised below
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org, v_team, 'diagnostic', v_diag_ver, 14, now() - interval '1 minute');
    v_txt := coalesce((select k::text from app.assessment_round where id = v_round), 'none');
    perform app.open_round(v_round);
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'a scheduled round has no threshold; opening freezes the organisation''s',
      'expected', 'none, then 4', 'actual', v_txt || ', then ' || (select k from app.assessment_round where id = v_round),
      'pass', v_txt = 'none' and (select k from app.assessment_round where id = v_round) = 4);

    -- 2
    update app.organisation set threshold = 6 where id = v_org;
    select detail into v_json from app.audit_event where org_id = v_org and kind = 'threshold_raised' order by id desc limit 1;
    v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'raising it to 6 is accepted and audited',
      'expected', '6, audited 4 -> 6', 'actual', app.k_threshold(v_org) || ', audited ' || coalesce(v_json ->> 'from', '?') || ' -> ' || coalesce(v_json ->> 'to', '?'),
      'pass', app.k_threshold(v_org) = 6 and (v_json ->> 'from')::int = 4 and (v_json ->> 'to')::int = 6);

    -- 3
    begin
      update app.organisation set threshold = 5 where id = v_org;
      v_txt := 'accepted';
    exception when check_violation then
      v_txt := 'refused';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'lowering it from 6 to 5 is refused, for the table''s owner too',
      'expected', 'refused, still 6', 'actual', v_txt || ', still ' || (select threshold from app.organisation where id = v_org),
      'pass', v_txt = 'refused' and (select threshold from app.organisation where id = v_org) = 6);

    -- 4
    v_txt := '';
    begin
      insert into app.organisation (name, threshold) values ('Threshold test low', 3);
      v_txt := 'accepted 3';
    exception when check_violation then
      v_txt := 'refused 3';
    end;
    begin
      update app.organisation set threshold = 9 where id = v_org;
      v_txt := v_txt || ', accepted 9';
    exception when check_violation then
      v_txt := v_txt || ', refused 9';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', '3 and 9 are refused: the bounds are k_floor() and k_max()',
      'expected', 'refused 3, refused 9', 'actual', v_txt, 'pass', v_txt = 'refused 3, refused 9');

    -- 5
    perform set_config('request.jwt.claims', json_build_object('sub', v_p[1], 'role', 'authenticated')::text, true);
    begin
      set local role authenticated;
      update app.organisation set threshold = 8 where id = v_org;
      reset role;
      v_txt := 'accepted';
    exception when insufficient_privilege then
      v_txt := 'refused';
    end;
    perform set_config('request.jwt.claims', '', true);
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'a client cannot change the threshold, not even the leader',
      'expected', 'refused, still 6', 'actual', v_txt || ', still ' || (select threshold from app.organisation where id = v_org),
      'pass', v_txt = 'refused' and (select threshold from app.organisation where id = v_org) = 6);

    -- 7
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round2, v_org, v_team, 'pulse', v_diag_ver, 7, now() - interval '1 minute');
    update app.organisation set threshold = 7 where id = v_org;
    v_txt := (select k from app.assessment_round where id = v_round)::text;
    -- the first round must end before the second may open (one open round per group): nobody has
    -- answered, so its first deadline extends it and its second closes it
    v_n := 0;
    while (select phase from app.assessment_round where id = v_round) = 'answering' and v_n < 3 loop
      alter table app.assessment_round disable trigger assessment_round_fixed;
      update app.assessment_round set closes_at = now() - interval '1 second' where id = v_round;
      alter table app.assessment_round enable trigger assessment_round_fixed;
      perform app.close_round(v_round);
      v_n := v_n + 1;
    end loop;
    perform app.open_round(v_round2);
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a later raise leaves an open round''s threshold, and reaches a round opened after it',
      'expected', 'open round 4; round opened after the raise 7', 'actual', 'open round ' || v_txt || '; round opened after the raise '
        || coalesce((select k::text from app.assessment_round where id = v_round2), 'not opened'),
      'pass', v_txt = '4' and (select k from app.assessment_round where id = v_round2) = 7);

    -- 8
    begin
      update app.assessment_round set k = 8 where id = v_round2;
      v_txt := 'accepted';
    exception when check_violation then
      v_txt := 'refused';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'an open round''s threshold cannot be changed',
      'expected', 'refused', 'actual', v_txt, 'pass', v_txt = 'refused');

    -- 9: a group of 5 answers in full, under k 7. The pulse closes first (one open round per group).
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_round2;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    perform app.close_round(v_round2);
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round3, v_org, v_team, 'diagnostic', v_diag_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round3);
    for v_n in 1..5 loop
      perform set_config('request.jwt.claims', json_build_object('sub', v_p[v_n], 'role', 'authenticated')::text, true);
      set local role authenticated;
      perform app.submit_response(v_round3, v_answers);
      reset role;
    end loop;
    perform set_config('request.jwt.claims', json_build_object('sub', v_p[2], 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from app.get_results(v_round3);
    reset role;
    perform set_config('request.jwt.claims', '', true);
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'readers apply the round''s threshold: 5 of 5 answers under k 7 give no result',
      'expected', 'k 7, closed, 0 results, 0 sets', 'actual', 'k ' || (select k from app.assessment_round where id = v_round3) || ', '
        || (select phase from app.assessment_round where id = v_round3) || ', ' || v_n || ' results, '
        || (select count(*) from app.response_set where round_id = v_round3) || ' sets',
      'pass', (select k from app.assessment_round where id = v_round3) = 7 and (select phase from app.assessment_round where id = v_round3) = 'closed'
              and v_n = 0 and (select count(*) from app.response_set where round_id = v_round3) = 0);

    -- 10-11
    insert into app.scan_session (id, org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
    values (v_scan, v_org, v_team, v_scan_ver, v_code, 5, app.k_threshold(v_org), 7, now() - interval '1 day', now() + interval '6 days');
    begin
      update app.scan_session set k = 8 where id = v_scan;
      v_txt := 'accepted';
    exception when check_violation then
      v_txt := 'refused';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'a scan''s threshold is fixed once it exists',
      'expected', 'refused, k 7', 'actual', v_txt || ', k ' || (select k from app.scan_session where id = v_scan),
      'pass', v_txt = 'refused' and (select k from app.scan_session where id = v_scan) = 7);
    set local role anon;
    for v_n in 1..5 loop
      perform app.submit_scan(v_code, v_scan_answers);
    end loop;
    select count(*) into v_n from app.get_team_view_by_code(v_code);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a scan with k 7 and 5 seats closes full, with no team view',
      'expected', 'closed, 0 themes, 0 sets', 'actual', (select phase from app.scan_session where id = v_scan) || ', ' || v_n || ' themes, '
        || (select count(*) from app.scan_response_set where scan_session_id = v_scan) || ' sets',
      'pass', (select phase from app.scan_session where id = v_scan) = 'closed' and v_n = 0
              and (select count(*) from app.scan_response_set where scan_session_id = v_scan) = 0);

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 12
  select count(*) into v_n from app.organisation where name like 'Threshold test%';
  select v_n + count(*) into v_n from auth.users where email like 'k-test-%@example.invalid';
  v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_threshold
  select (r->>'seq')::int, r->>'name', r->>'expected', r->>'actual', (r->>'pass')::boolean
  from jsonb_array_elements(v_rows) r;
end $$;

select seq, name, expected, actual, pass from public._inv_threshold order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_threshold;
  if v_failed is not null then
    raise exception 'threshold invariants failed: %', v_failed;
  end if;
  if v_count <> 12 then
    raise exception 'threshold invariants: expected 12 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_threshold;
