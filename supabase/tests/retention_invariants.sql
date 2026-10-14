-- retention_invariants.sql — the retention jobs and the Group tab (0026; handoff 6.18 and 8; milestone 18; D-56).
--
--      1  the Group tab's functions are granted as reviewed; the job and its helpers to no role
--      2  before its date the leader is shown when the Team data goes, and the job leaves it
--      3  on its date the job deletes the group's Team data: rounds, answers, scores, pulses, meetings, plan, charter
--      4  what the Free plan holds stays: the group, its members, its scan, invitations and shares; no date is shown
--      5  the job does not run twice, and a later cancel shows a date of its own again
--      6  a cancel with its date to come keeps everything; the demo organisation is never touched
--      7  a Free group with no sign-in for 12 months goes, with an organisation left empty
--      8  a recent sign-in, a paid plan, another group of the organisation or the demo keeps a group; a former
--         member's sign-in does not
--      9  the Group tab: a current member reads it, only the leader may edit, an outsider reads nothing
--     10  only the leader renames the group, to 1 to 120 characters
--     11  only the leader raises the threshold, up to 8, never lower; audited; an open round keeps its k
--     12  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing. The job runs over every group in
-- the database, so the checks read this suite's groups, never the job's counts.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/retention_invariants.sql

create unlogged table if not exists public._inv_retention(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_retention;

-- the Team data a group holds, counted per table, as the database owner sees it
create or replace function pg_temp.team_data(p_team uuid) returns text
  language sql
as $$
  select concat_ws(',',
    (select count(*) from app.assessment_round r where r.team_id = p_team),
    (select count(*) from app.response_set s join app.assessment_round r on r.id = s.round_id where r.team_id = p_team),
    (select count(*) from app.participation p join app.assessment_round r on r.id = p.round_id where r.team_id = p_team),
    (select count(*) from app.factor_score f join app.assessment_round r on r.id = f.round_id where r.team_id = p_team),
    (select count(*) from app.item_score i join app.assessment_round r on r.id = i.round_id where r.team_id = p_team),
    (select count(*) from app.pulse_question q join app.assessment_round r on r.id = q.round_id where r.team_id = p_team),
    (select count(*) from app.pulse_schedule s where s.team_id = p_team),
    (select count(*) from app.focus_area f where f.team_id = p_team),
    (select count(*) from app.action a where a.team_id = p_team),
    (select count(*) from app.meeting m where m.team_id = p_team),
    (select count(*) from app.agenda_item i where i.team_id = p_team),
    (select count(*) from app.charter_version c where c.team_id = p_team),
    (select count(*) from app.working_agreement w join app.charter_version c on c.id = w.version_id where c.team_id = p_team))
$$;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  -- group A ends its trial unpaid; B cancels; C is the demo's; D to H are Free groups for the sign-in rule
  v_lead uuid := gen_random_uuid();
  v_m uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_lead_b uuid := gen_random_uuid();
  v_lead_c uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_idle uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                         gen_random_uuid()];
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();
  v_team_b uuid := gen_random_uuid();
  v_org_c uuid := gen_random_uuid();
  v_team_c uuid := gen_random_uuid();
  v_org_d uuid := gen_random_uuid();
  v_team_d uuid := gen_random_uuid();
  v_org_e uuid := gen_random_uuid();
  v_team_e uuid := gen_random_uuid();
  v_org_f uuid := gen_random_uuid();
  v_team_f uuid := gen_random_uuid();
  v_org_g uuid := gen_random_uuid();
  v_team_g1 uuid := gen_random_uuid();
  v_team_g2 uuid := gen_random_uuid();
  v_org_h uuid := gen_random_uuid();
  v_team_h uuid := gen_random_uuid();
  v_ver uuid;
  v_scan_ver uuid;
  v_quick uuid;
  v_round uuid := gen_random_uuid();
  v_pulse uuid;
  v_meeting uuid;
  v_res jsonb;
  v_txt text;
  v_txt2 text;
  v_before text;
  v_n int;
  v_ok boolean;
  r record;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.get_group_settings(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.rename_group(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.raise_threshold(uuid, int)', 'execute')
          and not exists (select 1 from unnest(array['app.get_group_settings(uuid)', 'app.rename_group(uuid, text)', 'app.raise_threshold(uuid, int)']) f
                          where has_function_privilege('anon', f, 'execute') or has_function_privilege('service_role', f, 'execute'))
          and not exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) g,
                                        unnest(array['app.retention_tick()', 'app.purge_team_data(uuid)', 'app.team_data_due_at(uuid)',
                                                     'app.team_data_pending_until(uuid)', 'app.group_last_seen(uuid)']) f
                          where has_function_privilege(g, f, 'execute'));
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the Group tab''s functions are granted as reviewed; the job and its helpers to no role',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';
  select v.id into strict v_scan_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'scan' and v.status = 'published';
  select t.id into strict v_quick from app.profile_test t where t.key = 'quick';

  begin
    insert into auth.users (id, email, last_sign_in_at)
    select p.id, 'retention-test-' || p.n || '@example.invalid', now() - interval '1 day'
    from unnest(array[v_lead, v_m[1], v_m[2], v_m[3], v_lead_b, v_lead_c, v_outsider] || v_idle) with ordinality as p (id, n);
    insert into app.person (id, display_name)
    select p.id, 'Retention person ' || p.n from unnest(array[v_lead, v_m[1], v_m[2], v_m[3], v_lead_b, v_lead_c, v_outsider] || v_idle) with ordinality as p (id, n);
    insert into app.organisation (id, name, is_demo) values
      (v_org, 'Retention A organisation', false), (v_org_b, 'Retention B organisation', false), (v_org_c, 'Retention C organisation', true),
      (v_org_d, 'Retention D organisation', false), (v_org_e, 'Retention E organisation', false), (v_org_f, 'Retention F organisation', false),
      (v_org_g, 'Retention G organisation', false), (v_org_h, 'Retention H organisation', false);
    insert into app.team (id, org_id, name, created_at) values
      (v_team, v_org, 'Retention A group', now() - interval '200 days'), (v_team_b, v_org_b, 'Retention B group', now() - interval '200 days'),
      (v_team_c, v_org_c, 'Retention C group', now() - interval '2 years'), (v_team_d, v_org_d, 'Retention D group', now() - interval '13 months'),
      (v_team_e, v_org_e, 'Retention E group', now() - interval '13 months'), (v_team_f, v_org_f, 'Retention F group', now() - interval '13 months'),
      (v_team_g1, v_org_g, 'Retention G1 group', now() - interval '13 months'), (v_team_g2, v_org_g, 'Retention G2 group', now() - interval '1 month'),
      (v_team_h, v_org_h, 'Retention H group', now() - interval '13 months');
    insert into app.membership (org_id, team_id, person_id, role, valid_from, valid_to) values
      (v_org, v_team, v_lead, 'leader', now() - interval '200 days', null), (v_org, v_team, v_m[1], 'member', now() - interval '200 days', null),
      (v_org, v_team, v_m[2], 'member', now() - interval '200 days', null), (v_org, v_team, v_m[3], 'member', now() - interval '200 days', null),
      (v_org_b, v_team_b, v_lead_b, 'leader', now() - interval '200 days', null),
      (v_org_c, v_team_c, v_lead_c, 'leader', now() - interval '2 years', null),
      (v_org_d, v_team_d, v_idle[1], 'leader', now() - interval '13 months', null),
      (v_org_e, v_team_e, v_idle[2], 'leader', now() - interval '13 months', null),
      (v_org_f, v_team_f, v_idle[3], 'leader', now() - interval '13 months', null),
      (v_org_g, v_team_g1, v_idle[4], 'leader', now() - interval '13 months', null),
      (v_org_g, v_team_g2, v_outsider, 'leader', now() - interval '1 month', null),
      (v_org_h, v_team_h, v_idle[5], 'leader', now() - interval '13 months', null),
      (v_org_h, v_team_h, v_idle[6], 'member', now() - interval '13 months', now() - interval '2 days');
    -- who signed in when: D, F, G1 and H's current members not for 13 months; E's leader a month ago; H's former member yesterday
    update auth.users set last_sign_in_at = now() - interval '13 months' where id = any (array[v_idle[1], v_idle[3], v_idle[4], v_idle[5], v_lead_c]);
    update auth.users set last_sign_in_at = now() - interval '1 month' where id = v_idle[2];
    insert into app.subscription (team_id, org_id, plan_key, interval, currency, amount_minor, price_version, method, state,
                                  started_at, current_period_end, company_name, country, provider)
    values (v_team_f, v_org_f, 'team', 'year', 'USD', 180000, 1, 'card', 'active', now() - interval '13 months', now() + interval '11 months',
            'Retention F AS', 'NO', 'development'),
           (v_team_b, v_org_b, 'team', 'year', 'USD', 180000, 1, 'card', 'active', now() - interval '200 days', now() + interval '165 days',
            'Retention B AS', 'NO', 'development');
    -- A and C on their trials while their Team data is made
    insert into app.trial (team_id, org_id, started_at, ends_at) values
      (v_team, v_org, now() - interval '1 day', now() + interval '13 days'), (v_team_c, v_org_c, now() - interval '1 day', now() + interval '13 days');
    -- what the Free plan holds: A's scan, an invitation and a share
    insert into app.scan_session (org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
    values (v_org, v_team, v_scan_ver, 'retention-test-code-' || substr(md5(v_team::text), 1, 12), 4, 4, 7, now() - interval '150 days', now() - interval '143 days');
    insert into app.invitation (org_id, team_id, email, display_name, token_hash, created_by, created_at, expires_at)
    values (v_org, v_team, 'retention-test-invitee@example.invalid', 'Invitee', sha256('retention-test-token'::bytea), v_lead, now() - interval '1 day', now() + interval '13 days');

    -- A's Team data: a charter, a diagnostic answered by four and closed, two focus areas with an action, pulses
    -- started, and a meeting with items; B and C a charter and a meeting
    for r in select * from (values (v_team, v_lead), (v_team_b, v_lead_b), (v_team_c, v_lead_c)) x(team, lead) loop
      set local role authenticated;
      perform set_config('request.jwt.claims', format(claims, r.lead), true);
      perform app.save_charter_draft(r.team, 'We set the direction.', '[{"title": "Set strategy", "right": "decide"}]',
                                     '["Agreement 1", "Agreement 2", "Agreement 3"]');
      perform app.agree_charter(r.team);
      v_meeting := (app.plan_meeting(r.team, 'Retention meeting', current_date + 3, '09:00', 60) ->> 'meeting')::uuid;
      perform app.propose_item(v_meeting, 'Retention item', 'discussion', 'A way forward.', r.lead, 10, null);
      reset role;
    end loop;
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org, v_team, 'diagnostic', v_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round);
    for r in select unnest(array[v_lead, v_m[1], v_m[2], v_m[3]]) as who loop
      set local role authenticated;
      perform set_config('request.jwt.claims', format(claims, r.who), true);
      perform app.submit_response(v_round, (select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 4))
                                            from app.instrument_version_item vi where vi.instrument_version_id = v_ver));
      reset role;
    end loop;
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_round;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    perform app.close_round(v_round);
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    perform app.make_focus_area(v_team, v_round, 'clear_purpose');
    perform app.make_focus_area(v_team, v_round, 'trust');
    reset role;
    select f.id into v_meeting from app.focus_area f where f.team_id = v_team limit 1;
    set local role authenticated;
    perform app.add_action(v_team, v_meeting, 'Retention action', v_m[1], current_date + 7);
    v_pulse := (app.start_pulses(v_team, 4, 7) ->> 'round')::uuid;
    -- the member shares a Leader Profile with the group
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    perform app.save_profile('quick', (select jsonb_object_agg(i.id::text, 3) from app.profile_item i where i.test_id = v_quick));
    perform app.set_profile_share(v_team, 'domains');
    reset role;

    -- A's trial ended unpaid 100 days ago; B cancels, its period over, its data due in 30 days; C's trial is long over
    update app.trial set started_at = now() - interval '114 days', ends_at = now() - interval '100 days' where team_id = v_team;
    update app.trial set started_at = now() - interval '400 days', ends_at = now() - interval '386 days' where team_id = v_team_c;
    update app.subscription set state = 'cancelled', cancelled_at = now() - interval '200 days', cancel_effective_at = now() - interval '60 days',
                                deletion_due_at = now() + interval '30 days'
    where team_id = v_team_b;
    v_before := pg_temp.team_data(v_team);

    -- 2 ------------------------------------------------------------ the date the leader sees
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    select p.deletion_due_at::date::text, p.access into v_txt, v_txt2 from app.get_group_plan(v_team) p;
    reset role;
    v_ok := v_txt = (now() - interval '10 days')::date::text and v_txt2 = 'free'
            and not exists (select 1 from unnest(string_to_array(v_before, ',')) c where c::int = 0);
    v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'before its date the leader is shown when the Team data goes, and every Team table holds rows',
      'expected', 'trial end + 90 days, free, all held', 'actual', coalesce(v_txt, 'none') || ', ' || coalesce(v_txt2, 'none') || ', ' || v_before,
      'pass', v_ok);

    -- 3 ------------------------------------------------------------ the job, on the date
    perform app.retention_tick();
    v_txt := pg_temp.team_data(v_team);
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'on its date the job deletes the group''s Team data: rounds, answers, scores, pulses, meetings, plan, charter',
      'expected', '0,0,0,0,0,0,0,0,0,0,0,0,0', 'actual', v_txt, 'pass', v_txt = '0,0,0,0,0,0,0,0,0,0,0,0,0');

    -- 4 ------------------------------------------------------------ the Free plan's stays
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    select concat_ws(',', p.access, coalesce(p.deletion_due_at::text, 'no date')) into v_txt from app.get_group_plan(v_team) p;
    reset role;
    v_txt := concat_ws(',', v_txt,
      (select count(*) from app.team where id = v_team), (select count(*) from app.membership where team_id = v_team),
      (select count(*) from app.scan_session where team_id = v_team), (select count(*) from app.invitation where team_id = v_team),
      (select count(*) from app.profile_share where team_id = v_team), (select count(*) from app.trial where team_id = v_team),
      (select (team_data_deleted_at = now())::text from app.team where id = v_team));
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'what the Free plan holds stays: the group, its members, its scan, invitations and shares; no date is shown',
      'expected', 'free,no date,1,4,1,1,1,1,true', 'actual', v_txt, 'pass', v_txt = 'free,no date,1,4,1,1,1,1,true');

    -- 5 ------------------------------------------------------------ once; a later cancel again
    v_txt := coalesce(app.team_data_pending_until(v_team)::text, 'none');
    update app.subscription set deletion_due_at = now() - interval '1 minute' where team_id = v_team_b;
    perform app.retention_tick();
    v_txt := concat_ws(',', v_txt, pg_temp.team_data(v_team_b) = '0,0,0,0,0,0,0,0,0,0,0,0,0',
                       coalesce(app.team_data_pending_until(v_team_b)::text, 'none'));
    update app.subscription set deletion_due_at = now() + interval '90 days' where team_id = v_team_b;
    v_txt := concat_ws(',', v_txt, app.team_data_pending_until(v_team_b) = now() + interval '90 days');
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'the job does not run twice, and a later cancel shows a date of its own again',
      'expected', 'none,t,none,t', 'actual', v_txt, 'pass', v_txt = 'none,t,none,t');

    -- 6 ------------------------------------------------------------ a date to come; the demo
    -- E's trial ended 46 days ago, so its charter waits 44 more days
    insert into app.trial (team_id, org_id, started_at, ends_at) values (v_team_e, v_org_e, now() - interval '1 day', now() + interval '13 days');
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_idle[2]), true);
    perform app.save_charter_draft(v_team_e, 'We set the direction.', '[{"title": "Set strategy", "right": "decide"}]', '["Agreement 1"]');
    perform app.agree_charter(v_team_e);
    reset role;
    update app.trial set started_at = now() - interval '60 days', ends_at = now() - interval '46 days' where team_id = v_team_e;
    perform app.retention_tick();
    v_txt := concat_ws(',', (select count(*) from app.charter_version where team_id = v_team_e),
                       app.team_data_pending_until(v_team_e)::date = (now() + interval '44 days')::date,
                       (select count(*) from app.charter_version where team_id = v_team_c), (select count(*) from app.meeting where team_id = v_team_c),
                       (select count(*) from app.team where id = v_team_c));
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'a deletion with its date to come keeps everything; the demo organisation is never touched',
      'expected', '1,t,1,1,1', 'actual', v_txt, 'pass', v_txt = '1,t,1,1,1');

    -- 7 ------------------------------------------------------------ an idle Free group
    v_txt := concat_ws(',', (select count(*) from app.team where id in (v_team_d, v_team_h)),
                       (select count(*) from app.organisation where id in (v_org_d, v_org_h)),
                       (select count(*) from app.membership where team_id in (v_team_d, v_team_h)),
                       (select count(*) from app.person where id in (v_idle[1], v_idle[5])),
                       (select count(*) from auth.users where id in (v_idle[1], v_idle[5])));
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a Free group with no sign-in for 12 months goes, with an organisation left empty; its people''s accounts stay',
      'expected', '0,0,0,2,2', 'actual', v_txt, 'pass', v_txt = '0,0,0,2,2');

    -- 8 ------------------------------------------------------------ what keeps a group
    v_txt := concat_ws(',', (select count(*) from app.team where id = v_team_e), (select count(*) from app.team where id = v_team_f),
                       (select count(*) from app.team where id = v_team_g1), (select count(*) from app.team where id = v_team_g2),
                       (select count(*) from app.organisation where id = v_org_g), (select count(*) from app.team where id = v_team_c));
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'a recent sign-in, a paid plan, another group of the organisation or the demo keeps a group; a former member''s sign-in does not',
      'expected', '1,1,0,1,1,1', 'actual', v_txt, 'pass', v_txt = '1,1,0,1,1,1');

    -- 9 ------------------------------------------------------------ the Group tab
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    v_res := app.get_group_settings(v_team);
    v_txt := concat_ws(',', v_res ->> 'name', v_res ->> 'organisation', v_res ->> 'threshold', v_res ->> 'threshold_max',
                       v_res ->> 'members', v_res ->> 'members_max', v_res ->> 'can_edit');
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.get_group_settings(v_team) ->> 'can_edit');
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := concat_ws(',', v_txt, coalesce(app.get_group_settings(v_team)::text, 'nothing'));
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'the Group tab: a current member reads it, only the leader may edit, an outsider reads nothing',
      'expected', 'Retention A group,Retention A organisation,4,8,4,15,false,true,nothing', 'actual', v_txt,
      'pass', v_txt = 'Retention A group,Retention A organisation,4,8,4,15,false,true,nothing');

    -- 10 ----------------------------------------------------------- renaming
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    v_txt := app.rename_group(v_team, 'A member''s name') ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.rename_group(v_team, '   ') ->> 'reason', app.rename_group(v_team, repeat('x', 121)) ->> 'reason',
                       app.rename_group(v_team, '  The new name  ') ->> 'ok');
    reset role;
    v_txt := concat_ws(',', v_txt, (select name from app.team where id = v_team));
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'only the leader renames the group, to 1 to 120 characters',
      'expected', 'not_leader,invalid,invalid,true,The new name', 'actual', v_txt, 'pass', v_txt = 'not_leader,invalid,invalid,true,The new name');

    -- 11 ----------------------------------------------------------- raising the threshold
    v_round := gen_random_uuid();
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org, v_team, 'diagnostic', v_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round);
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    v_txt := app.raise_threshold(v_team, 6) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res := app.raise_threshold(v_team, 4);
    v_txt := concat_ws(',', v_txt, v_res ->> 'reason', v_res ->> 'threshold', app.raise_threshold(v_team, 9) ->> 'reason',
                       app.raise_threshold(v_team, null) ->> 'reason', app.raise_threshold(v_team, 6) ->> 'threshold');
    v_res := app.raise_threshold(v_team, 5);
    v_txt := concat_ws(',', v_txt, v_res ->> 'reason', v_res ->> 'threshold');
    reset role;
    select concat_ws(',', v_txt, app.k_threshold(v_org), (select k from app.assessment_round where id = v_round),
                     (select string_agg(a.detail::text || ':' || (a.actor = v_lead)::text, ' ') from app.audit_event a where a.org_id = v_org and a.kind = 'threshold_raised'))
      into v_txt;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'only the leader raises the threshold, up to 8, never lower; audited; an open round keeps its k',
      'expected', 'not_leader,not_higher,4,invalid,invalid,6,not_higher,6,6,4,{"to": 6, "from": 4}:true', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,not_higher,4,invalid,invalid,6,not_higher,6,6,4,{"to": 6, "from": 4}:true');

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 12 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'retention-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name like 'Retention % organisation';
  v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_retention
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_retention order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_retention;
  if v_failed is not null then
    raise exception 'retention invariants failed: %', v_failed;
  end if;
  if v_count <> 12 then
    raise exception 'retention invariants: expected 12 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_retention;
