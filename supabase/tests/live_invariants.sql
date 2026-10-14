-- live_invariants.sql — the live meeting (0019; handoff 6.15; milestone 14: "Two browsers stay in sync within 1
-- second. Comments carry no sender").
--
--      1  the client functions are granted as reviewed; the rules are internal
--      2  no role holds a privilege on the new tables but a member's read of the signal; RLS is on everywhere
--      3  a process comment has no person and no time; the signal holds a version and the last comment's kind
--         and item; presence shares no key with the comments
--      4  the live_meeting flag is a row; off, the meeting reads as without sync
--      5  only the leader starts a planned meeting, on the Team plan; it goes live at its first item; one at a time
--      6  the timer starts, pauses and keeps its time; plus 5 minutes; an item closes and the next is taken up
--      7  a member may not run the meeting; a wrong control is refused; a closed item stays closed
--      8  every change bumps the signal's version
--      9  the signal reaches the meeting's members, through row-level security, and no one else
--     10  process comments: refused while fewer than the threshold are online, then sent with no name
--     11  a decision and actions save per item; an action without an owner is refused
--     12  the parking lot takes side topics; the agenda cannot change while the meeting is live
--     13  ending: held, its comments deleted, items carried over go to the next planned meeting
--     14  an item carried over with no meeting planned goes on when the next one is planned
--     15  a held meeting never changes and cannot run again
--     16  every client function writing the live meeting asks meetings_writable
--     17  read-only: nothing is written, and the meeting still reads
--     18  a former member reads nothing, writes nothing and is not counted online
--     19  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/live_invariants.sql

create unlogged table if not exists public._inv_live(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_live;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_people uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_outsider uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_meet uuid;
  v_next uuid;
  v_later uuid;
  v_free_meet uuid;
  v_items uuid[];
  v_live jsonb;
  v_res jsonb;
  v_txt text;
  v_n int;
  v_m int;
  v_v bigint;
  v_ok boolean;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.get_live(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.start_meeting(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.run_meeting(uuid, text, uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.end_meeting(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.save_decision(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.add_item_action(uuid, text, uuid, date)', 'execute')
          and has_function_privilege('authenticated', 'app.park_topic(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.send_process_comment(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.meeting_here(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.get_meeting_actions(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.get_live(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.send_process_comment(uuid, text)', 'execute')
          and not has_function_privilege('authenticated', 'app.flag_on(text)', 'execute')
          and not has_function_privilege('authenticated', 'app.online_count(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.live_bump(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.live_pause(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.live_next_item(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.carry_items(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.next_meeting(uuid)', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the client functions are granted as reviewed; the rules are internal',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- table privileges
  select string_agg(g.role || ' ' || p.priv || ' ' || t.tbl, ', ' order by t.tbl, g.role, p.priv) into v_txt
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.feature_flag'), ('app.decision'), ('app.parked_topic'), ('app.process_comment'), ('app.meeting_presence'),
                     ('app.meeting_signal')) as t (tbl)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.tbl, p.priv);
  v_ok := (select bool_and(relrowsecurity) from pg_class
           where oid in ('app.feature_flag'::regclass, 'app.decision'::regclass, 'app.parked_topic'::regclass, 'app.process_comment'::regclass,
                         'app.meeting_presence'::regclass, 'app.meeting_signal'::regclass));
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no privilege on the new tables but a member''s read of the signal; RLS on everywhere',
    'expected', 'authenticated select app.meeting_signal, RLS on', 'actual', coalesce(v_txt, 'none') || ', ' || case when v_ok then 'RLS on' else 'RLS off' end,
    'pass', v_txt = 'authenticated select app.meeting_signal' and v_ok);

  -- 3 -------------------------------------------------------------- no sender, from the catalogue
  select string_agg(attname, ',' order by attnum) into v_txt from pg_attribute
  where attrelid = 'app.process_comment'::regclass and attnum > 0 and not attisdropped;
  v_ok := v_txt = 'id,org_id,team_id,meeting_id,agenda_item_id,kind';
  select string_agg(attname, ',' order by attnum) into v_txt from pg_attribute
  where attrelid = 'app.meeting_signal'::regclass and attnum > 0 and not attisdropped;
  v_ok := v_ok and v_txt = 'meeting_id,team_id,version,comment_kind,comment_item,comment_seq';
  -- no foreign key joins the comments and the presence, either way
  v_ok := v_ok and not exists (select 1 from pg_constraint c where c.contype = 'f'
                               and ((c.conrelid = 'app.process_comment'::regclass and c.confrelid = 'app.meeting_presence'::regclass)
                                 or (c.conrelid = 'app.meeting_presence'::regclass and c.confrelid = 'app.process_comment'::regclass)));
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'a comment has no person and no time; the signal a version and the last kind and item',
    'expected', 'as reviewed', 'actual', case when v_ok then 'as reviewed' else 'not as reviewed' end, 'pass', v_ok);

  begin
    insert into auth.users (id, email) select p, 'live-test-' || i || '@example.invalid' from unnest(v_people) with ordinality as x (p, i);
    insert into auth.users (id, email) values (v_outsider, 'live-test-out@example.invalid');
    insert into app.person (id, display_name) select p, 'Live person ' || i from unnest(v_people) with ordinality as x (p, i);
    insert into app.person (id, display_name) values (v_outsider, 'Live outsider');
    insert into app.organisation (id, name) values (v_org, 'Live test organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Live test group'), (v_free, v_org, 'Live free group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from)
    select v_org, v_team, p, case when i = 1 then 'leader' else 'member' end, now() - interval '60 days' from unnest(v_people) with ordinality as x (p, i);
    insert into app.membership (org_id, team_id, person_id, role, valid_from) values (v_org, v_free, v_people[1], 'leader', now() - interval '60 days');
    insert into app.trial (team_id, org_id, started_at, ends_at) values (v_team, v_org, now() - interval '1 day', now() + interval '13 days');

    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_people[1]), true);
    v_meet := (app.plan_meeting(v_team, 'Live meeting', current_date, '09:00', 60) ->> 'meeting')::uuid;
    perform app.propose_item(v_meet, 'First item', 'decision', 'A yes or no.', v_people[2], 10, null);
    perform app.propose_item(v_meet, 'Second item', 'discussion', 'Views heard.', v_people[3], 10, null);
    perform app.propose_item(v_meet, 'Third item', 'information', 'Everyone knows.', v_people[1], 5, null);
    reset role;
    select array_agg(i.id order by i.closing, i.ordinal) into v_items from app.agenda_item i where i.meeting_id = v_meet;
    -- a Free group's meeting, written directly: the functions refuse to plan one there
    insert into app.meeting (org_id, team_id, title, meets_on, starts_at, minutes, template_version, created_by)
    values (v_org, v_free, 'Free meeting', current_date, '09:00', 60, 1, v_people[1]) returning id into v_free_meet;

    -- 4 ------------------------------------------------------------ the flag
    v_txt := concat_ws(',', app.flag_on('live_meeting')::text, app.flag_on('something_else')::text);
    update app.feature_flag set "on" = false where key = 'live_meeting';
    v_txt := concat_ws(',', v_txt, app.flag_on('live_meeting')::text);
    update app.feature_flag set "on" = true where key = 'live_meeting';
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'the live_meeting flag is a row, on; an unknown flag is off; off reads as off',
      'expected', 'true,false,false', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,false,false');

    -- 5 ------------------------------------------------------------ starting
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_people[2]), true);
    v_txt := concat_ws(',', app.start_meeting(v_meet) ->> 'reason', coalesce(app.get_live(v_meet)::text, 'nothing'));
    perform set_config('request.jwt.claims', format(claims, v_people[1]), true);
    v_txt := concat_ws(',', v_txt, app.start_meeting(v_free_meet) ->> 'reason', app.start_meeting(v_meet) ->> 'ok', app.start_meeting(v_meet) ->> 'reason');
    v_next := (app.plan_meeting(v_team, 'Next meeting', current_date + 7, '09:00', 60) ->> 'meeting')::uuid;
    v_txt := concat_ws(',', v_txt, app.start_meeting(v_next) ->> 'reason');
    v_live := app.get_live(v_meet);
    v_txt := concat_ws(',', v_txt, v_live -> 'meeting' ->> 'status', (v_live ->> 'current' = v_items[1]::text)::text, v_live ->> 'timer_started_at',
                       v_live ->> 'sync', v_live ->> 'can_run');
    reset role;
    select v_txt || ',' || count(*) into v_txt from app.meeting_signal where meeting_id = v_meet;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'only the leader starts, on the Team plan; live at the first item; one at a time',
      'expected', 'not_leader,nothing,unavailable,true,invalid,invalid,live,true,true,true,1',
      'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'not_leader,nothing,unavailable,true,invalid,invalid,live,true,true,true,1');

    -- 6 ------------------------------------------------------------ the controls
    select version into v_v from app.meeting_signal where meeting_id = v_meet;
    set local role authenticated;
    v_txt := app.run_meeting(v_meet, 'start') ->> 'ok';
    reset role;
    v_txt := concat_ws(',', v_txt, (select (timer_started_at is not null)::text from app.meeting where id = v_meet));
    -- 90 seconds on the clock, then a pause keeps them
    alter table app.meeting disable trigger meeting_guard;
    update app.meeting set timer_started_at = now() - interval '90 seconds' where id = v_meet;
    alter table app.meeting enable trigger meeting_guard;
    set local role authenticated;
    v_txt := concat_ws(',', v_txt, app.run_meeting(v_meet, 'pause') ->> 'ok', app.run_meeting(v_meet, 'extend') ->> 'ok');
    reset role;
    select concat_ws(',', v_txt, i.elapsed_seconds, i.extra_minutes, (m.timer_started_at is null)::text)
      into v_txt from app.agenda_item i join app.meeting m on m.id = i.meeting_id where i.id = v_items[1];
    set local role authenticated;
    v_txt := concat_ws(',', v_txt, app.run_meeting(v_meet, 'reached') ->> 'ok');
    v_live := app.get_live(v_meet);
    v_txt := concat_ws(',', v_txt, v_live -> 'items' -> 0 ->> 'closed_as', (v_live ->> 'current' = v_items[2]::text)::text);
    -- each read in a statement of its own: a stable reader sees the snapshot its statement began with
    v_txt := concat_ws(',', v_txt, app.run_meeting(v_meet, 'take', v_items[3]) ->> 'ok');
    v_txt := concat_ws(',', v_txt, (app.get_live(v_meet) ->> 'current' = v_items[3]::text)::text);
    v_txt := concat_ws(',', v_txt, app.run_meeting(v_meet, 'take', v_items[2]) ->> 'ok');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'the timer starts, pauses and keeps its time; plus 5; an item closes, the next is taken up',
      'expected', 'true,true,true,true,90,5,true,true,reached,true,true,true,true', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,true,true,true,90,5,true,true,reached,true,true,true,true');

    -- 7 ------------------------------------------------------------ who runs it, and what is refused
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_people[2]), true);
    v_txt := app.run_meeting(v_meet, 'start') ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_people[1]), true);
    v_txt := concat_ws(',', v_txt, app.run_meeting(v_meet, 'dance') ->> 'reason', app.run_meeting(v_meet, 'take', v_items[1]) ->> 'reason',
                       app.run_meeting(v_meet, 'take', gen_random_uuid()) ->> 'reason');
    reset role;
    begin
      update app.agenda_item set closed_as = 'parked' where id = v_items[1];
      v_txt := v_txt || ',changed';
    exception when check_violation then
      v_txt := v_txt || ',stays closed';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a member may not run it; a wrong control or a closed item is refused; a closed item stays closed',
      'expected', 'not_leader,invalid,invalid,invalid,stays closed', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,invalid,invalid,invalid,stays closed');

    -- 8 ------------------------------------------------------------ every change bumps the signal
    select version - v_v into v_n from app.meeting_signal where meeting_id = v_meet;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'every change bumps the signal''s version: six controls, six bumps',
      'expected', '6', 'actual', v_n::text, 'pass', v_n = 6);

    -- 9 ------------------------------------------------------------ the signal, through row-level security
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_people[4]), true);
    select count(*) into v_n from app.meeting_signal;
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    select count(*) into v_m from app.meeting_signal;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'the signal reaches the meeting''s members and no one else',
      'expected', '1 member, 0 outsider', 'actual', v_n || ' member, ' || v_m || ' outsider', 'pass', v_n = 1 and v_m = 0);

    -- 10 ----------------------------------------------------------- process comments, with no name
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_people[2]), true);
    v_res := app.meeting_here(v_meet);
    v_txt := concat_ws(',', v_res ->> 'online', app.send_process_comment(v_meet, 'off_track') ->> 'reason', app.get_live(v_meet) ->> 'comments_open');
    for v_n in 3..4 loop
      perform set_config('request.jwt.claims', format(claims, v_people[v_n]), true);
      perform app.meeting_here(v_meet);
    end loop;
    perform set_config('request.jwt.claims', format(claims, v_people[1]), true);
    v_res := app.meeting_here(v_meet);
    perform set_config('request.jwt.claims', format(claims, v_people[2]), true);
    v_txt := concat_ws(',', v_txt, v_res ->> 'online', app.get_live(v_meet) ->> 'comments_open', app.send_process_comment(v_meet, 'off_track') ->> 'ok',
                       app.send_process_comment(v_meet, 'gossip') ->> 'reason');
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := concat_ws(',', v_txt, app.send_process_comment(v_meet, 'purpose') ->> 'reason');
    perform set_config('request.jwt.claims', format(claims, v_people[3]), true);
    v_live := app.get_live(v_meet);
    select concat_ws(',', v_txt, i -> 'comments' ->> 'off_track', i -> 'comments' ->> 'purpose') into v_txt
    from jsonb_array_elements(v_live -> 'items') i where (i ->> 'id')::uuid = v_items[2];
    -- nothing in what a member reads names who sent it
    v_ok := v_live::text not like '%comment_by%' and v_live::text not like '%sender%';
    reset role;
    select concat_ws(',', v_txt, s.comment_kind, (s.comment_item = v_items[2])::text, s.comment_seq, case when v_ok then 'no sender' else 'a sender' end)
      into v_txt from app.meeting_signal s where s.meeting_id = v_meet;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'refused below the threshold online, then sent with no name; the signal carries kind and item',
      'expected', '1,too_few,false,4,true,true,invalid,not_member,1,0,off_track,true,1,no sender', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '1,too_few,false,4,true,true,invalid,not_member,1,0,off_track,true,1,no sender');

    -- 11 ----------------------------------------------------------- decisions and actions per item
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_people[3]), true);
    v_txt := concat_ws(',', app.save_decision(v_items[2], ' We go ahead. ') ->> 'ok', app.save_decision(v_items[2], 'We go ahead in May.') ->> 'ok',
                       app.save_decision(v_items[2], '  ') ->> 'reason',
                       app.add_item_action(v_items[2], 'Draft the plan', null, current_date + 14) ->> 'reason',
                       app.add_item_action(v_items[2], 'Draft the plan', v_outsider, current_date + 14) ->> 'reason',
                       app.add_item_action(v_items[2], 'Draft the plan', v_people[4], current_date + 14) ->> 'ok');
    v_live := app.get_live(v_meet);
    select concat_ws(',', v_txt, i ->> 'decision', i -> 'actions' -> 0 ->> 'title', i -> 'actions' -> 0 ->> 'owner_name') into v_txt
    from jsonb_array_elements(v_live -> 'items') i where (i ->> 'id')::uuid = v_items[2];
    v_txt := concat_ws(',', v_txt, jsonb_array_length(app.get_meeting_actions(v_team)), app.get_meeting_actions(v_team) -> 0 ->> 'item',
                       jsonb_array_length(v_live -> 'open_actions'));
    reset role;
    select v_txt || ',' || count(*) into v_txt from app.decision where meeting_id = v_meet;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a decision and actions save per item; without an owner an action is refused',
      'expected', 'true,true,invalid,no_owner,no_owner,true,We go ahead in May.,Draft the plan,Live person 4,1,Second item,1,1', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,true,invalid,no_owner,no_owner,true,We go ahead in May.,Draft the plan,Live person 4,1,Second item,1,1');

    -- 12 ----------------------------------------------------------- the parking lot; the agenda is fixed while live
    set local role authenticated;
    v_txt := concat_ws(',', app.park_topic(v_meet, ' The office move ') ->> 'ok', app.park_topic(v_meet, '') ->> 'reason');
    v_txt := concat_ws(',', v_txt, app.get_live(v_meet) -> 'parking' -> 0 ->> 'text',
                       app.propose_item(v_meet, 'Late item', null, null, null, null, null) ->> 'reason',
                       app.update_item(v_items[2], 'Renamed', null, null, null, null, null) ->> 'reason');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'the parking lot takes side topics; the agenda cannot change while the meeting is live',
      'expected', 'true,invalid,The office move,invalid,invalid', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,invalid,The office move,invalid,invalid');

    -- 13 ----------------------------------------------------------- ending
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_people[1]), true);
    perform app.run_meeting(v_meet, 'carried_over');
    perform set_config('request.jwt.claims', format(claims, v_people[2]), true);
    v_txt := app.end_meeting(v_meet) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_people[1]), true);
    v_txt := concat_ws(',', v_txt, app.end_meeting(v_meet) ->> 'ok');
    v_live := app.get_live(v_meet);
    v_txt := concat_ws(',', v_txt, v_live -> 'meeting' ->> 'status', v_live ->> 'can_run', v_live ->> 'can_add', coalesce(v_live ->> 'open_actions', 'none'));
    reset role;
    select concat_ws(',', v_txt, (select count(*) from app.process_comment where meeting_id = v_meet),
                     (select count(*) from app.agenda_item where meeting_id = v_next and carried_from = v_items[2]),
                     (select (carried_to is not null)::text from app.agenda_item where id = v_items[2]))
      into v_txt;
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'only the leader ends it: held, its comments deleted, items carried over to the next planned meeting',
      'expected', 'not_leader,true,held,false,false,none,0,1,true', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,true,held,false,false,none,0,1,true');

    -- 14 ----------------------------------------------------------- carried with no meeting planned
    set local role authenticated;
    perform app.cancel_meeting(v_next);
    v_later := (app.plan_meeting(v_team, 'Second live meeting', current_date, '13:00', 60) ->> 'meeting')::uuid;
    perform app.start_meeting(v_later);
    perform app.run_meeting(v_later, 'carried_over');
    perform app.end_meeting(v_later);
    reset role;
    select count(*) into v_n from app.agenda_item where team_id = v_team and closed_as = 'carried_over' and carried_to is null;
    set local role authenticated;
    v_next := (app.plan_meeting(v_team, 'Planned later', current_date + 14, '09:00', 60) ->> 'meeting')::uuid;
    reset role;
    select concat_ws(',', v_n, count(*) filter (where carried_from is not null), count(*)) into v_txt
    from app.agenda_item where meeting_id = v_next and removed_at is null;
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'an item carried over with no meeting planned goes on when the next is planned',
      'expected', '1,1,2', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '1,1,2');

    -- 15 ----------------------------------------------------------- a held meeting
    begin
      update app.meeting set title = 'Rewritten' where id = v_meet;
      v_txt := 'changed';
    exception when check_violation then
      v_txt := 'fixed';
    end;
    set local role authenticated;
    v_txt := concat_ws(',', v_txt, app.start_meeting(v_meet) ->> 'reason', app.run_meeting(v_meet, 'start') ->> 'reason',
                       app.save_decision(v_items[3], 'Too late.') ->> 'reason');
    -- with no meeting ahead, every meeting reads as not the next one: false, never null
    perform app.cancel_meeting(v_next);
    select concat_ws(',', v_txt, coalesce(app.get_meetings(v_team) ->> 'next', 'no next'),
                     string_agg(distinct jsonb_typeof(m -> 'next') || '=' || (m ->> 'next'), '|'),
                     jsonb_typeof(app.get_agenda(v_meet) -> 'meeting' -> 'next'))
      into v_txt from jsonb_array_elements(app.get_meetings(v_team) -> 'meetings') m;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'a held meeting never changes and cannot run again; with none ahead, none reads as next',
      'expected', 'fixed,invalid,invalid,invalid,no next,boolean=false,boolean', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'fixed,invalid,invalid,invalid,no next,boolean=false,boolean');

    -- 16 ----------------------------------------------------------- the guard, from the catalogue
    select count(*) filter (where p.prosrc !~ 'app\.meetings_writable\('), count(*) into v_n, v_m
    from pg_proc p
    where p.pronamespace = 'app'::regnamespace and p.prokind = 'f'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
      and p.prosrc ~* '(insert\s+into|update|delete\s+from)\s+app\.(meeting|agenda_item|decision|parked_topic|process_comment|meeting_signal)\M'
      and p.proname <> 'meeting_here';
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'every client function writing the live meeting asks meetings_writable (the heartbeat aside)',
      'expected', '0 without, at least 12 with', 'actual', v_n || ' without, ' || v_m || ' with', 'pass', v_n = 0 and v_m >= 12);

    -- 17 ----------------------------------------------------------- read-only
    set local role authenticated;
    v_later := (app.plan_meeting(v_team, 'Before read-only', current_date, '15:00', 60) ->> 'meeting')::uuid;
    perform app.start_meeting(v_later);
    reset role;
    insert into app.subscription (team_id, org_id, plan_key, interval, currency, amount_minor, price_version, method, state,
                                  started_at, current_period_end, past_due_since, company_name, country, provider)
    values (v_team, v_org, 'team', 'year', 'USD', 180000, 1, 'card', 'past_due', now() - interval '40 days', now() - interval '8 days',
            now() - interval '8 days', 'Live AS', 'NO', 'development');
    set local role authenticated;
    v_live := app.get_live(v_later);
    v_txt := concat_ws(',', app.run_meeting(v_later, 'start') ->> 'reason', app.end_meeting(v_later) ->> 'reason',
                       app.park_topic(v_later, 'Read only') ->> 'reason', app.send_process_comment(v_later, 'purpose') ->> 'reason',
                       v_live -> 'meeting' ->> 'status', v_live ->> 'can_run', v_live ->> 'can_add');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'read-only: nothing is written, and the meeting still reads',
      'expected', 'unavailable,unavailable,unavailable,unavailable,live,false,false', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'unavailable,unavailable,unavailable,unavailable,live,false,false');

    -- 18 ----------------------------------------------------------- a former member
    update app.membership set valid_to = now() - interval '1 second' where team_id = v_team and person_id = v_people[5];
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_people[5]), true);
    v_txt := concat_ws(',', coalesce(app.get_live(v_later)::text, 'nothing'), app.meeting_here(v_later) ->> 'reason',
                       app.send_process_comment(v_later, 'purpose') ->> 'reason');
    reset role;
    insert into app.meeting_presence (meeting_id, person_id, seen_at) values (v_later, v_people[5], now());
    v_txt := concat_ws(',', v_txt, app.online_count(v_later));
    v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'a former member reads nothing, writes nothing and is not counted online',
      'expected', 'nothing,not_member,not_member,0', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'nothing,not_member,not_member,0');

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 19 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'live-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Live test organisation';
  v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_live
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_live order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_live;
  if v_failed is not null then
    raise exception 'live invariants failed: %', v_failed;
  end if;
  if v_count <> 19 then
    raise exception 'live invariants: expected 19 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_live;
