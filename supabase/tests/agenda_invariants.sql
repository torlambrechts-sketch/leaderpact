-- agenda_invariants.sql — meetings and their agendas, with the task match and the time check (0018; handoff
-- 6.14; milestone 13: "An unmatched item is flagged and can be confirmed. Open actions appear on the agenda").
--
--      1  the client functions are granted as reviewed; the rules are internal
--      2  no role holds any privilege on the template, the meetings or the agenda items; RLS is on
--      3  the template's version 1: four item types and the closing item; it never changes
--      4  on the Free plan nobody plans a meeting
--      5  a member may not plan, change or cancel a meeting; an outsider reads nothing and proposes nothing
--      6  a meeting with a blank title, a short length or a far date is refused; planned, it is the next one
--         and its agenda starts with the closing item, the leader's, ready and never flagged
--      7  any member proposes an item; it is ready only with a type, an outcome, an owner and a time box
--      8  an owner who is not a member, a task not in force, or a wrong type is refused
--      9  with no team tasks in force the check is off: nothing is flagged
--     10  with team tasks in force, an item that names none is flagged; one that names a task is not
--     11  only the leader confirms a flagged item; it stays, no longer flagged; a matched or closing item is not confirmed
--     12  its proposer or owner changes an item, another member does not; dropping its task flags it again
--     13  the closing item is the leader's to remove; a proposer removes their own; a removed item keeps its row
--     14  the next agenda lists every open action of the group, and no done one; a later agenda lists none
--     15  the time check: each item's minutes, against the meeting's length
--     16  an agenda holds at most the template's number of items
--     17  every client function writing a meeting or an agenda item asks meetings_writable
--     18  read-only: nothing is written, and the agenda still reads
--     19  a former member reads nothing; a person's removal leaves their item without an owner, not ready
--     20  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/agenda_invariants.sql

create unlogged table if not exists public._inv_agenda(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_agenda;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_round uuid := gen_random_uuid();
  v_ver uuid;
  v_meet uuid;
  v_later uuid;
  v_focus uuid;
  v_item uuid;
  v_item2 uuid;
  v_closing uuid;
  v_task uuid;
  v_res jsonb;
  v_a jsonb;
  v_txt text;
  v_n int;
  v_m int;
  v_ok boolean;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.get_meetings(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.get_agenda(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.plan_meeting(uuid, text, date, time, int)', 'execute')
          and has_function_privilege('authenticated', 'app.update_meeting(uuid, text, date, time, int)', 'execute')
          and has_function_privilege('authenticated', 'app.cancel_meeting(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.propose_item(uuid, text, text, text, uuid, int, uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.update_item(uuid, text, text, text, uuid, int, uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.confirm_item(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.remove_item(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.get_agenda(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.propose_item(uuid, text, text, text, uuid, int, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.meetings_writable(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.tasks_in_force(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.next_meeting(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.agenda_item_ok(uuid, text, text, text, uuid, int, uuid)', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the client functions are granted as reviewed; the rules are internal',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- no table privileges
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.agenda_template'), ('app.meeting'), ('app.agenda_item')) as t (tbl)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.tbl, p.priv);
  v_ok := (select bool_and(relrowsecurity) from pg_class
           where oid in ('app.agenda_template'::regclass, 'app.meeting'::regclass, 'app.agenda_item'::regclass));
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no role holds a privilege on the template, the meetings or the items; RLS is on',
    'expected', '0, RLS on', 'actual', v_n || ', ' || case when v_ok then 'RLS on' else 'RLS off' end, 'pass', v_n = 0 and v_ok);

  -- 3 -------------------------------------------------------------- the template
  select concat_ws(',', array_to_string(t.item_types, '|'), t.closing -> 'title' ->> 'en', t.closing ->> 'minutes', t.meeting_minutes)
    into v_txt from app.agenda_template t where t.version = 1;
  begin
    update app.agenda_template set meeting_minutes = 60 where version = 1;
    v_txt := v_txt || ',changed';
  exception when check_violation then
    v_txt := v_txt || ',fixed';
  end;
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'the template''s version 1: four item types and the closing item; it never changes',
    'expected', 'information|discussion|decision|follow_up,Reflection,5,90,fixed', 'actual', coalesce(v_txt, 'null'),
    'pass', v_txt = 'information|discussion|decision|follow_up,Reflection,5,90,fixed');

  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';

  begin
    insert into auth.users (id, email) values
      (v_lead, 'agenda-test-lead@example.invalid'), (v_member, 'agenda-test-member@example.invalid'),
      (v_other, 'agenda-test-other@example.invalid'), (v_outsider, 'agenda-test-out@example.invalid');
    insert into app.person (id, display_name) values
      (v_lead, 'Agenda lead'), (v_member, 'Agenda member'), (v_other, 'Agenda other'), (v_outsider, 'Agenda outsider');
    insert into app.organisation (id, name) values (v_org, 'Agenda test organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Agenda test group'), (v_free, v_org, 'Agenda free group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from) values
      (v_org, v_team, v_lead, 'leader', now() - interval '60 days'),
      (v_org, v_team, v_member, 'member', now() - interval '60 days'),
      (v_org, v_team, v_other, 'member', now() - interval '60 days'),
      (v_org, v_free, v_lead, 'leader', now() - interval '60 days');
    insert into app.trial (team_id, org_id, started_at, ends_at) values (v_team, v_org, now() - interval '1 day', now() + interval '13 days');

    set local role authenticated;

    -- 4 ------------------------------------------------------------ Free
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', app.plan_meeting(v_free, 'Leadership meeting', current_date + 7, '09:00', 90) ->> 'reason',
                       app.get_meetings(v_free) ->> 'can_plan');
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'on the Free plan nobody plans a meeting',
      'expected', 'unavailable,false', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'unavailable,false');

    -- 6 ------------------------------------------------------------ planning
    v_txt := concat_ws(',', app.plan_meeting(v_team, '   ', current_date + 7, '09:00', 90) ->> 'reason',
                       app.plan_meeting(v_team, 'Leadership meeting', current_date + 7, '09:00', 10) ->> 'reason',
                       app.plan_meeting(v_team, 'Leadership meeting', current_date - 30, '09:00', 90) ->> 'reason',
                       app.plan_meeting(v_team, 'Leadership meeting', null, '09:00', 90) ->> 'reason');
    v_res := app.plan_meeting(v_team, ' Leadership meeting ', current_date + 7, '09:00', 60);
    v_meet := (v_res ->> 'meeting')::uuid;
    v_later := (app.plan_meeting(v_team, 'Later meeting', current_date + 21, '09:00', 60) ->> 'meeting')::uuid;
    v_a := app.get_agenda(v_meet);
    v_closing := (v_a -> 'items' -> 0 ->> 'id')::uuid;
    v_txt := concat_ws(',', v_txt, v_res ->> 'ok', (app.get_meetings(v_team) ->> 'next' = v_meet::text)::text, v_a -> 'meeting' ->> 'title',
                       jsonb_array_length(v_a -> 'items'), v_a -> 'items' -> 0 ->> 'title', v_a -> 'items' -> 0 ->> 'owner_name',
                       v_a -> 'items' -> 0 ->> 'closing', v_a -> 'items' -> 0 ->> 'ready', v_a -> 'items' -> 0 ->> 'flagged');
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'bad meetings are refused; planned, it is next, its agenda the leader''s ready closing item',
      'expected', 'invalid,invalid,invalid,invalid,true,true,Leadership meeting,1,Reflection,Agenda lead,true,true,false', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'invalid,invalid,invalid,invalid,true,true,Leadership meeting,1,Reflection,Agenda lead,true,true,false');

    -- 5 ------------------------------------------------------------ a member and an outsider
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := concat_ws(',', app.plan_meeting(v_team, 'Mine', current_date + 7, '09:00', 60) ->> 'reason',
                       app.update_meeting(v_meet, 'Changed', current_date + 7, '09:00', 60) ->> 'reason',
                       app.cancel_meeting(v_meet) ->> 'reason', app.get_meetings(v_team) ->> 'can_plan');
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := concat_ws(',', v_txt, coalesce(app.get_meetings(v_team)::text, 'nothing'), coalesce(app.get_agenda(v_meet)::text, 'nothing'),
                       app.propose_item(v_meet, 'Sneaked in', null, null, null, null, null) ->> 'reason');
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'a member may not plan, change or cancel; an outsider reads and proposes nothing',
      'expected', 'not_leader,not_leader,not_leader,false,nothing,nothing,not_member', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,not_leader,not_leader,false,nothing,nothing,not_member');

    -- 7 ------------------------------------------------------------ proposing; ready needs all four
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_res := app.propose_item(v_meet, ' Office move ', null, null, null, null, null);
    v_a := app.get_agenda(v_meet);
    v_item := (v_a -> 'items' -> 0 ->> 'id')::uuid;
    v_txt := concat_ws(',', v_res ->> 'ok', (v_res ? 'id')::text, jsonb_array_length(v_a -> 'items'), v_a -> 'items' -> 0 ->> 'title',
                       v_a -> 'items' -> 0 ->> 'ready', v_a -> 'items' -> 1 ->> 'closing');
    perform app.update_item(v_item, 'Office move', 'information', 'Everyone knows the move dates.', v_member, null, null);
    v_txt := concat_ws(',', v_txt, app.get_agenda(v_meet) -> 'items' -> 0 ->> 'ready');
    perform app.update_item(v_item, 'Office move', 'information', 'Everyone knows the move dates.', v_member, 10, null);
    v_txt := concat_ws(',', v_txt, app.get_agenda(v_meet) -> 'items' -> 0 ->> 'ready');
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'any member proposes; ready only with a type, an outcome, an owner and a time box',
      'expected', 'true,false,2,Office move,false,true,false,true', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,false,2,Office move,false,true,false,true');

    -- 8 ------------------------------------------------------------ what is refused
    v_txt := concat_ws(',', app.propose_item(v_meet, 'Item', null, null, v_outsider, null, null) ->> 'reason',
                       app.propose_item(v_meet, 'Item', null, null, null, null, gen_random_uuid()) ->> 'reason',
                       app.propose_item(v_meet, 'Item', 'chat', null, null, null, null) ->> 'reason',
                       app.propose_item(v_meet, '  ', null, null, null, null, null) ->> 'reason',
                       app.propose_item(v_meet, 'Item', null, null, null, 300, null) ->> 'reason');
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'an owner outside, a task not in force, a wrong type, no title, a long time box: refused',
      'expected', 'no_owner,no_task,invalid,invalid,invalid', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'no_owner,no_task,invalid,invalid,invalid');

    -- 9 ------------------------------------------------------------ no team tasks: the check is off
    v_a := app.get_agenda(v_meet);
    v_txt := concat_ws(',', jsonb_array_length(v_a -> 'tasks'), (select count(*) from jsonb_array_elements(v_a -> 'items') i where (i ->> 'flagged')::boolean));
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'with no team tasks in force the check is off: nothing is flagged',
      'expected', '0,0', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '0,0');

    -- 10 ----------------------------------------------------------- team tasks in force: an item without one is flagged
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    perform app.save_charter_draft(v_team, 'Why we meet.', '[{"title": "Set strategy", "right": "decide"}, {"title": "Coordinate the units", "right": "advise"}]',
                                   '["We send pre-reads."]');
    perform app.agree_charter(v_team);
    v_a := app.get_agenda(v_meet);
    v_task := (v_a -> 'tasks' -> 0 ->> 'id')::uuid;
    perform set_config('request.jwt.claims', format(claims, v_other), true);
    perform app.propose_item(v_meet, 'Strategy day', 'decision', 'A date for the strategy day.', v_other, 20, v_task);
    v_a := app.get_agenda(v_meet);
    select concat_ws(',', jsonb_array_length(v_a -> 'tasks'),
                     string_agg((i ->> 'title') || '=' || (i ->> 'flagged'), '|' order by o))
      into v_txt from jsonb_array_elements(v_a -> 'items') with ordinality x (i, o);
    v_item2 := (select (i ->> 'id')::uuid from jsonb_array_elements(v_a -> 'items') i where i ->> 'title' = 'Strategy day');
    v_txt := concat_ws(',', v_txt, (select i ->> 'task_title' from jsonb_array_elements(v_a -> 'items') i where i ->> 'title' = 'Strategy day'));
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'with tasks in force, an item naming none is flagged; one naming a task and the closing item are not',
      'expected', '2,Office move=true|Strategy day=false|Reflection=false,Set strategy', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '2,Office move=true|Strategy day=false|Reflection=false,Set strategy');

    -- 11 ----------------------------------------------------------- the leader confirms
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.confirm_item(v_item) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.confirm_item(v_item2) ->> 'reason', app.confirm_item(v_closing) ->> 'reason',
                       app.confirm_item(v_item) ->> 'ok', app.confirm_item(v_item) ->> 'reason');
    v_a := app.get_agenda(v_meet);
    select concat_ws(',', v_txt, i ->> 'flagged', i ->> 'confirmed', jsonb_array_length(v_a -> 'items'))
      into v_txt from jsonb_array_elements(v_a -> 'items') i where (i ->> 'id')::uuid = v_item;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'only the leader confirms a flagged item; it stays, not flagged; a matched or closing item is not confirmed',
      'expected', 'not_leader,invalid,invalid,true,invalid,false,true,3', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,invalid,invalid,true,invalid,false,true,3');

    -- 12 ----------------------------------------------------------- who changes an item
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.update_item(v_item2, 'Strategy day', 'decision', 'A date.', v_other, 20, v_task) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_other), true);
    v_txt := concat_ws(',', v_txt, app.update_item(v_item2, 'Strategy day', 'decision', 'A date and a place.', v_other, 25, null) ->> 'ok');
    select concat_ws(',', v_txt, i ->> 'flagged', i ->> 'minutes', i ->> 'outcome')
      into v_txt from jsonb_array_elements(app.get_agenda(v_meet) -> 'items') i where (i ->> 'id')::uuid = v_item2;
    perform app.update_item(v_item2, 'Strategy day', 'decision', 'A date and a place.', v_other, 25, v_task);
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'its proposer or owner changes an item, another member does not; dropping its task flags it again',
      'expected', 'not_allowed,true,true,25,A date and a place.', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_allowed,true,true,25,A date and a place.');

    -- 13 ----------------------------------------------------------- removing
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := concat_ws(',', app.remove_item(v_closing) ->> 'reason', app.remove_item(v_item2) ->> 'reason');
    perform app.propose_item(v_meet, 'To be withdrawn', null, null, null, null, null);
    v_res := (select i from jsonb_array_elements(app.get_agenda(v_meet) -> 'items') i where i ->> 'title' = 'To be withdrawn');
    v_txt := concat_ws(',', v_txt, app.remove_item((v_res ->> 'id')::uuid) ->> 'ok');
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.remove_item(v_closing) ->> 'ok');
    -- a separate statement: a stable reader sees the snapshot its statement began with
    v_txt := concat_ws(',', v_txt, jsonb_array_length(app.get_agenda(v_meet) -> 'items'));
    reset role;
    select v_txt || ',' || count(*) || ',' || count(*) filter (where removed_at is not null) into v_txt from app.agenda_item where meeting_id = v_meet;
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'the closing item is the leader''s to remove; a proposer removes their own; removed rows stay',
      'expected', 'not_allowed,not_allowed,true,true,2,4,2', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'not_allowed,not_allowed,true,true,2,4,2');

    -- 14 ----------------------------------------------------------- open actions on the next agenda
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, phase, k, window_days, opens_at, closes_at, invited)
    values (v_round, v_org, v_team, 'diagnostic', v_ver, 'released', 4, 14, now() - interval '40 days', now() - interval '26 days', 4);
    set local role authenticated;
    v_focus := (app.make_focus_area(v_team, v_round, 'trust') ->> 'focus_area')::uuid;
    perform app.add_action(v_team, v_focus, 'Agree what good looks like', v_member, current_date + 14);
    perform app.add_action(v_team, v_focus, 'Already done', v_other, current_date + 7);
    perform app.set_action_done(v_team, (select (a ->> 'id')::uuid from jsonb_array_elements(app.get_plan(v_team) -> 'focus_areas' -> 0 -> 'actions') a
                                         where a ->> 'title' = 'Already done'), true);
    v_a := app.get_agenda(v_meet);
    v_txt := concat_ws(',', jsonb_array_length(v_a -> 'open_actions'), v_a -> 'open_actions' -> 0 ->> 'title', v_a -> 'open_actions' -> 0 ->> 'owner_name',
                       v_a -> 'open_actions' -> 0 ->> 'focus', coalesce(app.get_agenda(v_later) ->> 'open_actions', 'none'));
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'the next agenda lists every open action, no done one; a later agenda lists none',
      'expected', '1,Agree what good looks like,Agenda member,Trust,none', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '1,Agree what good looks like,Agenda member,Trust,none');

    -- 15 ----------------------------------------------------------- the time check
    v_a := app.get_agenda(v_meet);
    select concat_ws(',', sum((i ->> 'minutes')::int), v_a -> 'meeting' ->> 'minutes') into v_txt from jsonb_array_elements(v_a -> 'items') i;
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'the time check: each item''s minutes against the meeting''s length',
      'expected', '35,60', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '35,60');

    -- 16 ----------------------------------------------------------- at most the template's number of items
    for v_n in 1..28 loop
      perform app.propose_item(v_meet, 'Filler ' || v_n, null, null, null, null, null);
    end loop;
    v_txt := concat_ws(',', jsonb_array_length(app.get_agenda(v_meet) -> 'items'), app.propose_item(v_meet, 'One too many', null, null, null, null, null) ->> 'reason');
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'an agenda holds at most the template''s 30 items',
      'expected', '30,full', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '30,full');

    -- 17 ----------------------------------------------------------- the guard, from the catalogue
    reset role;
    select count(*) filter (where p.prosrc !~ 'app\.meetings_writable\('), count(*) into v_n, v_m
    from pg_proc p
    where p.pronamespace = 'app'::regnamespace and p.prokind = 'f'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
      and p.prosrc ~* '(insert\s+into|update)\s+app\.(meeting|agenda_item)\M';
    v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'every client function writing a meeting or an agenda item asks meetings_writable',
      'expected', '0 without, at least 7 with', 'actual', v_n || ' without, ' || v_m || ' with', 'pass', v_n = 0 and v_m >= 7);

    -- 18 ----------------------------------------------------------- read-only
    insert into app.subscription (team_id, org_id, plan_key, interval, currency, amount_minor, price_version, method, state,
                                  started_at, current_period_end, past_due_since, company_name, country, provider)
    values (v_team, v_org, 'team', 'year', 'USD', 180000, 1, 'card', 'past_due', now() - interval '40 days', now() - interval '8 days',
            now() - interval '8 days', 'Agenda AS', 'NO', 'development');
    v_txt := app.group_access(v_team);
    set local role authenticated;
    v_txt := concat_ws(',', v_txt, app.plan_meeting(v_team, 'Read only', current_date + 7, '09:00', 60) ->> 'reason',
                       app.propose_item(v_meet, 'Read only', null, null, null, null, null) ->> 'reason',
                       app.update_item(v_item, 'Read only', null, null, null, null, null) ->> 'reason',
                       app.remove_item(v_item) ->> 'reason', app.cancel_meeting(v_later) ->> 'reason',
                       app.get_agenda(v_meet) ->> 'can_propose', jsonb_array_length(app.get_agenda(v_meet) -> 'items'));
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'read-only: nothing is written, and the agenda still reads',
      'expected', 'read_only,unavailable,unavailable,unavailable,unavailable,unavailable,false,30', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'read_only,unavailable,unavailable,unavailable,unavailable,unavailable,false,30');

    -- 19 ----------------------------------------------------------- leaving
    update app.membership set valid_to = now() - interval '1 second' where team_id = v_team and person_id = v_other;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_other), true);
    v_txt := concat_ws(',', coalesce(app.get_agenda(v_meet)::text, 'nothing'), coalesce(app.get_meetings(v_team)::text, 'nothing'));
    reset role;
    delete from app.person where id = v_other;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    select concat_ws(',', v_txt, coalesce(i ->> 'owner', 'no owner'), i ->> 'ready')
      into v_txt from jsonb_array_elements(app.get_agenda(v_meet) -> 'items') i where (i ->> 'id')::uuid = v_item2;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'a former member reads nothing; a person''s removal leaves their item without an owner, not ready',
      'expected', 'nothing,nothing,no owner,false', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'nothing,nothing,no owner,false');

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 20 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'agenda-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Agenda test organisation';
  v_rows := v_rows || jsonb_build_object('seq', 20, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_agenda
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_agenda order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_agenda;
  if v_failed is not null then
    raise exception 'agenda invariants failed: %', v_failed;
  end if;
  if v_count <> 20 then
    raise exception 'agenda invariants: expected 20 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_agenda;
