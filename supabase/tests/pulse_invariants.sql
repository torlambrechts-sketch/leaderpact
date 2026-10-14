-- pulse_invariants.sql — pulses: built in order, open on the rhythm, close after the window, change only from 0.6
-- (0020; handoff 6.16 and 7; milestone 15: "A pulse assembles in the right order, closes after 7 days and shows
-- change only from 0.6").
--
--      1  the client functions are granted as reviewed; the job's to service_role alone; the builders to nobody
--      2  no role holds a privilege on the pulse tables; agreement answers hold no person and no time
--      3  the firewall passes, with agreement_response and agreement_score among the answer tables
--      4  on the Free plan nobody starts pulses; a member may not; an outsider reads nothing
--      5  a group with fewer members than its threshold cannot start them, and nothing is written
--      6  a rhythm or a window outside its range, or a window as long as the rhythm, is refused
--      7  built in order: the focus scales' core items as chosen, then agreements, at most 10; the wording
--      8  started: the first pulse asks what the page previewed, for 7 days, k frozen, every member asked
--      9  one round at a time: a due pulse is skipped while one answers, and its date moves on
--     10  the form: the pulse's 10 questions, an agreement's in its words, in one mixed order
--     11  an answer is checked against the pulse's own questions and taken once; agreements stored apart
--     12  after 7 days it closes: focus scales, items and agreements computed once, then reshuffled
--     13  a member reads the result: labels and levels, no count per item, no change in a first pulse
--     14  the next pulse opens on its date and rotates the agreements that did not fit
--     15  at 100% it closes at once; change shows from 0.6 and not at 0.5
--     16  fewer answers than the threshold: missed, no result, the answers gone, audited without a result
--     17  the leader changes the rhythm, stops it and starts it again; the wording follows the rhythm
--     18  without focus areas or a charter: 2 rotating items from 2 scales, then 2 other scales
--     19  a pulse's questions never change, and none is added once it opens
--     20  where pg_cron exists, the job runs every five minutes, once
--     21  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pulse_invariants.sql

create unlogged table if not exists public._inv_pulse(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_pulse;

-- A pulse's answers for respondent p_j, built from its questions (as the owner, so no client grant is needed).
-- 'flat': every answer 3. 'change': clear purpose 4; trust 3,3,3 for the first two respondents, 4,4,3 then
-- 4,4,4 after (52 over 15 answers, 3.5); "Agreement 1" 3 for the first two, 4 after (3.6); everything else 3.
create function pg_temp.pulse_payload(p_round uuid, p_j int, p_mode text) returns jsonb
  language sql stable
as $$
  select jsonb_agg(jsonb_build_object('item', coalesce(q.item_id, q.agreement_id), 'value',
    case when p_mode = 'flat' then 3
         when f.key = 'clear_purpose' then 4
         when f.key = 'trust' then case when p_j <= 2 then 3 when p_j >= 5 then 4 when q.pos = 3 then 3 else 4 end
         when q.text ->> 'en' like '%«Agreement 1»' then case when p_j <= 2 then 3 else 4 end
         else 3 end) order by q.ordinal)
  from (select x.*, row_number() over (partition by x.factor_id order by x.ordinal) as pos
        from app.pulse_question x where x.round_id = p_round) q
  left join app.factor f on f.id = q.factor_id
$$;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_m uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_out uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_small uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_plain uuid := gen_random_uuid();
  v_diag uuid := gen_random_uuid();
  v_ver uuid;
  v_who uuid[];
  v_p1 uuid;
  v_p2 uuid;
  v_p3 uuid;
  v_q1 uuid;
  v_q2 uuid;
  v_res jsonb;
  v_res2 jsonb;
  v_pay jsonb;
  v_sets uuid[];
  v_txt text;
  v_txt2 text;
  v_txt3 text;
  v_n int;
  v_k int;
  v_ok boolean;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';
  v_who := array[v_lead] || v_m;

  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.start_pulses(uuid, int, int)', 'execute')
          and has_function_privilege('authenticated', 'app.set_pulse_rhythm(uuid, int, int)', 'execute')
          and has_function_privilege('authenticated', 'app.stop_pulses(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.get_pulses(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.get_pulse_result(uuid)', 'execute')
          and has_function_privilege('service_role', 'app.open_due_pulses()', 'execute')
          and not exists (
            select 1 from unnest(array['anon', 'authenticated', 'service_role']) r,
              unnest(array['app.pulse_questions(uuid)', 'app.open_pulse(uuid)', 'app.checked_pulse_answers(jsonb, uuid)',
                           'app.setting_allows(text, int)', 'app.pulse_template_version()']) f
            where has_function_privilege(r, f, 'execute'))
          and not exists (
            select 1 from unnest(array['app.start_pulses(uuid, int, int)', 'app.set_pulse_rhythm(uuid, int, int)', 'app.stop_pulses(uuid)',
                                       'app.get_pulses(uuid)', 'app.get_pulse_result(uuid)', 'app.open_due_pulses()']) f
            where has_function_privilege('anon', f, 'execute'))
          and not has_function_privilege('authenticated', 'app.open_due_pulses()', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the client functions are granted as reviewed; the job''s to service_role alone; the builders to nobody',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- no privilege; no person, no time
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.pulse_template'), ('app.pulse_schedule'), ('app.pulse_question'), ('app.agreement_response'),
                     ('app.agreement_score')) as t (rel)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.rel, p.priv);
  select string_agg(a.attname, ',' order by a.attnum) into v_txt
  from pg_attribute a where a.attrelid = 'app.agreement_response'::regclass and a.attnum > 0 and not a.attisdropped;
  select string_agg(a.attname, ',' order by a.attnum) into v_txt2
  from pg_attribute a where a.attrelid = 'app.pulse_question'::regclass and a.attnum > 0 and not a.attisdropped;
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no role holds a privilege on the pulse tables; agreement answers hold no person and no time',
    'expected', '0 privileges; response_set_id,agreement_id,value; round_id,org_id,ordinal,source,item_id,agreement_id,factor_id,text',
    'actual', v_n || ' privileges; ' || v_txt || '; ' || v_txt2,
    'pass', v_n = 0 and v_txt = 'response_set_id,agreement_id,value'
            and v_txt2 = 'round_id,org_id,ordinal,source,item_id,agreement_id,factor_id,text');

  -- 3 -------------------------------------------------------------- the firewall
  select string_agg(f.rule || '=' || f.pass, ' ' order by f.seq) filter (where not f.pass), bool_and(f.pass),
         max((f.evidence ->> 'tables')::int) into v_txt, v_ok, v_n
  from app.anonymity_firewall() f;
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'the firewall passes, with agreement_response and agreement_score among the answer tables',
    'expected', 'all pass, 11 answer tables', 'actual', coalesce(v_txt, 'all pass') || ', ' || v_n || ' answer tables',
    'pass', v_ok and v_n = 11);

  begin
    insert into auth.users (id, email) values
      (v_lead, 'pulse-test-lead@example.invalid'), (v_m[1], 'pulse-test-m1@example.invalid'), (v_m[2], 'pulse-test-m2@example.invalid'),
      (v_m[3], 'pulse-test-m3@example.invalid'), (v_m[4], 'pulse-test-m4@example.invalid'), (v_out, 'pulse-test-out@example.invalid');
    insert into app.person (id, display_name) values
      (v_lead, 'Pulse lead'), (v_m[1], 'Pulse one'), (v_m[2], 'Pulse two'), (v_m[3], 'Pulse three'), (v_m[4], 'Pulse four'),
      (v_out, 'Pulse outsider');
    insert into app.organisation (id, name) values (v_org, 'Pulse test organisation');
    insert into app.team (id, org_id, name) values
      (v_team, v_org, 'Pulse test group'), (v_small, v_org, 'Pulse small group'), (v_free, v_org, 'Pulse free group'),
      (v_plain, v_org, 'Pulse plain group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from)
    select v_org, t.id, p.id, case when p.id = v_lead then 'leader' else 'member' end, now() - interval '30 days'
    from (values (v_team, 5), (v_small, 3), (v_free, 4), (v_plain, 4)) as t (id, size)
    cross join lateral unnest(v_who[1:t.size]) as p (id);
    -- three groups on their trial: the Team plan, writable (0013); the fourth stays on Free
    insert into app.trial (team_id, org_id, started_at, ends_at)
    select t, v_org, now() - interval '1 day', now() + interval '13 days' from unnest(array[v_team, v_small, v_plain]) t;
    -- two focus areas, clear purpose chosen first, then trust; the round they came from stays scheduled here
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_diag, v_org, v_team, 'diagnostic', v_ver, 14, now() + interval '300 days');
    insert into app.focus_area (org_id, team_id, factor_id, round_id, created_at)
    select v_org, v_team, f.id, v_diag, now() - make_interval(days => d) from (values ('clear_purpose', 2), ('trust', 1)) as x (key, d)
    join app.factor f on f.key = x.key;

    -- 4 ------------------------------------------------------------ Free, a member, an outsider
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', app.start_pulses(v_free, 4, 7) ->> 'reason', app.get_pulses(v_free) ->> 'can_manage');
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    v_txt := concat_ws(',', v_txt, app.start_pulses(v_team, 4, 7) ->> 'reason', app.stop_pulses(v_team) ->> 'reason',
                       app.set_pulse_rhythm(v_team, 4, 7) ->> 'reason', app.get_pulses(v_team) ->> 'can_manage');
    perform set_config('request.jwt.claims', format(claims, v_out), true);
    v_txt := concat_ws(',', v_txt, coalesce(app.get_pulses(v_team)::text, 'nothing'), app.start_pulses(v_team, 4, 7) ->> 'reason');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'on the Free plan nobody starts pulses; a member may not; an outsider reads nothing',
      'expected', 'unavailable,false,not_leader,not_leader,not_leader,false,nothing,not_leader', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'unavailable,false,not_leader,not_leader,not_leader,false,nothing,not_leader');

    -- 5 ------------------------------------------------------------ too few members
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res := app.start_pulses(v_small, 4, 7);
    reset role;
    v_txt := concat_ws(',', v_res ->> 'reason', v_res ->> 'members', v_res ->> 'k',
                       (select count(*) from app.assessment_round where team_id = v_small),
                       (select count(*) from app.pulse_schedule where team_id = v_small));
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'fewer members than the threshold: no pulses start, nothing is written',
      'expected', 'too_few,3,4,0,0', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'too_few,3,4,0,0');

    -- 6 ------------------------------------------------------------ ranges
    set local role authenticated;
    select string_agg(coalesce(app.start_pulses(v_team, x.w, x.d) ->> 'reason', 'null'), ',' order by x.n) into v_txt
    from (values (1, 1, 7), (2, 9, 7), (3, 4, 2), (4, 4, 15), (5, 2, 14), (6, null, 7)) as x (n, w, d);
    reset role;
    v_txt := v_txt || ',' || (select count(*) from app.pulse_schedule where team_id = v_team);
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'a rhythm or a window outside its range, or a window as long as the rhythm, is refused',
      'expected', 'invalid,invalid,invalid,invalid,invalid,invalid,0', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'invalid,invalid,invalid,invalid,invalid,invalid,0');

    -- 7 ------------------------------------------------------------ the milestone: built in order
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    perform app.save_charter_draft(v_team, 'We set the direction.', '[{"title": "Set strategy", "right": "decide"}]',
                                   '["Agreement 1", "Agreement 2", "Agreement 3", "Agreement 4", "Agreement 5"]');
    perform app.agree_charter(v_team);
    v_res := app.get_pulses(v_team);
    reset role;
    -- what the order should be: clear purpose's core items, then trust's, each in the version's order
    select string_agg(i.text ->> 'en', ' | ' order by x.d, vi.ordinal) into v_txt2
    from (values ('clear_purpose', 1), ('trust', 2)) as x (key, d)
    join app.factor f on f.key = x.key
    join app.item i on i.factor_id = f.id and i.use = 'core'
    join app.instrument_version_item vi on vi.item_id = i.id and vi.instrument_version_id = v_ver;
    select string_agg(e ->> 'source', ',' order by o), string_agg(e ->> 'text', ' | ' order by o) filter (where e ->> 'source' = 'focus')
      into v_txt, v_txt3
    from jsonb_array_elements(v_res -> 'next') with ordinality as x (e, o);
    v_ok := v_txt3 = v_txt2
            and v_res -> 'next' -> 6 ->> 'text' = 'In the last 4 weeks we kept this agreement: «Agreement 1»'
            and v_res -> 'next' -> 9 ->> 'text' = 'In the last 4 weeks we kept this agreement: «Agreement 4»'
            and v_res -> 'next' -> 0 ->> 'scale' = 'Clear purpose' and v_res -> 'next' -> 3 ->> 'scale' = 'Trust';
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'built in order: the focus scales'' core items as chosen, then agreements, at most 10; the wording',
      'expected', 'focus x6,agreement x4; as chosen; worded', 'actual', coalesce(v_txt, 'null') || case when v_ok then '; as chosen; worded' else '; not as built' end,
      'pass', v_txt = 'focus,focus,focus,focus,focus,focus,agreement,agreement,agreement,agreement' and v_ok
              and (v_res ->> 'max_questions')::int = 10 and (v_res ->> 'agreements')::int = 5 and (v_res ->> 'focus')::int = 2
              and v_res ->> 'running' = 'false');

    -- 8 ------------------------------------------------------------ started
    set local role authenticated;
    v_res2 := app.start_pulses(v_team, 4, 7);
    reset role;
    v_p1 := (v_res2 ->> 'round')::uuid;
    select string_agg(r.day::text, ' ' order by r.day) into v_txt2 from app.round_reminder r where r.round_id = v_p1;
    select concat_ws(',', v_res2 ->> 'ok', r.kind, r.phase, r.k, r.invited, extract(day from r.closes_at - r.opens_at)::int,
                     extract(day from s.next_at - r.opens_at)::int, v_txt2,
                     ((select jsonb_agg(jsonb_build_object('source', q.source, 'text', coalesce(q.text, i.text) ->> 'en') order by q.ordinal)
                       from app.pulse_question q left join app.item i on i.id = q.item_id where q.round_id = r.id)
                      = (select jsonb_agg(jsonb_build_object('source', e ->> 'source', 'text', e ->> 'text') order by o)
                         from jsonb_array_elements(v_res -> 'next') with ordinality as x (e, o)))::text)
      into v_txt from app.assessment_round r join app.pulse_schedule s on s.team_id = r.team_id where r.id = v_p1;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'started: the first pulse asks what the page previewed, for 7 days, k frozen, every member asked',
      'expected', 'true,pulse,answering,4,5,7,28,3,true', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,pulse,answering,4,5,7,28,3,true');
    -- pulse 1 is dated two months back, so the rounds below follow it in time
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set opens_at = now() - interval '60 days' where id = v_p1;
    alter table app.assessment_round enable trigger assessment_round_fixed;

    -- 9 ------------------------------------------------------------ one at a time
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', app.start_pulses(v_team, 4, 7) ->> 'reason', app.open_diagnostic(v_team) ->> 'reason');
    reset role;
    update app.pulse_schedule set next_at = now() - interval '1 minute' where team_id = v_team;
    v_n := app.open_due_pulses();
    v_txt := concat_ws(',', v_txt, v_n, (select count(*) from app.assessment_round where team_id = v_team and kind = 'pulse'),
                       (select extract(day from s.next_at - now())::int from app.pulse_schedule s where s.team_id = v_team));
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'one round at a time: a due pulse is skipped while one answers, and its date moves on',
      'expected', 'already,open_round,0,1,27', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'already,open_round,0,1,27');

    -- 10 ----------------------------------------------------------- the form
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    v_res := app.get_round_form(v_p1);
    perform set_config('request.jwt.claims', format(claims, v_m[2]), true);
    v_res2 := app.get_round_form(v_p1);
    reset role;
    select string_agg(e ->> 'kind', ',' order by e ->> 'kind') into v_txt2 from jsonb_array_elements(v_res -> 'items') e;
    v_ok := v_res -> 'items' = v_res2 -> 'items'
            -- the same questions as built, in the round's own mixed order
            and (select array_agg((e ->> 'id')::uuid order by e ->> 'id') from jsonb_array_elements(v_res -> 'items') e)
                = (select array_agg(coalesce(q.item_id, q.agreement_id) order by coalesce(q.item_id, q.agreement_id)::text)
                   from app.pulse_question q where q.round_id = v_p1)
            and (select array_agg((e ->> 'id')::uuid order by o) from jsonb_array_elements(v_res -> 'items') with ordinality as x (e, o))
                = (select array_agg(coalesce(q.item_id, q.agreement_id) order by md5(v_p1::text || coalesce(q.item_id, q.agreement_id)::text))
                   from app.pulse_question q where q.round_id = v_p1)
            and exists (select 1 from jsonb_array_elements(v_res -> 'items') e
                        where e ->> 'kind' = 'agreement' and e ->> 'text' = 'In the last 4 weeks we kept this agreement: «Agreement 2»');
    v_txt := concat_ws(',', v_res ->> 'kind', v_res ->> 'number', v_res ->> 'state', jsonb_array_length(v_res -> 'items'));
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'the form: the pulse''s 10 questions, an agreement''s in its words, in one mixed order',
      'expected', 'pulse,1,open,10; 4 agreement, 6 statement; as built',
      'actual', coalesce(v_txt, 'null') || '; ' || coalesce(v_txt2, 'none') || case when v_ok then '; as built' else '; not as built' end,
      'pass', v_txt = 'pulse,1,open,10' and v_txt2 = 'agreement,agreement,agreement,agreement,statement,statement,statement,statement,statement,statement'
              and v_ok);

    -- 11 ----------------------------------------------------------- checked, once, agreements apart
    v_pay := pg_temp.pulse_payload(v_p1, 2, 'flat');
    -- a diagnostic item the pulse did not ask
    select vi.item_id into v_q1 from app.instrument_version_item vi where vi.instrument_version_id = v_ver
      and not exists (select 1 from app.pulse_question q where q.round_id = v_p1 and q.item_id = vi.item_id) limit 1;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    -- a question missing; a diagnostic item the pulse did not ask in place of one; an agreement of no question
    v_txt := concat_ws(',',
      app.submit_response(v_p1, v_pay - 0) ->> 'reason',
      app.submit_response(v_p1, jsonb_set(v_pay, '{0,item}', to_jsonb(v_q1))) ->> 'reason',
      app.submit_response(v_p1, jsonb_set(v_pay, '{0,item}', to_jsonb(gen_random_uuid()))) ->> 'reason',
      app.submit_response(v_p1, v_pay) ->> 'ok',
      app.submit_response(v_p1, v_pay) ->> 'reason');
    v_res := app.get_rounds(v_team);
    reset role;
    select r ->> 'answered' into v_txt2 from jsonb_array_elements(v_res -> 'rounds') r where r ->> 'id' = v_p1::text;
    v_txt := concat_ws(',', v_txt, v_txt2,
                       (select count(*) from app.response r join app.response_set rs on rs.id = r.response_set_id where rs.round_id = v_p1),
                       (select count(*) from app.agreement_response a join app.response_set rs on rs.id = a.response_set_id where rs.round_id = v_p1));
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'an answer is checked against the pulse''s own questions and taken once; agreements stored apart',
      'expected', 'invalid,invalid,invalid,true,already_answered,1,6,4', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'invalid,invalid,invalid,true,already_answered,1,6,4');

    -- 12 ----------------------------------------------------------- the milestone: closes after 7 days
    for v_n in 1..3 loop
      v_pay := pg_temp.pulse_payload(v_p1, v_n, 'flat');
      set local role authenticated;
      perform set_config('request.jwt.claims', format(claims, (array[v_lead, v_m[2], v_m[3]])[v_n]), true);
      perform app.submit_response(v_p1, v_pay);
      reset role;
    end loop;
    v_txt := (select phase from app.assessment_round where id = v_p1);
    select array_agg(id) into v_sets from app.response_set where round_id = v_p1;
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_p1;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    v_n := app.close_due_rounds();
    select concat_ws(',', v_txt, v_n, r.phase,
                     (select string_agg(f.key, '+' order by f.key) from app.factor_score s join app.factor f on f.id = s.factor_id where s.round_id = r.id),
                     (select count(*) from app.item_score where round_id = r.id),
                     (select count(*) from app.agreement_score where round_id = r.id),
                     (select count(*) from app.response_set where round_id = r.id and id = any (v_sets)),
                     (select count(*) from app.agreement_response a join app.response_set rs on rs.id = a.response_set_id where rs.round_id = r.id))
      into v_txt from app.assessment_round r where r.id = v_p1;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'after 7 days it closes: focus scales, items and agreements computed once, then reshuffled',
      'expected', 'answering,1,released,clear_purpose+trust,6,4,0,16', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'answering,1,released,clear_purpose+trust,6,4,0,16');

    -- 13 ----------------------------------------------------------- the result, for a member who did not answer
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[4]), true);
    v_res := app.get_pulse_result(v_p1);
    perform set_config('request.jwt.claims', format(claims, v_out), true);
    v_txt2 := coalesce(app.get_pulse_result(v_p1)::text, 'nothing');
    reset role;
    select string_agg(k, ',' order by k) into v_txt from jsonb_object_keys(v_res -> 'scales' -> 0) k;
    v_ok := (select bool_and(e ->> 'before' is null and e ->> 'level' = '3.0') from jsonb_array_elements(v_res -> 'scales') e)
            and (select bool_and(e ->> 'before' is null and e ->> 'level' = '3.0') from jsonb_array_elements(v_res -> 'agreements') e)
            and (select string_agg(k, ',' order by k) from jsonb_object_keys(v_res -> 'items' -> 0) k) = 'level,scale,source,text'
            and (select string_agg(k, ',' order by k) from jsonb_object_keys(v_res -> 'agreements' -> 0) k) = 'before,level,text'
            and v_res -> 'scales' -> 0 ->> 'key' = 'clear_purpose' and v_res -> 'scales' -> 1 ->> 'key' = 'trust';
    v_txt := concat_ws(',', v_txt, jsonb_array_length(v_res -> 'scales'), jsonb_array_length(v_res -> 'agreements'),
                       jsonb_array_length(v_res -> 'items'), v_res ->> 'number', v_res ->> 'answered', v_res ->> 'invited', v_res ->> 'margin',
                       v_ok::text, v_txt2);
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'a member reads the result: labels and levels, no count per item, no change in a first pulse',
      'expected', 'agreement,before,evidence,key,layer,level,name,reading_type,standing,2,4,6,1,4,5,0.6,true,nothing',
      'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'agreement,before,evidence,key,layer,level,name,reading_type,standing,2,4,6,1,4,5,0.6,true,nothing');

    -- 14 ----------------------------------------------------------- the next one, on its date, rotating
    update app.pulse_schedule set next_at = now() - interval '1 minute' where team_id = v_team;
    v_n := app.open_due_pulses();
    select r.id into v_p2 from app.assessment_round r where r.team_id = v_team and r.kind = 'pulse' and r.phase = 'answering';
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set opens_at = now() - interval '30 days' where id = v_p2;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    select string_agg(substring(q.text ->> 'en' from '«(.*)»'), ',' order by q.ordinal) filter (where q.source = 'agreement'),
           count(*) filter (where q.source = 'focus')
      into v_txt, v_k from app.pulse_question q where q.round_id = v_p2;
    v_txt := concat_ws(',', v_n, v_k, v_txt);
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'the next pulse opens on its date and rotates the agreements that did not fit',
      'expected', '1,6,Agreement 5,Agreement 1,Agreement 2,Agreement 3', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '1,6,Agreement 5,Agreement 1,Agreement 2,Agreement 3');

    -- 15 ----------------------------------------------------------- the milestone: at 100%, change from 0.6
    for v_n in 1..5 loop
      v_pay := pg_temp.pulse_payload(v_p2, v_n, 'change');
      set local role authenticated;
      perform set_config('request.jwt.claims', format(claims, v_who[v_n]), true);
      perform app.submit_response(v_p2, v_pay);
      reset role;
    end loop;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[3]), true);
    v_res := app.get_pulse_result(v_p2);
    reset role;
    select string_agg(e ->> 'key' || ' ' || (e ->> 'before') || '>' || (e ->> 'level') || ' '
                      || app.change_shows((e ->> 'before')::numeric, (e ->> 'level')::numeric, 1), '; ' order by o)
      into v_txt from jsonb_array_elements(v_res -> 'scales') with ordinality as x (e, o);
    select string_agg(substring(e ->> 'text' from '«(.*)»') || ' ' || coalesce(e ->> 'before', 'none') || '>' || (e ->> 'level') || ' '
                      || coalesce(app.change_shows((e ->> 'before')::numeric, (e ->> 'level')::numeric, 1)::text, 'first'), '; ' order by o)
      into v_txt2 from jsonb_array_elements(v_res -> 'agreements') with ordinality as x (e, o);
    v_txt := concat_ws(' | ', (select phase from app.assessment_round where id = v_p2), v_res ->> 'number', v_txt, v_txt2);
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'at 100% it closes at once; change shows from 0.6 and not at 0.5',
      'expected', 'released | 2 | clear_purpose 3.0>4.0 true; trust 3.0>3.5 false | Agreement 5 none>3.0 first; Agreement 1 3.0>3.6 true; Agreement 2 3.0>3.0 false; Agreement 3 3.0>3.0 false',
      'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'released | 2 | clear_purpose 3.0>4.0 true; trust 3.0>3.5 false | Agreement 5 none>3.0 first; Agreement 1 3.0>3.6 true; Agreement 2 3.0>3.0 false; Agreement 3 3.0>3.0 false');

    -- 16 ----------------------------------------------------------- missed
    update app.pulse_schedule set next_at = now() - interval '1 minute' where team_id = v_team;
    perform app.open_due_pulses();
    select r.id into v_p3 from app.assessment_round r where r.team_id = v_team and r.kind = 'pulse' and r.phase = 'answering';
    for v_n in 1..3 loop
      v_pay := pg_temp.pulse_payload(v_p3, v_n, 'flat');
      set local role authenticated;
      perform set_config('request.jwt.claims', format(claims, v_who[v_n]), true);
      perform app.submit_response(v_p3, v_pay);
      reset role;
    end loop;
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_p3;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    v_txt := app.close_round(v_p3);
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m[1]), true);
    v_txt2 := coalesce(app.get_pulse_result(v_p3)::text, 'nothing');
    reset role;
    v_txt := concat_ws(',', v_txt, (select extended::text from app.assessment_round where id = v_p3),
                       (select count(*) from app.response_set where round_id = v_p3),
                       (select count(*) from app.agreement_score where round_id = v_p3) + (select count(*) from app.item_score where round_id = v_p3)
                         + (select count(*) from app.factor_score where round_id = v_p3),
                       (select count(*) from app.audit_event a where a.org_id = v_org and a.kind = 'round_closed'
                          and a.detail ->> 'round' = v_p3::text and a.detail ->> 'result' = 'false'),
                       v_txt2);
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'fewer answers than the threshold: missed, no result, the answers gone, audited without a result',
      'expected', 'closed,false,0,0,1,nothing', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'closed,false,0,0,1,nothing');

    -- 17 ----------------------------------------------------------- the rhythm: change, stop, start again
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := app.set_pulse_rhythm(v_team, 2, 7) ->> 'ok';
    reset role;
    v_txt := concat_ws(',', v_txt, (select extract(day from s.next_at - (select max(r.opens_at) from app.assessment_round r
                                                                         where r.team_id = v_team and r.kind = 'pulse'))::int
                                    from app.pulse_schedule s where s.team_id = v_team));
    set local role authenticated;
    v_txt := concat_ws(',', v_txt, app.stop_pulses(v_team) ->> 'ok', app.stop_pulses(v_team) ->> 'reason',
                       app.set_pulse_rhythm(v_team, 6, 10) ->> 'ok');
    reset role;
    v_n := app.open_due_pulses();
    v_txt := concat_ws(',', v_txt, v_n, (select coalesce(s.next_at::text, 'stopped') || '/' || s.weeks || '/' || s.window_days
                                         from app.pulse_schedule s where s.team_id = v_team));
    set local role authenticated;
    v_res := app.start_pulses(v_team, 6, 10);
    reset role;
    v_txt := concat_ws(',', v_txt, v_res ->> 'ok',
                       (select extract(day from r.closes_at - r.opens_at)::int from app.assessment_round r where r.id = (v_res ->> 'round')::uuid),
                       (select count(*) from app.pulse_question q where q.round_id = (v_res ->> 'round')::uuid
                          and q.text ->> 'en' like 'In the last 6 weeks we kept this agreement: «%»'));
    v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'the leader changes the rhythm, stops it and starts it again; the wording follows the rhythm',
      'expected', 'true,14,true,not_running,true,0,stopped/6/10,true,10,4', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,14,true,not_running,true,0,stopped/6/10,true,10,4');

    -- 18 ----------------------------------------------------------- rotating items alone
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res := app.start_pulses(v_plain, 4, 7);
    reset role;
    v_q1 := (v_res ->> 'round')::uuid;
    select string_agg(q.source, ',' order by q.ordinal), count(distinct q.factor_id),
           bool_and(f.layer <> 'outcomes' and i.use = 'core' and exists (
             select 1 from app.instrument_version_item vi where vi.instrument_version_id = v_ver and vi.item_id = q.item_id)),
           string_agg(q.factor_id::text, ',' order by q.factor_id)
      into v_txt, v_n, v_ok, v_txt2
    from app.pulse_question q join app.factor f on f.id = q.factor_id join app.item i on i.id = q.item_id where q.round_id = v_q1;
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set opens_at = now() - interval '30 days', closes_at = now() - interval '1 second' where id = v_q1;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    perform app.close_round(v_q1);
    update app.pulse_schedule set next_at = now() - interval '1 minute' where team_id = v_plain;
    perform app.open_due_pulses();
    select r.id into v_q2 from app.assessment_round r where r.team_id = v_plain and r.phase = 'answering';
    v_txt := concat_ws(',', v_txt, v_n, v_ok::text,
                       (select count(distinct q.factor_id) from app.pulse_question q where q.round_id = v_q2
                          and q.source = 'rotating' and q.factor_id::text <> all (string_to_array(v_txt2, ','))));
    v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'without focus areas or a charter: 2 rotating items from 2 scales, then 2 other scales',
      'expected', 'rotating,rotating,2,true,2', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'rotating,rotating,2,true,2');

    -- 19 ----------------------------------------------------------- the questions are fixed
    begin
      update app.pulse_question set ordinal = ordinal where round_id = v_q2;
      v_txt := 'changed';
    exception when check_violation then
      v_txt := 'refused';
    end;
    begin
      insert into app.pulse_question (round_id, org_id, ordinal, source, item_id, factor_id)
      select v_q2, v_org, 30, 'rotating', i.id, i.factor_id from app.item i
      where i.use = 'core' and not exists (select 1 from app.pulse_question q where q.round_id = v_q2 and q.item_id = i.id) limit 1;
      v_txt := v_txt || ',added';
    exception when check_violation then
      v_txt := v_txt || ',refused';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'a pulse''s questions never change, and none is added once it opens',
      'expected', 'refused,refused', 'actual', v_txt, 'pass', v_txt = 'refused,refused');

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 20 ------------------------------------------------------------ the schedule
  if to_regclass('cron.job') is null then
    v_rows := v_rows || jsonb_build_object('seq', 20, 'name', 'where pg_cron exists, the job runs every five minutes, once',
      'expected', 'scheduled, or no pg_cron here', 'actual', 'no pg_cron here', 'pass', true);
  else
    execute $q$select count(*) from cron.job where jobname = 'leaderpact-open-due-pulses'
               and schedule = '*/5 * * * *' and command = 'select app.open_due_pulses()'$q$ into v_n;
    v_rows := v_rows || jsonb_build_object('seq', 20, 'name', 'where pg_cron exists, the job runs every five minutes, once',
      'expected', '1 job', 'actual', v_n || ' job', 'pass', v_n = 1);
  end if;

  -- 21 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'pulse-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Pulse test organisation';
  v_rows := v_rows || jsonb_build_object('seq', 21, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_pulse
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_pulse order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_pulse;
  if v_failed is not null then
    raise exception 'pulse invariants failed: %', v_failed;
  end if;
  if v_count <> 21 then
    raise exception 'pulse invariants: expected 21 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_pulse;
