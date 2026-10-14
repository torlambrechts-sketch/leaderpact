-- plan_invariants.sql — the group's plan: focus areas and actions (0017; handoff 6.13; milestone 12: "A third
-- focus area is refused. An action without an owner is refused").
--
--      1  the client functions are granted as reviewed; the access rules are internal
--      2  no role holds any privilege on the focus areas or the actions
--      3  on the Free plan nobody makes a focus area or adds an action
--      4  a member may not make or close a focus area; an outsider reads nothing and writes nothing
--      5  a focus area is one of the 21 scales of a released round of this group's Full diagnostic
--      6  the leader makes two; the same scale twice is refused; a third is refused
--      7  the table itself refuses a third, written directly
--      8  closing one opens a place; a closed focus area stays closed and keeps its row
--      9  an action without an owner is refused: none, an outsider, a former member, or written directly
--     10  a blank or long title, a past or far date, a closed or another group's focus area are refused
--     11  a member adds an action for another member; the plan shows it, its owner, and no count per person
--     12  only its owner or the leader marks it done, reopens it, or changes it; a new owner is a current member
--     13  every client function writing a focus area or an action asks plan_writable
--     14  read-only: nothing is written, and the plan still reads
--     15  a person whose membership has ended reads nothing and writes nothing
--     16  a person's removal takes the actions they own and clears who made a focus area
--     17  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/plan_invariants.sql

create unlogged table if not exists public._inv_plan(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_plan;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_gone uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_else uuid := gen_random_uuid();
  v_round uuid := gen_random_uuid();
  v_open uuid := gen_random_uuid();
  v_else_round uuid := gen_random_uuid();
  v_ver uuid;
  v_f1 uuid;
  v_f2 uuid;
  v_f3 uuid;
  v_else_f uuid;
  v_act uuid;
  v_res jsonb;
  v_plan jsonb;
  v_txt text;
  v_n int;
  v_m int;
  v_ok boolean;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.get_plan(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.make_focus_area(uuid, uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.close_focus_area(uuid, uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.add_action(uuid, uuid, text, uuid, date)', 'execute')
          and has_function_privilege('authenticated', 'app.update_action(uuid, uuid, text, uuid, date)', 'execute')
          and has_function_privilege('authenticated', 'app.set_action_done(uuid, uuid, boolean)', 'execute')
          and not has_function_privilege('anon', 'app.get_plan(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.add_action(uuid, uuid, text, uuid, date)', 'execute')
          and not has_function_privilege('anon', 'app.make_focus_area(uuid, uuid, text)', 'execute')
          and not has_function_privilege('authenticated', 'app.plan_writable(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.due_date_ok(date)', 'execute')
          and not has_function_privilege('authenticated', 'app.is_current_member(uuid, uuid)', 'execute')
          and not has_function_privilege('anon', 'app.is_current_member(uuid, uuid)', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the client functions are granted as reviewed; the access rules are internal',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- no table privileges
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.focus_area'), ('app.action')) as t (tbl)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.tbl, p.priv);
  v_ok := (select bool_and(relrowsecurity) from pg_class where oid in ('app.focus_area'::regclass, 'app.action'::regclass));
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no role holds a privilege on the focus areas or the actions; RLS is on',
    'expected', '0, RLS on', 'actual', v_n || ', ' || case when v_ok then 'RLS on' else 'RLS off' end, 'pass', v_n = 0 and v_ok);

  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';

  begin
    insert into auth.users (id, email) values
      (v_lead, 'plan-test-lead@example.invalid'), (v_member, 'plan-test-member@example.invalid'),
      (v_other, 'plan-test-other@example.invalid'), (v_gone, 'plan-test-gone@example.invalid'),
      (v_outsider, 'plan-test-out@example.invalid');
    insert into app.person (id, display_name) values
      (v_lead, 'Plan lead'), (v_member, 'Plan member'), (v_other, 'Plan other'), (v_gone, 'Plan former'), (v_outsider, 'Plan outsider');
    insert into app.organisation (id, name) values (v_org, 'Plan test organisation');
    insert into app.team (id, org_id, name) values
      (v_team, v_org, 'Plan test group'), (v_free, v_org, 'Plan free group'), (v_else, v_org, 'Plan other group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from, valid_to) values
      (v_org, v_team, v_lead, 'leader', now() - interval '60 days', null),
      (v_org, v_team, v_member, 'member', now() - interval '60 days', null),
      (v_org, v_team, v_other, 'member', now() - interval '60 days', null),
      (v_org, v_team, v_gone, 'member', now() - interval '60 days', now() - interval '1 day'),
      (v_org, v_free, v_lead, 'leader', now() - interval '60 days', null),
      (v_org, v_else, v_outsider, 'leader', now() - interval '60 days', null);
    -- the group and the other group on their trials: the Team plan, writable (0013)
    insert into app.trial (team_id, org_id, started_at, ends_at) values
      (v_team, v_org, now() - interval '1 day', now() + interval '13 days'),
      (v_else, v_org, now() - interval '1 day', now() + interval '13 days');
    -- a released round and an open one of the group's Full diagnostic, and a released round of the other group
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, phase, k, window_days, opens_at, closes_at, invited) values
      (v_round, v_org, v_team, 'diagnostic', v_ver, 'released', 4, 14, now() - interval '40 days', now() - interval '26 days', 4),
      (v_else_round, v_org, v_else, 'diagnostic', v_ver, 'released', 4, 14, now() - interval '40 days', now() - interval '26 days', 4);
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, phase, k, window_days, opens_at, closes_at, invited) values
      (v_open, v_org, v_team, 'diagnostic', v_ver, 'answering', 4, 14, now() - interval '2 days', now() + interval '12 days', 4);

    set local role authenticated;

    -- 3 ------------------------------------------------------------ Free: nothing written
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', app.make_focus_area(v_free, v_round, 'trust') ->> 'reason',
                       app.get_plan(v_free) ->> 'can_edit', app.get_plan(v_free) ->> 'can_choose');
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'on the Free plan nobody makes a focus area or adds an action',
      'expected', 'unavailable,false,false', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'unavailable,false,false');

    -- 4 ------------------------------------------------------------ a member and an outsider
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := concat_ws(',', app.make_focus_area(v_team, v_round, 'trust') ->> 'reason', app.get_plan(v_team) ->> 'can_choose',
                       app.get_plan(v_team) ->> 'can_edit');
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := concat_ws(',', v_txt, coalesce(app.get_plan(v_team)::text, 'nothing'), app.make_focus_area(v_team, v_round, 'trust') ->> 'reason',
                       app.add_action(v_team, null, 'Something', v_outsider, current_date + 7) ->> 'reason');
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'a member may not make a focus area; an outsider reads and writes nothing',
      'expected', 'not_leader,false,true,nothing,not_leader,not_member', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,false,true,nothing,not_leader,not_member');

    -- 5 ------------------------------------------------------------ what a focus area may be
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', app.make_focus_area(v_team, v_open, 'trust') ->> 'reason',
                       app.make_focus_area(v_team, v_else_round, 'trust') ->> 'reason',
                       app.make_focus_area(v_team, v_round, 'viability') ->> 'reason',
                       app.make_focus_area(v_team, v_round, 'no_such_scale') ->> 'reason',
                       app.make_focus_area(v_team, null, 'trust') ->> 'reason');
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'only a scale of a released round of this group: open, other group, outcome, unknown refused',
      'expected', 'invalid,invalid,invalid,invalid,invalid', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'invalid,invalid,invalid,invalid,invalid');

    -- 6 ------------------------------------------------------------ two, then a third is refused
    v_res := app.make_focus_area(v_team, v_round, 'trust');
    v_f1 := (v_res ->> 'focus_area')::uuid;
    v_txt := concat_ws(',', v_res ->> 'ok', app.make_focus_area(v_team, v_round, 'trust') ->> 'reason');
    v_res := app.make_focus_area(v_team, v_round, 'clear_purpose');
    v_f2 := (v_res ->> 'focus_area')::uuid;
    v_res := app.make_focus_area(v_team, v_round, 'psychological_safety');
    v_plan := app.get_plan(v_team);
    v_txt := concat_ws(',', v_txt, v_res ->> 'reason', v_res ->> 'max', jsonb_array_length(v_plan -> 'focus_areas'), v_plan ->> 'max');
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'the leader makes two; the same scale twice is refused; a third is refused',
      'expected', 'true,already,full,2,2,2', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,already,full,2,2,2');

    -- 7 ------------------------------------------------------------ the table refuses a third
    reset role;
    begin
      insert into app.focus_area (org_id, team_id, factor_id, round_id, created_by)
      select v_org, v_team, x.id, v_round, v_lead from app.factor x where x.key = 'psychological_safety';
      v_txt := 'stored';
    exception when check_violation then
      v_txt := 'refused';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'the table itself refuses a third active focus area, written directly',
      'expected', 'refused', 'actual', v_txt, 'pass', v_txt = 'refused');

    -- 8 ------------------------------------------------------------ closing opens a place
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.close_focus_area(v_team, v_f1) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.close_focus_area(v_team, v_f1) ->> 'ok', app.close_focus_area(v_team, v_f1) ->> 'reason');
    v_res := app.make_focus_area(v_team, v_round, 'psychological_safety');
    v_f3 := (v_res ->> 'focus_area')::uuid;
    v_plan := app.get_plan(v_team);
    v_txt := concat_ws(',', v_txt, v_res ->> 'ok', jsonb_array_length(v_plan -> 'focus_areas'),
                       v_plan -> 'focus_areas' -> 2 ->> 'status', v_plan -> 'focus_areas' -> 2 ->> 'scale');
    reset role;
    begin
      update app.focus_area set status = 'active', closed_at = null, closed_by = null where id = v_f1;
      v_txt := v_txt || ',reopened';
    exception when check_violation then
      v_txt := v_txt || ',stays closed';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'closing one opens a place; a closed focus area stays closed and keeps its row',
      'expected', 'not_leader,true,invalid,true,3,closed,trust,stays closed', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,true,invalid,true,3,closed,trust,stays closed');

    -- 9 ------------------------------------------------------------ an action without an owner is refused
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := concat_ws(',', app.add_action(v_team, v_f2, 'Agree what good looks like', null, current_date + 14) ->> 'reason',
                       app.add_action(v_team, v_f2, 'Agree what good looks like', v_outsider, current_date + 14) ->> 'reason',
                       app.add_action(v_team, v_f2, 'Agree what good looks like', v_gone, current_date + 14) ->> 'reason');
    reset role;
    begin
      insert into app.action (org_id, team_id, focus_area_id, title, owner_id, due_on, created_by)
      values (v_org, v_team, v_f2, 'Without an owner', null, current_date + 14, v_member);
      v_txt := v_txt || ',stored';
    exception when not_null_violation then
      v_txt := v_txt || ',refused';
    end;
    select v_txt || ',' || count(*) into v_txt from app.action where team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'an action without an owner is refused: none, an outsider, a former member, or written directly',
      'expected', 'no_owner,no_owner,no_owner,refused,0', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'no_owner,no_owner,no_owner,refused,0');

    -- 10 ----------------------------------------------------------- what else is refused
    insert into app.focus_area (org_id, team_id, factor_id, round_id, created_by)
    select v_org, v_else, x.id, v_else_round, v_outsider from app.factor x where x.key = 'trust'
    returning id into v_else_f;
    set local role authenticated;
    v_txt := concat_ws(',', app.add_action(v_team, v_f2, '   ', v_other, current_date + 14) ->> 'reason',
                       app.add_action(v_team, v_f2, repeat('x', 201), v_other, current_date + 14) ->> 'reason',
                       app.add_action(v_team, v_f2, 'A date long past', v_other, current_date - 10) ->> 'reason',
                       app.add_action(v_team, v_f2, 'A date far away', v_other, current_date + 800) ->> 'reason',
                       app.add_action(v_team, v_f2, 'No date', v_other, null) ->> 'reason',
                       app.add_action(v_team, v_f1, 'A closed focus area', v_other, current_date + 14) ->> 'reason',
                       app.add_action(v_team, v_else_f, 'Another group''s', v_other, current_date + 14) ->> 'reason',
                       app.add_action(v_team, null, 'No focus area', v_other, current_date + 14) ->> 'reason');
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'a blank or long title, a past, far or missing date, a closed, another group''s or no focus area are refused',
      'expected', 'invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid');

    -- 11 ----------------------------------------------------------- a member adds an action for another
    v_res := app.add_action(v_team, v_f2, '  Agree what good looks like  ', v_other, current_date + 14);
    v_plan := app.get_plan(v_team);
    select (a ->> 'id')::uuid into v_act
    from jsonb_array_elements(v_plan -> 'focus_areas') f, jsonb_array_elements(f -> 'actions') a where a ->> 'title' = 'Agree what good looks like';
    select concat_ws(',', v_res ->> 'ok', (v_res ? 'id')::text, a ->> 'owner_name', a ->> 'owner_current', a ->> 'status', a ->> 'mine', a ->> 'can_edit')
      into v_txt
    from jsonb_array_elements(v_plan -> 'focus_areas') f, jsonb_array_elements(f -> 'actions') a where (a ->> 'id')::uuid = v_act;
    -- no count of actions per person, anywhere in the reply
    v_ok := v_plan::text !~* '"(count|open_count|done_count|actions_per|per_person)[a-z_]*"'
            and (select bool_and(not (m ? 'actions' or m ? 'open' or m ? 'done')) from jsonb_array_elements(v_plan -> 'members') m);
    v_txt := concat_ws(',', v_txt, jsonb_array_length(v_plan -> 'members'), case when v_ok then 'no count' else 'a count' end);
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a member adds an action for another; the plan shows it with its owner, three members, no count',
      'expected', 'true,false,Plan other,true,open,false,false,3,no count', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,false,Plan other,true,open,false,false,3,no count');

    -- 12 ----------------------------------------------------------- who changes an action
    v_txt := concat_ws(',', app.set_action_done(v_team, v_act, true) ->> 'reason',
                       app.update_action(v_team, v_act, 'Changed', v_member, current_date + 7) ->> 'reason');
    perform set_config('request.jwt.claims', format(claims, v_other), true);
    v_txt := concat_ws(',', v_txt, app.update_action(v_team, v_act, 'Agree what good looks like', v_gone, current_date + 7) ->> 'reason',
                       app.update_action(v_team, v_act, 'Agree what good looks like, together', v_other, current_date + 21) ->> 'ok',
                       app.set_action_done(v_team, v_act, true) ->> 'ok',
                       app.update_action(v_team, v_act, 'Done already', v_other, current_date + 21) ->> 'reason');
    reset role;
    select concat_ws(',', v_txt, a.title, a.status, (a.done_at is not null)::text, a.due_on - current_date) into v_txt from app.action a where a.id = v_act;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.set_action_done(v_team, v_act, false) ->> 'ok',
                       app.update_action(v_team, v_act, 'Agree what good looks like', v_member, current_date + 10) ->> 'ok');
    reset role;
    select concat_ws(',', v_txt, a.status, (a.done_at is null)::text, (a.owner_id = v_member)::text) into v_txt from app.action a where a.id = v_act;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'only its owner or the leader marks it done, reopens or changes it; a new owner is a current member',
      'expected', 'not_owner,not_owner,no_owner,true,true,invalid,Agree what good looks like, together,done,true,21,true,true,open,true,true',
      'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_owner,not_owner,no_owner,true,true,invalid,Agree what good looks like, together,done,true,21,true,true,open,true,true');

    -- 13 ----------------------------------------------------------- the guard, from the catalogue
    select count(*) filter (where p.prosrc !~ 'app\.plan_writable\('), count(*) into v_n, v_m
    from pg_proc p
    where p.pronamespace = 'app'::regnamespace and p.prokind = 'f'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
      and p.prosrc ~* '(insert\s+into|update)\s+app\.(focus_area|action)\M';
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'every client function writing a focus area or an action asks plan_writable',
      'expected', '0 without, at least 5 with', 'actual', v_n || ' without, ' || v_m || ' with', 'pass', v_n = 0 and v_m >= 5);

    -- 14 ----------------------------------------------------------- read-only
    insert into app.subscription (team_id, org_id, plan_key, interval, currency, amount_minor, price_version, method, state,
                                  started_at, current_period_end, past_due_since, company_name, country, provider)
    values (v_team, v_org, 'team', 'year', 'USD', 180000, 1, 'card', 'past_due', now() - interval '40 days', now() - interval '8 days',
            now() - interval '8 days', 'Plan AS', 'NO', 'development');
    v_txt := app.group_access(v_team);
    set local role authenticated;
    v_txt := concat_ws(',', v_txt, app.close_focus_area(v_team, v_f2) ->> 'reason',
                       app.add_action(v_team, v_f2, 'While read-only', v_member, current_date + 7) ->> 'reason',
                       app.set_action_done(v_team, v_act, true) ->> 'reason',
                       app.update_action(v_team, v_act, 'While read-only', v_member, current_date + 7) ->> 'reason',
                       app.get_plan(v_team) ->> 'can_edit',
                       (select a ->> 'can_edit' from jsonb_array_elements(app.get_plan(v_team) -> 'focus_areas') f,
                          jsonb_array_elements(f -> 'actions') a where (a ->> 'id')::uuid = v_act),
                       jsonb_array_length(app.get_plan(v_team) -> 'focus_areas'));
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'read-only: nothing is written, and the plan still reads',
      'expected', 'read_only,unavailable,unavailable,unavailable,unavailable,false,false,3', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'read_only,unavailable,unavailable,unavailable,unavailable,false,false,3');

    -- 15 ----------------------------------------------------------- an ended membership
    update app.membership set valid_to = now() - interval '1 second' where team_id = v_team and person_id = v_member;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := concat_ws(',', coalesce(app.get_plan(v_team)::text, 'nothing'), app.set_action_done(v_team, v_act, true) ->> 'reason',
                       app.add_action(v_team, v_f2, 'After leaving', v_member, current_date + 7) ->> 'reason');
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_plan := app.get_plan(v_team);
    select v_txt || ',' || (a ->> 'owner_current') into v_txt
    from jsonb_array_elements(v_plan -> 'focus_areas') f, jsonb_array_elements(f -> 'actions') a where (a ->> 'id')::uuid = v_act;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'a former member reads and writes nothing; their action shows them as no longer a member',
      'expected', 'nothing,not_member,not_member,false', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'nothing,not_member,not_member,false');

    -- 16 ----------------------------------------------------------- a person's removal
    delete from app.person where id = v_member;
    delete from app.person where id = v_lead;
    select concat_ws(',', (select count(*) from app.action where id = v_act),
                     (select count(*) from app.focus_area where team_id = v_team and created_by is null),
                     (select count(*) from app.focus_area where team_id = v_team and closed_by is null and status = 'closed'),
                     (select count(*) from app.focus_area where team_id = v_team and status = 'active'))
      into v_txt;
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'a person''s removal takes the actions they own and clears who made or closed a focus area',
      'expected', '0,3,1,2', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '0,3,1,2');

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 17 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'plan-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Plan test organisation';
  v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_plan
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_plan order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_plan;
  if v_failed is not null then
    raise exception 'plan invariants failed: %', v_failed;
  end if;
  if v_count <> 17 then
    raise exception 'plan invariants: expected 17 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_plan;
