-- anonymity_invariants.sql — "anonymous by construction" and "nothing before close", proved against a live
-- schema (CLAUDE.md invariants 2 to 6; handoff 13, Anonymity, in the database).
--
--    1-6  the catalogue firewall (app.anonymity_firewall), one row per rule
--      7  anon cannot select any answer table
--      8  a member cannot select any answer table
--      9  the leader cannot select any answer table
--     10  service_role (staff) cannot select any answer table, scores included
--     11  no client role may open or close a round or close a scan: the leader cannot close early
--     12  a submission returns {ok} and a replace key, never an id
--     13  the same browser replaces its answers and keeps its one slot (owner C2)
--     14  an open scan shows a count and no team view
--     15  the last seat closes the scan at once: team view released, keys gone, the next answer refused
--     16  closing re-inserts every scan response set under a new id (owner C3)
--     17  a scan with 3 answers is extended once, at its first deadline
--     18  then it closes with no team view, and its answers are deleted (owner C9)
--     19  a round invites the current members only: an ended membership is not asked
--     20  a person whose membership has ended reads nothing of the group
--     21  get_results returns nothing for an open round, even at or above the threshold
--     22  a second submission, an outsider, a missing item and a value out of range are refused
--     23  a member reads the count of answers, an outsider does not
--     24  the last answer closes the round: results and item levels released to members
--     25  after close no transaction id or set id links participation to a response set
--     26  a member of group B reads nothing of group A
--     27  a result carries labels only: the agreement number is not a column a reader returns
--     28  a diagnostic with 3 answers: one extension, then no result, answers deleted (owner C9)
--     29  a pulse with 3 answers closes as missed, without an extension, its agreement answers gone with it
--     30  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. The suite builds its own two
-- organisations inside a block that is rolled back, so it depends on no fixture and leaves nothing.
-- Deadlines are passed by moving a closing date back with the round's guard trigger switched off for
-- that one statement: now() does not advance inside one transaction.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/anonymity_invariants.sql

create unlogged table if not exists public._inv_anonymity(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_anonymity;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_answer constant text[] := array['response_set', 'response', 'participation', 'factor_score', 'item_score',
                                    'scan_response_set', 'scan_response', 'scan_replace_key', 'scan_theme_score',
                                    'agreement_response', 'agreement_score'];
  v_t text;
  v_n int;
  v_links int;
  v_m int;
  v_ok boolean;
  v_txt text;
  v_json jsonb;
  v_keys text[];
  v_ids uuid[];
  r record;
  -- people, groups, versions
  v_org_a uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();
  v_team_a uuid := gen_random_uuid();
  v_team_b uuid := gen_random_uuid();
  v_a uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_b uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_gone uuid := gen_random_uuid();
  v_scan_ver uuid;
  v_diag_ver uuid;
  v_scan_a uuid := gen_random_uuid();
  v_scan_b uuid := gen_random_uuid();
  v_code_a text := 'anonymityTestCodeA_0000000001';
  v_code_b text := 'anonymityTestCodeB_0000000001';
  v_round uuid := gen_random_uuid();
  v_round2 uuid := gen_random_uuid();
  v_pulse uuid := gen_random_uuid();
  v_charter uuid := gen_random_uuid();
  v_agreement uuid := gen_random_uuid();
  v_scan_answers jsonb[] := '{}';
  v_diag_answers jsonb[] := '{}';
  v_replace text[] := '{}';
begin
  -- 1-6 ------------------------------------------------------------ the firewall
  for r in select * from app.anonymity_firewall() loop
    v_rows := v_rows || jsonb_build_object('seq', r.seq, 'name', 'firewall: ' || r.rule, 'expected', 'pass',
      'actual', r.evidence::text, 'pass', r.pass);
  end loop;

  begin
    -- ------------------------------------------------------------ the fixture, rolled back at the end
    select v.id into strict v_scan_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'scan' and v.status = 'published' order by v.version desc limit 1;
    select v.id into strict v_diag_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'diagnostic' and v.status = 'published' order by v.version desc limit 1;

    insert into auth.users (id, email)
    select u, 'anon-test-' || u || '@example.invalid' from unnest(v_a || v_b || v_gone) u;
    insert into app.person (id, display_name) select u, 'Test person' from unnest(v_a || v_b || v_gone) u;
    insert into app.organisation (id, name) values (v_org_a, 'Anonymity test A'), (v_org_b, 'Anonymity test B');
    insert into app.team (id, org_id, name) values (v_team_a, v_org_a, 'Group A'), (v_team_b, v_org_b, 'Group B');
    insert into app.membership (org_id, team_id, person_id, role)
    select v_org_a, v_team_a, u, case when o = 1 then 'leader' else 'member' end from unnest(v_a) with ordinality x (u, o);
    insert into app.membership (org_id, team_id, person_id, role)
    select v_org_b, v_team_b, u, case when o = 1 then 'leader' else 'member' end from unnest(v_b) with ordinality x (u, o);
    -- a member of A whose membership ended yesterday
    insert into app.membership (org_id, team_id, person_id, role, valid_from, valid_to)
    values (v_org_a, v_team_a, v_gone, 'member', now() - interval '30 days', now() - interval '1 day');

    -- answers: one payload per person, varied so agreement is not trivially high
    for v_n in 1..8 loop
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 1 + (v_n + vi.ordinal) % 5) order by vi.ordinal)
        into v_json from app.instrument_version_item vi where vi.instrument_version_id = v_scan_ver;
      v_scan_answers := v_scan_answers || v_json;
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 1 + (v_n * vi.ordinal) % 5) order by vi.ordinal)
        into v_json from app.instrument_version_item vi where vi.instrument_version_id = v_diag_ver;
      v_diag_answers := v_diag_answers || v_json;
    end loop;

    -- 7-10 ------------------------------------------------------ no role selects an answer table
    for r in select * from (values (7, 'anon', null::uuid, 'anon'), (8, 'authenticated', v_a[2], 'a member'),
                                   (9, 'authenticated', v_a[1], 'the leader'), (10, 'service_role', null::uuid, 'service_role (staff)')) x (seq, role, sub, who) loop
      perform set_config('request.jwt.claims', coalesce(json_build_object('sub', r.sub, 'role', r.role)::text, ''), true);
      v_n := 0;
      foreach v_t in array v_answer loop
        begin
          execute format('set local role %I', r.role);
          execute format('select count(*) from app.%I', v_t);
          reset role;
        exception when insufficient_privilege then
          v_n := v_n + 1;
        end;
      end loop;
      v_rows := v_rows || jsonb_build_object('seq', r.seq, 'name', r.who || ' cannot select any answer table',
        'expected', cardinality(v_answer) || ' refused', 'actual', v_n || ' refused', 'pass', v_n = cardinality(v_answer));
    end loop;
    perform set_config('request.jwt.claims', '', true);

    -- 11 --------------------------------------------------------- nobody but the scheduled job opens or closes
    select count(*) into v_n
    from unnest(array['anon', 'authenticated']) role
    cross join unnest(array['app.open_round(uuid)', 'app.close_round(uuid)', 'app.close_scan(uuid)']) fn
    where has_function_privilege(role, fn, 'execute');
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'no client may open or close a round or close a scan',
      'expected', '0 grants', 'actual', v_n || ' grants', 'pass', v_n = 0);

    -- the scan of group A: 6 seats, k 4
    insert into app.scan_session (id, org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
    values (v_scan_a, v_org_a, v_team_a, v_scan_ver, v_code_a, 6, app.k_threshold(v_org_a), 7, now() - interval '1 day', now() + interval '6 days');

    -- 12 --------------------------------------------------------- what a submission returns
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    v_json := app.submit_scan(v_code_a, v_scan_answers[1]);
    reset role;
    v_replace := v_replace || (v_json ->> 'replace_key');
    select array_agg(k order by k) into v_keys from jsonb_object_keys(v_json) k;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'a submission returns ok and a replace key, never an id',
      'expected', '{ok,replace_key}, ok true, a key', 'actual', v_keys::text || ', ok ' || (v_json ->> 'ok') || ', key ' || coalesce(length(v_replace[1]), 0),
      'pass', v_keys = array['ok', 'replace_key'] and (v_json ->> 'ok')::boolean and length(v_replace[1]) >= 40);

    -- 13 --------------------------------------------------------- the same browser replaces, in its own slot
    set local role anon;
    v_json := app.submit_scan(v_code_a, v_scan_answers[2]);
    v_replace := v_replace || (v_json ->> 'replace_key');
    v_json := app.submit_scan(v_code_a, v_scan_answers[3], v_replace[1]);
    reset role;
    select count(*) into v_n from app.scan_response_set where scan_session_id = v_scan_a;
    select count(*) into v_m from app.scan_replace_key where scan_session_id = v_scan_a;
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'a replacement keeps one set and one slot (owner C2)',
      'expected', 'ok, 2 answered, 2 sets, 2 keys', 'actual', (v_json ->> 'ok') || ', ' || (select answered from app.scan_session where id = v_scan_a)
        || ' answered, ' || v_n || ' sets, ' || v_m || ' keys',
      'pass', (v_json ->> 'ok')::boolean and (select answered from app.scan_session where id = v_scan_a) = 2 and v_n = 2 and v_m = 2);

    -- 14 --------------------------------------------------------- open: a count, no team view
    perform set_config('request.jwt.claims', json_build_object('sub', v_a[2], 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from app.get_team_view(v_scan_a);
    reset role;
    set local role anon;
    select count(*) into v_m from app.get_team_view_by_code(v_code_a);
    select answered into strict v_ok from (select s.answered = 2 as answered from app.get_scan_status_by_code(v_code_a) s) x;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'an open scan shows the count and no team view',
      'expected', '0 rows by membership, 0 by link, count 2', 'actual', v_n || ' by membership, ' || v_m || ' by link, count 2: ' || v_ok,
      'pass', v_n = 0 and v_m = 0 and v_ok);

    -- 15-16 ------------------------------------------------------ the last seat closes the scan
    set local role anon;
    perform app.submit_scan(v_code_a, v_scan_answers[4]);
    perform app.submit_scan(v_code_a, v_scan_answers[5]);
    perform app.submit_scan(v_code_a, v_scan_answers[6]);
    reset role;
    select array_agg(id) into v_ids from app.scan_response_set where scan_session_id = v_scan_a;
    set local role anon;
    v_json := app.submit_scan(v_code_a, v_scan_answers[7]);
    select count(*) into v_n from app.get_team_view_by_code(v_code_a);
    v_txt := app.submit_scan(v_code_a, v_scan_answers[8]) ->> 'reason';
    reset role;
    select count(*) into v_m from app.scan_replace_key where scan_session_id = v_scan_a;
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'the last seat closes the scan: released, keys gone, next refused',
      'expected', 'released, 6 themes, 0 keys, closed', 'actual',
        (select phase from app.scan_session where id = v_scan_a) || ', ' || v_n || ' themes, ' || v_m || ' keys, ' || coalesce(v_txt, 'accepted'),
      'pass', (select phase from app.scan_session where id = v_scan_a) = 'released' and v_n = 6 and v_m = 0 and v_txt = 'closed');
    select count(*), count(*) filter (where id = any (v_ids)) into v_n, v_m from app.scan_response_set where scan_session_id = v_scan_a;
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'closing re-inserts every scan response set under a new id (owner C3)',
      'expected', '6 sets, 0 old ids', 'actual', v_n || ' sets, ' || v_m || ' old ids', 'pass', v_n = 6 and v_m = 0);

    -- 17-18 ------------------------------------------------------ the scan of group B: 3 answers of 4
    insert into app.scan_session (id, org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
    values (v_scan_b, v_org_b, v_team_b, v_scan_ver, v_code_b, 4, app.k_threshold(v_org_b), 7, now() - interval '8 days', now() + interval '1 hour');
    set local role anon;
    perform app.submit_scan(v_code_b, v_scan_answers[1]);
    perform app.submit_scan(v_code_b, v_scan_answers[2]);
    perform app.submit_scan(v_code_b, v_scan_answers[3]);
    reset role;
    alter table app.scan_session disable trigger scan_session_fixed;
    update app.scan_session set closes_at = now() - interval '1 second' where id = v_scan_b;
    alter table app.scan_session enable trigger scan_session_fixed;
    v_txt := app.close_scan(v_scan_b);
    v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'a scan with 3 answers is extended once at its deadline',
      'expected', 'open, extended, closes later', 'actual', v_txt || ', extended ' || (select extended from app.scan_session where id = v_scan_b)
        || ', closes later ' || (select closes_at > now() from app.scan_session where id = v_scan_b),
      'pass', v_txt = 'open' and (select extended and closes_at > now() from app.scan_session where id = v_scan_b));
    alter table app.scan_session disable trigger scan_session_fixed;
    update app.scan_session set closes_at = now() - interval '1 second' where id = v_scan_b;
    alter table app.scan_session enable trigger scan_session_fixed;
    v_txt := app.close_scan(v_scan_b);
    perform set_config('request.jwt.claims', json_build_object('sub', v_b[1], 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from app.get_team_view(v_scan_b);
    reset role;
    set local role anon;
    select v_n + count(*) into v_n from app.get_team_view_by_code(v_code_b);
    reset role;
    select count(*) into v_m from app.scan_response_set where scan_session_id = v_scan_b;
    v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'then no team view, and the answers are deleted (owner C9)',
      'expected', 'closed, 0 rows, 0 sets', 'actual', v_txt || ', ' || v_n || ' rows, ' || v_m || ' sets',
      'pass', v_txt = 'closed' and v_n = 0 and v_m = 0);

    -- 19 --------------------------------------------------------- a diagnostic round for group A
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org_a, v_team_a, 'diagnostic', v_diag_ver, 14, now() - interval '1 minute');
    v_n := app.open_round(v_round);
    v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'a round invites the current members only',
      'expected', '6 invited, the ended member not asked', 'actual', v_n || ' invited, ended member asked: '
        || exists (select 1 from app.participation where round_id = v_round and person_id = v_gone),
      'pass', v_n = 6 and not exists (select 1 from app.participation where round_id = v_round and person_id = v_gone));

    -- 20 --------------------------------------------------------- an ended membership reads nothing
    perform set_config('request.jwt.claims', json_build_object('sub', v_gone, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select (select count(*) from app.team where id = v_team_a) + (select count(*) from app.assessment_round where team_id = v_team_a)
         + (select count(*) from app.membership where team_id = v_team_a) + (select count(*) from app.get_participation_count(v_round))
         + (select count(*) from app.get_team_view(v_scan_a)) + (select count(*) from app.scan_session where team_id = v_team_a)
      into v_n;
    v_txt := app.get_scan_link(v_scan_a);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 20, 'name', 'a person whose membership has ended reads nothing of the group',
      'expected', '0 rows, no link', 'actual', v_n || ' rows, link ' || coalesce(v_txt, 'none'), 'pass', v_n = 0 and v_txt is null);

    -- 21 --------------------------------------------------------- nothing before close
    -- each submission in a subtransaction of its own, so its rows carry a transaction id of their own, as
    -- each request's would in production; test 25 depends on it
    for v_n in 1..5 loop
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', v_a[v_n], 'role', 'authenticated')::text, true);
        set local role authenticated;
        perform app.submit_response(v_round, v_diag_answers[v_n]);
        reset role;
      exception when division_by_zero then null;
      end;
    end loop;
    perform set_config('request.jwt.claims', json_build_object('sub', v_a[2], 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from app.get_results(v_round);
    select count(*) into v_m from app.get_item_results(v_round);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 21, 'name', 'get_results returns nothing for an open round with 5 of 6 answers',
      'expected', '0 scales, 0 items', 'actual', v_n || ' scales, ' || v_m || ' items', 'pass', v_n = 0 and v_m = 0);

    -- 22 --------------------------------------------------------- what is refused
    set local role authenticated;
    v_txt := app.submit_response(v_round, v_diag_answers[2]) ->> 'reason';
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', v_b[1], 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_txt := v_txt || ', ' || (app.submit_response(v_round, v_diag_answers[1]) ->> 'reason');
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', v_a[6], 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_txt := v_txt || ', ' || (app.submit_response(v_round, (select jsonb_agg(e) from jsonb_array_elements(v_diag_answers[6]) with ordinality x (e, o) where o > 1)) ->> 'reason');
    v_txt := v_txt || ', ' || (app.submit_response(v_round, jsonb_set(v_diag_answers[6], '{0,value}', '6')) ->> 'reason');
    v_txt := v_txt || ', ' || (app.submit_response(v_round, v_diag_answers[6] || (v_diag_answers[6] -> 0)) ->> 'reason');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 22, 'name', 'refused: a second submission, an outsider, a missing item (C8), a value of 6, a duplicate',
      'expected', 'already_answered, not_invited, invalid, invalid, invalid', 'actual', v_txt,
      'pass', v_txt = 'already_answered, not_invited, invalid, invalid, invalid'
              and not exists (select 1 from app.participation where round_id = v_round and person_id = v_a[6] and answered));

    -- 23 --------------------------------------------------------- counts, for members only
    perform set_config('request.jwt.claims', json_build_object('sub', v_a[3], 'role', 'authenticated')::text, true);
    set local role authenticated;
    select c.invited || ' of ' || c.answered into v_txt from app.get_participation_count(v_round) c;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', v_b[1], 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from app.get_participation_count(v_round);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 23, 'name', 'a member reads the count of answers; an outsider reads nothing',
      'expected', 'invited 6 of answered 5; outsider 0 rows', 'actual', 'invited ' || coalesce(v_txt, 'none') || '; outsider ' || v_n || ' rows',
      'pass', v_txt = '6 of 5' and v_n = 0);

    -- 24 --------------------------------------------------------- the last answer closes and releases
    select array_agg(id) into v_ids from app.response_set where round_id = v_round;
    -- the link that exists while a round is open (the residual of owner C3): each answered person's
    -- participation row shares its transaction id with exactly one response set
    select count(*) into v_links from app.participation p join app.response_set rs on rs.xmin = p.xmin and rs.round_id = p.round_id
    where p.round_id = v_round and p.answered;
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', v_a[6], 'role', 'authenticated')::text, true);
      set local role authenticated;
      v_json := app.submit_response(v_round, v_diag_answers[6]);
      reset role;
    exception when division_by_zero then null;
    end;
    set local role authenticated;
    select count(*) into v_n from app.get_results(v_round);
    select count(*) into v_m from app.get_item_results(v_round);
    reset role;
    select array_agg(k order by k) into v_keys from jsonb_object_keys(v_json) k;
    v_rows := v_rows || jsonb_build_object('seq', 24, 'name', 'the last answer closes the round: {ok}, released, 24 scales and 72 items',
      'expected', '{ok}, released, 24 scales, 72 items', 'actual', v_keys::text || ', ' || (select phase from app.assessment_round where id = v_round)
        || ', ' || v_n || ' scales, ' || v_m || ' items',
      'pass', v_keys = array['ok'] and (select phase from app.assessment_round where id = v_round) = 'released' and v_n = 24 and v_m = 72);

    -- 25 --------------------------------------------------------- no link after close
    select count(distinct x.xmin::text) into v_n from (
      select p.xmin from app.participation p where p.round_id = v_round
      union all select rs.xmin from app.response_set rs where rs.round_id = v_round) x;
    select count(*) filter (where id = any (v_ids)) into v_m from app.response_set where round_id = v_round;
    v_rows := v_rows || jsonb_build_object('seq', 25, 'name', 'open: each answer linked by transaction id; closed: one id spans all, and no set keeps its id',
      'expected', '5 links open; 1 xmin, 0 old ids, 6 answered, 6 sets', 'actual', v_links || ' links open; ' || v_n || ' xmin, ' || v_m || ' old ids, '
        || (select count(*) from app.participation where round_id = v_round and answered) || ' answered, '
        || (select count(*) from app.response_set where round_id = v_round) || ' sets',
      'pass', v_links = 5 and v_n = 1 and v_m = 0 and (select count(*) from app.participation where round_id = v_round and answered) = 6
              and (select count(*) from app.response_set where round_id = v_round) = 6);

    -- 26 --------------------------------------------------------- group B reads nothing of group A
    perform set_config('request.jwt.claims', json_build_object('sub', v_b[1], 'role', 'authenticated')::text, true);
    set local role authenticated;
    select (select count(*) from app.get_results(v_round)) + (select count(*) from app.get_item_results(v_round))
         + (select count(*) from app.get_participation_count(v_round)) + (select count(*) from app.get_team_view(v_scan_a))
         + (select count(*) from app.team where id = v_team_a) + (select count(*) from app.assessment_round where team_id = v_team_a)
         + (select count(*) from app.membership where team_id = v_team_a) + (select count(*) from app.organisation where id = v_org_a)
         + (select count(*) from app.person where id = any (v_a)) + (select count(*) from app.scan_session where team_id = v_team_a)
      into v_n;
    v_txt := app.get_scan_link(v_scan_a);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 26, 'name', 'a member of group B reads nothing of group A',
      'expected', '0 rows, no link', 'actual', v_n || ' rows, link ' || coalesce(v_txt, 'none'), 'pass', v_n = 0 and v_txt is null);

    -- 27 --------------------------------------------------------- labels only
    select string_agg(a.name || ' ' || format_type(a.type, null), ', ' order by a.ord) into v_txt
    from pg_proc p cross join lateral unnest(p.proargnames, p.proallargtypes, p.proargmodes) with ordinality a (name, type, mode, ord)
    where p.oid = 'app.get_results(uuid)'::regprocedure and a.mode = 't';
    select count(*) into v_n from pg_proc p cross join lateral unnest(p.proallargtypes) t
    where p.oid = 'app.get_results(uuid)'::regprocedure and t = 'numeric'::regtype;
    v_rows := v_rows || jsonb_build_object('seq', 27, 'name', 'get_results returns the agreement as a label, never its number',
      'expected', 'agreement text, level the only numeric', 'actual', v_txt,
      'pass', v_txt like '%agreement text%' and v_txt like '%level numeric%' and v_n = 1);

    -- 28 --------------------------------------------------------- a diagnostic with 3 answers
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round2, v_org_a, v_team_a, 'diagnostic', v_diag_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round2);
    for v_n in 1..3 loop
      perform set_config('request.jwt.claims', json_build_object('sub', v_a[v_n], 'role', 'authenticated')::text, true);
      set local role authenticated;
      perform app.submit_response(v_round2, v_diag_answers[v_n]);
      reset role;
    end loop;
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_round2;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    v_txt := app.close_round(v_round2);
    v_ok := (select extended from app.assessment_round where id = v_round2);
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_round2;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    v_txt := v_txt || ', extended ' || v_ok || ', then ' || app.close_round(v_round2);
    perform set_config('request.jwt.claims', json_build_object('sub', v_a[2], 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from app.get_results(v_round2);
    reset role;
    select count(*) into v_m from app.response_set where round_id = v_round2;
    v_rows := v_rows || jsonb_build_object('seq', 28, 'name', 'a diagnostic with 3 answers: one extension, then no result, answers deleted',
      'expected', 'answering, extended true, then closed; 0 results; 0 sets', 'actual', v_txt || '; ' || v_n || ' results; ' || v_m || ' sets',
      'pass', v_txt = 'answering, extended true, then closed' and v_n = 0 and v_m = 0);

    -- 29 --------------------------------------------------------- a pulse with 3 answers
    -- its questions written before it opens (0020): three items and one agreement of a charter in force
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_pulse, v_org_a, v_team_a, 'pulse', v_diag_ver, 7, now() - interval '1 minute');
    insert into app.charter_version (id, org_id, team_id, status, version, template_version, purpose, agreed_at)
    values (v_charter, v_org_a, v_team_a, 'in_force', 1, 1, 'Test purpose', now());
    insert into app.working_agreement (id, org_id, version_id, ordinal, text) values (v_agreement, v_org_a, v_charter, 1, 'Test agreement');
    insert into app.pulse_question (round_id, org_id, ordinal, source, item_id, factor_id)
    select v_pulse, v_org_a, vi.ordinal, 'rotating', vi.item_id, i.factor_id
    from app.instrument_version_item vi join app.item i on i.id = vi.item_id
    where vi.instrument_version_id = v_diag_ver and vi.ordinal <= 3;
    insert into app.pulse_question (round_id, org_id, ordinal, source, agreement_id, text)
    values (v_pulse, v_org_a, 4, 'agreement', v_agreement, '{"en": "Test agreement question"}');
    perform app.open_round(v_pulse);
    for v_n in 1..3 loop
      select jsonb_agg(jsonb_build_object('item', coalesce(q.item_id, q.agreement_id), 'value', 1 + (v_n + q.ordinal) % 5))
        into v_json from app.pulse_question q where q.round_id = v_pulse;
      perform set_config('request.jwt.claims', json_build_object('sub', v_a[v_n], 'role', 'authenticated')::text, true);
      set local role authenticated;
      v_txt := app.submit_response(v_pulse, v_json) ->> 'ok';
      reset role;
      if v_txt is distinct from 'true' then raise exception 'anonymity: a pulse answer was refused'; end if;
    end loop;
    v_m := (select count(*) from app.agreement_response a join app.response_set rs on rs.id = a.response_set_id where rs.round_id = v_pulse);
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_pulse;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    v_txt := app.close_round(v_pulse);
    v_rows := v_rows || jsonb_build_object('seq', 29, 'name', 'a pulse with 3 answers closes as missed, without an extension, its agreement answers gone with it',
      'expected', '3 agreement answers; closed, not extended, 0 sets, 0 agreement answers',
      'actual', v_m || ' agreement answers; ' || v_txt || ', extended ' || (select extended from app.assessment_round where id = v_pulse)
        || ', ' || (select count(*) from app.response_set where round_id = v_pulse) || ' sets, '
        || (select count(*) from app.agreement_response where agreement_id = v_agreement) || ' agreement answers',
      'pass', v_m = 3 and v_txt = 'closed' and not (select extended from app.assessment_round where id = v_pulse)
              and (select count(*) from app.response_set where round_id = v_pulse) = 0
              and (select count(*) from app.agreement_response where agreement_id = v_agreement) = 0);

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 30 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from app.organisation where name like 'Anonymity test %';
  select v_n + count(*) into v_n from auth.users where email like 'anon-test-%@example.invalid';
  v_rows := v_rows || jsonb_build_object('seq', 30, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_anonymity
  select (r2->>'seq')::int, r2->>'name', r2->>'expected', r2->>'actual', (r2->>'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_anonymity order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_anonymity;
  if v_failed is not null then
    raise exception 'anonymity invariants failed: %', v_failed;
  end if;
  if v_count <> 30 then
    raise exception 'anonymity invariants: expected 30 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_anonymity;
