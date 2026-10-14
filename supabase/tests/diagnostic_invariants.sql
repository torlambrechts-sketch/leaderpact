-- diagnostic_invariants.sql — the diagnostic round: open, invite, answer, remind, close (0015; handoff 6.10,
-- 6.11 and 7; milestone 10: "Reminders go only to people who have not answered. Close computes scores once").
--
--      1  the client functions are granted as reviewed; the job's and the dispatcher's to service_role alone
--      2  no role holds a privilege on the reminders, and a reminder has no column for a person
--      3  on the Free plan nobody opens a round; a member may not; an outsider reads nothing
--      4  a group with fewer members than its threshold cannot open a round, and nothing is written
--      5  the leader opens it: every current member invited, k frozen, 14 days, reminders on days 3, 7 and 12
--      6  a second round cannot open while one is answering
--      7  a member reads a count and their own state, never a name or a person's id
--      8  the form: 72 questions in one mixed order per round, not grouped by scale; a later joiner is not asked
--      9  an answer is taken once; the count moves; the form closes for that member; a gap is refused
--     10  a reminder goes only to the invited members who have not answered and are still members
--     11  a member removed while the round is open answers no more and reads nothing
--     12  a sent reminder is audited with ids only and is not claimed again
--     13  a reminder that fails is claimed again, and given up after five tries
--     14  a removed member who never answered keeps the round open; with nobody left to remind, a reminder is skipped
--     15  on its date the round closes: scores computed at n, with the charter version in force
--     16  computed once: closing again changes nothing, a late answer is refused, results read for members
--     17  the charter version recorded at release cannot be changed
--     18  after release the list shows the phase and the count, and a new round may open
--     19  where pg_cron exists, the job runs every five minutes, once
--     20  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/diagnostic_invariants.sql

create unlogged table if not exists public._inv_diagnostic(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_diagnostic;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_m1 uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();
  v_m3 uuid := gen_random_uuid();
  v_m4 uuid := gen_random_uuid();
  v_late uuid := gen_random_uuid();
  v_out uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_small uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_ver uuid;
  v_round uuid;
  v_res jsonb;
  v_res2 jsonb;
  v_txt text;
  v_n int;
  v_m int;
  v_sum numeric;
  v_ok boolean;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';

  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.open_diagnostic(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.get_rounds(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.get_round_form(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.submit_response(uuid, jsonb)', 'execute')
          and has_function_privilege('service_role', 'app.close_due_rounds()', 'execute')
          and has_function_privilege('service_role', 'app.claim_reminders(int)', 'execute')
          and has_function_privilege('service_role', 'app.finish_reminder(uuid, int, boolean)', 'execute')
          and not exists (
            select 1 from unnest(array['anon', 'authenticated']) r,
              unnest(array['app.close_due_rounds()', 'app.claim_reminders(int)', 'app.finish_reminder(uuid, int, boolean)',
                           'app.diagnostic_version()']) f
            where has_function_privilege(r, f, 'execute'))
          and not has_function_privilege('anon', 'app.open_diagnostic(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.get_rounds(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.get_round_form(uuid)', 'execute')
          and not has_function_privilege('service_role', 'app.open_diagnostic(uuid)', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the client functions are granted as reviewed; the job''s and the dispatcher''s to service_role alone',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- the reminders: no privilege, no person
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, 'app.round_reminder', p.priv);
  select string_agg(a.attname, ',' order by a.attnum) into v_txt
  from pg_attribute a where a.attrelid = 'app.round_reminder'::regclass and a.attnum > 0 and not a.attisdropped;
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no role holds a privilege on the reminders, and a reminder has no column for a person',
    'expected', '0 privileges; round_id,org_id,day,due_at,state,lease_until,attempts', 'actual', v_n || ' privileges; ' || v_txt,
    'pass', v_n = 0 and v_txt = 'round_id,org_id,day,due_at,state,lease_until,attempts');

  begin
    insert into auth.users (id, email) values
      (v_lead, 'diag-test-lead@example.invalid'), (v_m1, 'diag-test-m1@example.invalid'), (v_m2, 'diag-test-m2@example.invalid'),
      (v_m3, 'diag-test-m3@example.invalid'), (v_m4, 'diag-test-m4@example.invalid'), (v_late, 'diag-test-late@example.invalid'),
      (v_out, 'diag-test-out@example.invalid');
    insert into app.person (id, display_name) values
      (v_lead, 'Diag lead'), (v_m1, 'Diag one'), (v_m2, 'Diag two'), (v_m3, 'Diag three'), (v_m4, 'Diag four'),
      (v_late, 'Diag late'), (v_out, 'Diag outsider');
    insert into app.organisation (id, name) values (v_org, 'Diagnostic test organisation');
    insert into app.team (id, org_id, name) values
      (v_team, v_org, 'Diagnostic test group'), (v_small, v_org, 'Diagnostic small group'), (v_free, v_org, 'Diagnostic free group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from) values
      (v_org, v_team, v_lead, 'leader', now() - interval '30 days'), (v_org, v_team, v_m1, 'member', now() - interval '20 days'),
      (v_org, v_team, v_m2, 'member', now() - interval '20 days'), (v_org, v_team, v_m3, 'member', now() - interval '20 days'),
      (v_org, v_team, v_m4, 'member', now() - interval '20 days'),
      (v_org, v_small, v_lead, 'leader', now() - interval '30 days'), (v_org, v_small, v_m1, 'member', now() - interval '20 days'),
      (v_org, v_small, v_m2, 'member', now() - interval '20 days'),
      (v_org, v_free, v_lead, 'leader', now() - interval '30 days'), (v_org, v_free, v_m1, 'member', now() - interval '20 days'),
      (v_org, v_free, v_m2, 'member', now() - interval '20 days'), (v_org, v_free, v_m3, 'member', now() - interval '20 days');
    -- both groups on their trial: the Team plan, writable (0013); the third stays on Free
    insert into app.trial (team_id, org_id, started_at, ends_at) values
      (v_team, v_org, now() - interval '1 day', now() + interval '13 days'), (v_small, v_org, now() - interval '1 day', now() + interval '13 days');

    -- 3 ------------------------------------------------------------ Free, a member, an outsider
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', app.open_diagnostic(v_free) ->> 'reason', app.get_rounds(v_free) ->> 'can_open');
    perform set_config('request.jwt.claims', format(claims, v_m1), true);
    v_txt := concat_ws(',', v_txt, app.open_diagnostic(v_team) ->> 'reason', app.get_rounds(v_team) ->> 'can_open');
    perform set_config('request.jwt.claims', format(claims, v_out), true);
    v_txt := concat_ws(',', v_txt, coalesce(app.get_rounds(v_team)::text, 'nothing'), app.open_diagnostic(v_team) ->> 'reason');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'on the Free plan nobody opens a round; a member may not; an outsider reads nothing',
      'expected', 'unavailable,false,not_leader,false,nothing,not_leader', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'unavailable,false,not_leader,false,nothing,not_leader');

    -- 4 ------------------------------------------------------------ too few members
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res := app.open_diagnostic(v_small);
    reset role;
    select count(*) into v_n from app.assessment_round where team_id = v_small;
    v_txt := concat_ws(',', v_res ->> 'reason', v_res ->> 'members', v_res ->> 'k', v_n::text);
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'fewer members than the threshold: no round opens, nothing is written',
      'expected', 'too_few,3,4,0', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'too_few,3,4,0');

    -- 5 ------------------------------------------------------------ the leader opens it
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res := app.open_diagnostic(v_team);
    reset role;
    v_round := (v_res ->> 'round')::uuid;
    select string_agg(r.day || '@' || extract(day from r.due_at - now())::int || ':' || r.state, ' ' order by r.day) into v_txt
    from app.round_reminder r where r.round_id = v_round;
    select count(*) into v_n from app.participation where round_id = v_round;
    select concat_ws(',', v_res ->> 'ok', v_res ->> 'invited', v_n, r.phase, r.k, r.kind, extract(day from r.closes_at - r.opens_at)::int,
                     r.instrument_version_id = v_ver, v_txt,
                     (select count(*) from app.audit_event a where a.org_id = v_org and a.kind = 'round_opened'))
      into v_txt from app.assessment_round r where r.id = v_round;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'opened: 5 invited, k frozen at 4, 14 days, reminders due on days 3, 7 and 12',
      'expected', 'true,5,5,answering,4,diagnostic,14,t,3@3:due 7@7:due 12@12:due,1', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,5,5,answering,4,diagnostic,14,t,3@3:due 7@7:due 12@12:due,1');

    -- 6 ------------------------------------------------------------ one at a time
    set local role authenticated;
    v_txt := concat_ws(',', app.open_diagnostic(v_team) ->> 'reason', app.get_rounds(v_team) ->> 'can_open');
    reset role;
    select count(*) into v_n from app.assessment_round where team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'a second round cannot open while one is answering',
      'expected', 'open_round,false,1 round', 'actual', coalesce(v_txt, 'null') || ',' || v_n || ' round',
      'pass', v_txt = 'open_round,false' and v_n = 1);

    -- 7 ------------------------------------------------------------ what a member reads
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m2), true);
    v_res := app.get_rounds(v_team);
    reset role;
    v_txt := concat_ws(',', jsonb_array_length(v_res -> 'rounds'), v_res -> 'rounds' -> 0 ->> 'answered', v_res -> 'rounds' -> 0 ->> 'invited',
                       v_res -> 'rounds' -> 0 ->> 'me', v_res -> 'rounds' -> 0 ->> 'number', v_res ->> 'members', v_res ->> 'k',
                       v_res ->> 'questions', v_res ->> 'leader');
    v_ok := v_res::text !~ 'Diag ' and v_res::text !~ 'example.invalid'
            and not exists (select 1 from unnest(array[v_lead, v_m1, v_m2, v_m3, v_m4]) p where v_res::text ~ p::text);
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a member reads a count and their own state, never a name or a person''s id',
      'expected', '1,0,5,to_answer,1,5,4,72,false; no names', 'actual', coalesce(v_txt, 'null') || case when v_ok then '; no names' else '; names' end,
      'pass', v_txt = '1,0,5,to_answer,1,5,4,72,false' and v_ok);

    -- 8 ------------------------------------------------------------ the form
    insert into app.membership (org_id, team_id, person_id, role, valid_from) values (v_org, v_team, v_late, 'member', now() - interval '1 second');
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m1), true);
    v_res := app.get_round_form(v_round);
    perform set_config('request.jwt.claims', format(claims, v_m2), true);
    v_res2 := app.get_round_form(v_round);
    perform set_config('request.jwt.claims', format(claims, v_late), true);
    v_txt := concat_ws(',', app.get_round_form(v_round) ->> 'state', coalesce(app.get_round_form(v_round) ->> 'items', 'no items'));
    perform set_config('request.jwt.claims', format(claims, v_out), true);
    v_txt := concat_ws(',', v_txt, coalesce(app.get_round_form(v_round)::text, 'nothing'));
    reset role;
    -- adjacent questions of one scale: about 2 in a random order of 72, 48 in the bank's own order
    select count(*) into v_n
    from (select e.ord, i.factor_id, lag(i.factor_id) over (order by e.ord) as before
          from jsonb_array_elements(v_res -> 'items') with ordinality e (x, ord) join app.item i on i.id = (e.x ->> 'id')::uuid) s
    where s.factor_id = s.before;
    select count(*) into v_m
    from jsonb_array_elements(v_res -> 'items') with ordinality e (x, ord)
    join app.instrument_version_item vi on vi.item_id = (e.x ->> 'id')::uuid and vi.instrument_version_id = v_ver
    where vi.ordinal = e.ord;
    v_txt := concat_ws(',', v_res ->> 'state', jsonb_array_length(v_res -> 'items'), v_res -> 'items' = v_res2 -> 'items',
                       v_n < 12, v_m < 72, v_txt);
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', '72 questions in one mixed order per round, not by scale; a later joiner is not asked',
      'expected', 'open,72,t,t,t,not_invited,no items,nothing', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'open,72,t,t,t,not_invited,no items,nothing');

    -- 9 ------------------------------------------------------------ an answer, once
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m1), true);
    v_txt := app.submit_response(v_round, (
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 4) order by vi.ordinal)
      from app.instrument_version_item vi where vi.instrument_version_id = v_ver and vi.ordinal > 1)) ->> 'reason';
    v_txt := concat_ws(',', v_txt, app.submit_response(v_round, (
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 1 + vi.ordinal % 5) order by vi.ordinal)
      from app.instrument_version_item vi where vi.instrument_version_id = v_ver)) ->> 'ok');
    v_txt := concat_ws(',', v_txt, app.submit_response(v_round, (
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 3) order by vi.ordinal)
      from app.instrument_version_item vi where vi.instrument_version_id = v_ver)) ->> 'reason');
    v_res := app.get_round_form(v_round);
    v_res2 := app.get_rounds(v_team);
    reset role;
    v_txt := concat_ws(',', v_txt, v_res ->> 'state', coalesce(v_res ->> 'items', 'no items'),
                       v_res2 -> 'rounds' -> 0 ->> 'answered', v_res2 -> 'rounds' -> 0 ->> 'me');
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'a gap is refused; an answer is taken once; the count moves; the form closes for that member',
      'expected', 'invalid,true,already_answered,answered,no items,1,answered', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'invalid,true,already_answered,answered,no items,1,answered');

    -- 10 ----------------------------------------------------------- the milestone: reminders
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := app.remove_member(v_team, v_m4) ->> 'ok';
    reset role;
    update app.round_reminder set due_at = now() - interval '1 minute' where round_id = v_round and day = 3;
    set local role service_role;
    v_res := app.claim_reminders(20);
    reset role;
    select x into v_res2 from jsonb_array_elements(v_res) x where x ->> 'round' = v_round::text;
    v_txt := concat_ws(',', v_txt, v_res2 ->> 'day', v_res2 ->> 'group',
                       (select string_agg(r ->> 'email', ' ' order by r ->> 'email') from jsonb_array_elements(v_res2 -> 'recipients') r),
                       (select state || '/' || attempts from app.round_reminder where round_id = v_round and day = 3));
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'a reminder goes only to the invited members who have not answered and are still members',
      'expected', 'true,3,Diagnostic test group,diag-test-lead@example.invalid diag-test-m2@example.invalid diag-test-m3@example.invalid,sending/1',
      'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,3,Diagnostic test group,diag-test-lead@example.invalid diag-test-m2@example.invalid diag-test-m3@example.invalid,sending/1');

    -- 11 ----------------------------------------------------------- the removed member
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m4), true);
    v_txt := concat_ws(',', app.submit_response(v_round, (
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 2) order by vi.ordinal)
      from app.instrument_version_item vi where vi.instrument_version_id = v_ver)) ->> 'reason',
      coalesce(app.get_round_form(v_round)::text, 'nothing'), coalesce(app.get_rounds(v_team)::text, 'nothing'));
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a member removed while the round is open answers no more and reads nothing',
      'expected', 'not_invited,nothing,nothing', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'not_invited,nothing,nothing');

    -- 12 ----------------------------------------------------------- sent, audited with ids
    set local role service_role;
    v_txt := concat_ws(',', app.finish_reminder(v_round, 3, true), app.finish_reminder(v_round, 3, true));
    v_res := app.claim_reminders(20);
    reset role;
    select count(*) into v_n from jsonb_array_elements(v_res) x where x ->> 'round' = v_round::text;
    select count(*) into v_m from app.audit_event a, jsonb_object_keys(a.detail) k
    where a.org_id = v_org and a.kind = 'reminder_sent' and k not in ('round', 'day');
    v_txt := concat_ws(',', v_txt, (select state from app.round_reminder where round_id = v_round and day = 3),
                       (select count(*) from app.audit_event where org_id = v_org and kind = 'reminder_sent'), v_m, v_n);
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'a sent reminder is audited with ids only and is not claimed again',
      'expected', 'sent,sent,sent,1,0,0', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'sent,sent,sent,1,0,0');

    -- 13 ----------------------------------------------------------- a failure, then given up
    update app.round_reminder set due_at = now() - interval '1 minute' where round_id = v_round and day = 7;
    set local role service_role;
    perform app.claim_reminders(20);
    v_txt := app.finish_reminder(v_round, 7, false);
    reset role;
    v_txt := concat_ws(',', v_txt, (select state || '/' || attempts from app.round_reminder where round_id = v_round and day = 7));
    update app.round_reminder set attempts = 5 where round_id = v_round and day = 7;
    set local role service_role;
    v_res := app.claim_reminders(20);
    reset role;
    select count(*) into v_n from jsonb_array_elements(v_res) x where x ->> 'round' = v_round::text;
    v_txt := concat_ws(',', v_txt, v_n, (select state from app.round_reminder where round_id = v_round and day = 7));
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'a reminder that fails is claimed again, and given up after five tries',
      'expected', 'due,due/1,0,failed', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'due,due/1,0,failed');

    -- 14 ----------------------------------------------------------- the rest answer; the removed member's row keeps it open
    for v_n in 1..3 loop
      set local role authenticated;
      perform set_config('request.jwt.claims', format(claims, (array[v_lead, v_m2, v_m3])[v_n]), true);
      perform app.submit_response(v_round, (
        select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 1 + (v_n + vi.ordinal) % 5) order by vi.ordinal)
        from app.instrument_version_item vi where vi.instrument_version_id = v_ver));
      reset role;
    end loop;
    update app.round_reminder set due_at = now() - interval '1 minute' where round_id = v_round and day = 12;
    set local role service_role;
    v_res := app.claim_reminders(20);
    reset role;
    select count(*) into v_n from jsonb_array_elements(v_res) x where x ->> 'round' = v_round::text;
    v_txt := concat_ws(',', (select phase from app.assessment_round where id = v_round),
                       (select count(*) from app.participation where round_id = v_round and answered),
                       (select count(*) from app.response_set where round_id = v_round), v_n,
                       (select state from app.round_reminder where round_id = v_round and day = 12));
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'four answered, the removed member did not: open until its date; nobody left to remind',
      'expected', 'answering,4,4,0,skipped', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'answering,4,4,0,skipped');

    -- 15 ----------------------------------------------------------- the close on its date, with the charter in force
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    perform app.save_charter_draft(v_team, 'We set the direction.', '[{"title": "Set strategy", "right": "decide"}]', '["Pre-reads."]');
    v_res := app.agree_charter(v_team);
    reset role;
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_round;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    v_n := app.close_due_rounds();
    select count(*), sum(level) into v_m, v_sum from app.factor_score where round_id = v_round;
    select concat_ws(',', v_n, r.phase, v_m, (select min(n) || '-' || max(n) from app.factor_score where round_id = v_round),
                     (select count(*) from app.item_score where round_id = v_round),
                     r.charter_version_id = (select id from app.charter_version where team_id = v_team and status = 'in_force'),
                     (select string_agg(kind, '+' order by kind) from app.audit_event where org_id = v_org and kind in ('round_closed', 'results_released')))
      into v_txt from app.assessment_round r where r.id = v_round;
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'on its date it closes: 24 scales and 72 items at n = 4, with the charter version in force',
      'expected', '1,released,24,4-4,72,t,results_released+round_closed', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '1,released,24,4-4,72,t,results_released+round_closed');

    -- 16 ----------------------------------------------------------- once
    v_n := app.close_due_rounds();
    v_txt := app.close_round(v_round);
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m2), true);
    v_txt := concat_ws(',', v_n, v_txt, app.submit_response(v_round, (
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 5) order by vi.ordinal)
      from app.instrument_version_item vi where vi.instrument_version_id = v_ver)) ->> 'reason',
      (select count(*) from app.get_results(v_round)), app.get_round_form(v_round) ->> 'state');
    reset role;
    v_txt := concat_ws(',', v_txt, (select count(*) = v_m and sum(level) = v_sum from app.factor_score where round_id = v_round));
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'computed once: closing again changes nothing, a late answer is refused, members read results',
      'expected', '0,released,closed,24,closed,t', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '0,released,closed,24,closed,t');

    -- 17 ----------------------------------------------------------- the recorded charter version
    begin
      update app.assessment_round set charter_version_id = null where id = v_round;
      v_txt := 'changed';
    exception when check_violation then
      v_txt := 'refused';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'the charter version recorded at release cannot be changed',
      'expected', 'refused', 'actual', v_txt, 'pass', v_txt = 'refused');

    -- 18 ----------------------------------------------------------- after release
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res := app.get_rounds(v_team);
    reset role;
    v_txt := concat_ws(',', v_res -> 'rounds' -> 0 ->> 'phase', v_res -> 'rounds' -> 0 ->> 'answered', v_res -> 'rounds' -> 0 ->> 'invited',
                       coalesce(v_res -> 'rounds' -> 0 ->> 'me', 'no state'), v_res ->> 'can_open');
    v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'after release the list shows the phase and the count, and a new round may open',
      'expected', 'released,4,5,no state,true', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'released,4,5,no state,true');

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 19 ------------------------------------------------------------ the schedule
  if to_regclass('cron.job') is null then
    v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'where pg_cron exists, the job runs every five minutes, once',
      'expected', 'scheduled, or no pg_cron here', 'actual', 'no pg_cron here', 'pass', true);
  else
    execute $q$select count(*) from cron.job where jobname = 'leaderpact-close-due-rounds'
               and schedule = '*/5 * * * *' and command = 'select app.close_due_rounds()'$q$ into v_n;
    v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'where pg_cron exists, the job runs every five minutes, once',
      'expected', '1 job', 'actual', v_n || ' job', 'pass', v_n = 1);
  end if;

  -- 20 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'diag-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Diagnostic test organisation';
  v_rows := v_rows || jsonb_build_object('seq', 20, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_diagnostic
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_diagnostic order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_diagnostic;
  if v_failed is not null then
    raise exception 'diagnostic invariants failed: %', v_failed;
  end if;
  if v_count <> 20 then
    raise exception 'diagnostic invariants: expected 20 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_diagnostic;
