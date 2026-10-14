-- privacy_invariants.sql — "Download my data", deleting an account, and the audit trail (0023; handoff 6.18 and 8;
-- milestone 16: "An export arrives. A delete removes personal data. Limits return 429"; owner D6 and D7).
--
--      1  the person's own functions are granted as reviewed; the builders and the jobs are not clients'
--      2  every table declares whether the export includes it, and no row names a table that is not there
--      3  the export holds the person's own data and nobody else's: no other member's name or address
--      4  the export holds no answer, and says nothing of anyone's answers
--      5  5 exports a day; the sixth answers too_many with the seconds to wait, and nothing is written
--      6  the mailed link gives the file once; then used; a lapsed link expires and empties the file
--      7  the job empties exports never downloaded once their link has lapsed
--      8  the only leader of a group with other members cannot delete their account, and nothing changes
--      9  a member deletes their account: their sign-in, person and every row that named them go
--     10  what they wrote for the group stays without their name; the group's answers stay
--     11  no column that points at a person still holds their id
--     12  a person alone in a group: the group and its organisation go with them
--     13  nobody changes an audited event; a recent one is not deleted; one 24 months old is pruned
--     14  saving a Leader Profile records consent given, with the person and the test and no score; a retake again
--     15  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/privacy_invariants.sql

create unlogged table if not exists public._inv_privacy(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_privacy;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_m1 uuid := gen_random_uuid();
  v_m2 uuid := gen_random_uuid();
  v_m3 uuid := gen_random_uuid();
  v_solo uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_solo_org uuid := gen_random_uuid();
  v_solo_team uuid := gen_random_uuid();
  v_ver uuid;
  v_round uuid := gen_random_uuid();
  v_meeting uuid;
  v_res jsonb;
  v_content jsonb;
  v_claim jsonb;
  v_token text;
  v_txt text;
  v_n int;
  v_m int;
  v_ok boolean;
  v_audit bigint;
  r record;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';

  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.request_export()', 'execute')
          and has_function_privilege('authenticated', 'app.delete_account()', 'execute')
          and has_function_privilege('anon', 'app.download_export(text)', 'execute')
          and has_function_privilege('authenticated', 'app.download_export(text)', 'execute')
          and has_function_privilege('service_role', 'app.expire_exports()', 'execute')
          and has_function_privilege('service_role', 'app.prune_audit()', 'execute')
          and not has_function_privilege('anon', 'app.request_export()', 'execute')
          and not has_function_privilege('anon', 'app.delete_account()', 'execute')
          and not exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) g
                          where has_function_privilege(g, 'app.export_person(uuid)', 'execute'))
          and not exists (select 1 from unnest(array['anon', 'authenticated']) g, unnest(array['app.expire_exports()', 'app.prune_audit()']) f
                          where has_function_privilege(g, f, 'execute'));
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the person''s own functions are granted as reviewed; the builders and the jobs are not clients''',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- coverage, from the catalogue
  select coalesce(string_agg(c.relname, ',' order by c.relname), 'none') into v_txt
  from pg_class c where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p')
    and not exists (select 1 from app.export_coverage e where e.table_name = c.relname);
  select coalesce(string_agg(e.table_name, ',' order by e.table_name), 'none') into v_token
  from app.export_coverage e
  where not exists (select 1 from pg_class c where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p') and c.relname = e.table_name);
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'every table declares whether the export includes it, and no row names a table that is not there',
    'expected', 'missing none; extra none', 'actual', 'missing ' || v_txt || '; extra ' || v_token,
    'pass', v_txt = 'none' and v_token = 'none');

  begin
    insert into auth.users (id, email) values
      (v_lead, 'privacy-test-lead@example.invalid'), (v_m1, 'privacy-test-m1@example.invalid'), (v_m2, 'privacy-test-m2@example.invalid'),
      (v_m3, 'privacy-test-m3@example.invalid'), (v_solo, 'privacy-test-solo@example.invalid');
    insert into app.person (id, display_name) values
      (v_lead, 'Privacy lead'), (v_m1, 'Privacy one'), (v_m2, 'Privacy two'), (v_m3, 'Privacy three'), (v_solo, 'Privacy solo');
    insert into app.organisation (id, name) values (v_org, 'Privacy test organisation'), (v_solo_org, 'Privacy solo organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Privacy test group'), (v_solo_team, v_solo_org, 'Privacy solo group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from) values
      (v_org, v_team, v_lead, 'leader', now() - interval '30 days'), (v_org, v_team, v_m1, 'member', now() - interval '30 days'),
      (v_org, v_team, v_m2, 'member', now() - interval '30 days'), (v_org, v_team, v_m3, 'member', now() - interval '30 days'),
      (v_solo_org, v_solo_team, v_solo, 'leader', now() - interval '30 days');
    insert into app.trial (team_id, org_id, started_at, ends_at) values (v_team, v_org, now() - interval '1 day', now() + interval '13 days');
    -- a round answered by all four, an action owned by m1, an agenda item m1 proposed, m1 invited by address
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org, v_team, 'diagnostic', v_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round);
    for r in select unnest(array[v_lead, v_m1, v_m2, v_m3]) as who loop
      set local role authenticated;
      perform set_config('request.jwt.claims', format(claims, r.who), true);
      perform app.submit_response(v_round, (select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 4))
                                           from app.instrument_version_item vi where vi.instrument_version_id = v_ver));
      reset role;
    end loop;
    insert into app.action (org_id, team_id, title, owner_id, due_on, created_by) values (v_org, v_team, 'Privacy test action', v_m1, current_date + 5, v_lead);
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_meeting := (app.plan_meeting(v_team, 'Privacy meeting', current_date + 3, '09:00', 60) ->> 'meeting')::uuid;
    perform set_config('request.jwt.claims', format(claims, v_m1), true);
    perform app.propose_item(v_meeting, 'Privacy item by one', 'discussion', 'A way forward.', v_m1, 10, null);
    perform set_config('request.jwt.claims', format(claims, v_m2), true);
    perform app.propose_item(v_meeting, 'Privacy item by two', 'discussion', 'Another way.', v_m2, 10, null);
    reset role;
    insert into app.invitation (org_id, team_id, email, display_name, token_hash, created_by, created_at, expires_at, accepted_at, accepted_by)
    values (v_org, v_team, 'privacy-test-m1@example.invalid', 'Privacy one', sha256('privacy-test-token'::bytea), v_lead,
            now() - interval '30 days', now() - interval '16 days', now() - interval '29 days', v_m1);
    insert into app.audit_event (org_id, kind, actor, detail) values (v_org, 'sharing_changed', v_m1, '{}');
    select max(id) into v_audit from app.audit_event where org_id = v_org;
    -- every earlier mail waits; this suite claims its own
    update app.outbox set due_at = now() + interval '100 years' where state = 'due';

    -- 3 ------------------------------------------------------------ the person's own data, nobody else's
    v_content := app.export_person(v_m1);
    v_txt := concat_ws(',', v_content #>> '{person,name}', v_content #>> '{person,email}', v_content #>> '{groups,0,group}',
                       v_content #>> '{actions,0,title}', v_content #>> '{agenda_items_proposed,0,title}',
                       jsonb_array_length(v_content -> 'agenda_items_proposed'), v_content ->> 'invitations_sent',
                       jsonb_array_length(v_content -> 'audit'),
                       (v_content::text !~ 'privacy-test-(lead|m2|m3|solo)@' and v_content::text !~ 'Privacy (lead|two|three|solo)'
                        and v_content::text !~ 'Privacy item by two')::text);
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'the export holds the person''s own data and nobody else''s: no other member''s name or address',
      'expected', 'Privacy one,privacy-test-m1@example.invalid,Privacy test group,Privacy test action,Privacy item by one,1,0,1,true',
      'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'Privacy one,privacy-test-m1@example.invalid,Privacy test group,Privacy test action,Privacy item by one,1,0,1,true');

    -- 4 ------------------------------------------------------------ no answer
    v_txt := concat_ws(',', jsonb_array_length(v_content -> 'asked'), v_content #>> '{asked,0,answered}',
                       (select count(*) from jsonb_object_keys(v_content #> '{asked,0}') k where k not in ('group', 'kind', 'opened', 'answered')),
                       (v_content::text !~* '"(value|values|answers|level|score|scores|response)"')::text);
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'the export holds no answer, and says nothing of anyone''s answers',
      'expected', '1,true,0,true', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '1,true,0,true');

    -- 5 ------------------------------------------------------------ 5 a day
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m1), true);
    v_txt := '';
    for v_n in 1..6 loop
      v_res := app.request_export();
      v_txt := v_txt || coalesce(v_res ->> 'reason', 'ok') || ' ';
    end loop;
    reset role;
    v_txt := v_txt || case when (v_res ->> 'retry')::int between 1 and 86400 then 'a wait' else coalesce(v_res ->> 'retry', 'none') end
             || ', ' || (select count(*) from app.export_request where person_id = v_m1) || ' exports, '
             || (select count(*) from app.outbox where kind = 'export_ready' and person_id = v_m1) || ' mails';
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', '5 exports a day; the sixth answers too_many with the seconds to wait, and nothing is written',
      'expected', 'ok ok ok ok ok too_many a wait, 5 exports, 5 mails', 'actual', v_txt,
      'pass', v_txt = 'ok ok ok ok ok too_many a wait, 5 exports, 5 mails');

    -- 6 ------------------------------------------------------------ the one-time link
    update app.outbox set due_at = now() - interval '1 minute' where kind = 'export_ready' and person_id = v_m1;
    v_claim := app.claim_mail(10);
    select substring(c #>> '{facts,path}' from '^/export/(.+)$') into v_token
    from jsonb_array_elements(v_claim) c where c ->> 'kind' = 'export_ready' and c #>> '{to,0,email}' = 'privacy-test-m1@example.invalid' limit 1;
    set local role anon;
    perform set_config('request.jwt.claims', '', true);
    v_res := app.download_export(v_token);
    v_txt := concat_ws(',', jsonb_array_length(v_claim), v_res ->> 'ok', v_res #>> '{content,person,name}',
                       app.download_export(v_token) ->> 'reason', app.download_export('not-a-token-' || repeat('x', 30)) ->> 'reason');
    reset role;
    -- another of the five, its link lapsed
    select substring(c #>> '{facts,path}' from '^/export/(.+)$') into v_token
    from jsonb_array_elements(v_claim) c where c ->> 'kind' = 'export_ready'
      and not exists (select 1 from app.export_request e where e.token_hash = sha256(convert_to(substring(c #>> '{facts,path}' from '^/export/(.+)$'), 'UTF8')) and e.state <> 'ready')
    limit 1;
    update app.export_request set link_expires_at = now() - interval '1 minute' where token_hash = sha256(convert_to(v_token, 'UTF8'));
    set local role anon;
    v_txt := v_txt || ',' || (app.download_export(v_token) ->> 'reason');
    reset role;
    v_txt := v_txt || ',' || (select state || ':' || (content is null)::text from app.export_request where token_hash = sha256(convert_to(v_token, 'UTF8')));
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'the mailed link gives the file once; then used; a lapsed link expires and empties the file',
      'expected', '5,true,Privacy one,used,unknown,expired,expired:true', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '5,true,Privacy one,used,unknown,expired,expired:true');

    -- 7 ------------------------------------------------------------ the job
    update app.export_request set link_expires_at = now() - interval '1 minute' where person_id = v_m1 and state = 'ready';
    v_n := app.expire_exports();
    v_txt := v_n || ' expired, ' || (select count(*) from app.export_request where person_id = v_m1 and content is not null) || ' with content';
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'the job empties exports never downloaded once their link has lapsed',
      'expected', '3 expired, 0 with content', 'actual', v_txt, 'pass', v_txt = '3 expired, 0 with content');

    -- 8 ------------------------------------------------------------ the only leader
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res := app.delete_account();
    reset role;
    v_txt := concat_ws(',', v_res ->> 'reason', v_res #>> '{groups,0}', (select count(*) from auth.users where id = v_lead),
                       (select count(*) from app.membership where person_id = v_lead));
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'the only leader of a group with other members cannot delete their account, and nothing changes',
      'expected', 'sole_leader,Privacy test group,1,1', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'sole_leader,Privacy test group,1,1');

    -- 9 ------------------------------------------------------------ a member deletes their account
    select count(*) into v_m from app.response_set where round_id = v_round;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_m1), true);
    v_res := app.delete_account();
    reset role;
    v_txt := concat_ws(',', v_res ->> 'ok', (select count(*) from auth.users where id = v_m1), (select count(*) from app.person where id = v_m1),
                       (select count(*) from app.membership where person_id = v_m1), (select count(*) from app.participation where person_id = v_m1),
                       (select count(*) from app.action where owner_id = v_m1), (select count(*) from app.export_request where person_id = v_m1),
                       (select count(*) from app.outbox where person_id = v_m1),
                       (select count(*) from app.invitation where email = 'privacy-test-m1@example.invalid'));
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'a member deletes their account: their sign-in, person and every row that named them go',
      'expected', 'true,0,0,0,0,0,0,0,0', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,0,0,0,0,0,0,0,0');

    -- 10 ----------------------------------------------------------- what stays, nameless
    v_txt := concat_ws(',', (select count(*) || ':' || bool_and(proposed_by is null and owner_id is null)::text
                             from app.agenda_item where meeting_id = v_meeting and title = 'Privacy item by one'),
                       (select actor is null from app.audit_event where id = v_audit)::text,
                       ((select count(*) from app.response_set where round_id = v_round) = v_m)::text,
                       (select invited from app.assessment_round where id = v_round));
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'what they wrote for the group stays without their name; the group''s answers stay',
      'expected', '1:true,true,true,4', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '1:true,true,true,4');

    -- 11 ----------------------------------------------------------- no column still points at them
    v_n := 0;
    for r in
      select c.conrelid::regclass::text as rel, a.attname as col
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.confrelid in ('app.person'::regclass, 'auth.users'::regclass)
    loop
      execute format('select count(*) from %s where %I = $1', r.rel, r.col) into v_m using v_m1;
      v_n := v_n + v_m;
    end loop;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'no column that points at a person still holds their id',
      'expected', '0 rows', 'actual', v_n || ' rows', 'pass', v_n = 0);

    -- 12 ----------------------------------------------------------- alone in a group
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_solo), true);
    v_res := app.delete_account();
    reset role;
    v_txt := concat_ws(',', v_res ->> 'ok', (select count(*) from app.team where id = v_solo_team), (select count(*) from app.organisation where id = v_solo_org),
                       (select count(*) from app.team where id = v_team));
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'a person alone in a group: the group and its organisation go with them',
      'expected', 'true,0,0,1', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,0,0,1');

    -- 13 ----------------------------------------------------------- the audit trail
    v_txt := '';
    begin
      update app.audit_event set kind = 'plan_changed' where id = v_audit;
      v_txt := 'changed';
    exception when check_violation then
      v_txt := 'refused';
    end;
    begin
      delete from app.audit_event where id = v_audit;
      v_txt := v_txt || ',deleted';
    exception when check_violation then
      v_txt := v_txt || ',kept';
    end;
    insert into app.audit_event (org_id, kind, at, detail) values (v_org, 'plan_changed', now() - interval '25 months', '{}');
    v_n := app.prune_audit();
    v_txt := v_txt || ',' || v_n || ' pruned,' || (select count(*) from app.audit_event where id = v_audit);
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'nobody changes an audited event; a recent one is not deleted; one 24 months old is pruned',
      'expected', 'refused,kept,1 pruned,1', 'actual', v_txt, 'pass', v_txt like 'refused,kept,% pruned,1' and v_n >= 1);

    -- 14 ----------------------------------------------------------- consent given
    insert into app.personality_profile (person_id, test_id, band_set, scores)
    select v_m2, t.id, (select max(b.version) from app.profile_band_set b), '{"O": {"sum": 30, "n": 10}}'::jsonb
    from app.profile_test t where t.key = 'quick' and t.status = 'published' order by t.version desc limit 1;
    update app.personality_profile set taken_at = now() + interval '1 minute' where person_id = v_m2;
    update app.personality_profile set scores = '{"O": {"sum": 31, "n": 10}}'::jsonb where person_id = v_m2;
    select string_agg(concat_ws(':', a.kind, (a.org_id is null)::text, (a.actor = v_m2)::text,
                                (select string_agg(k, '+' order by k) from jsonb_object_keys(a.detail) k), a.detail ->> 'consent', a.detail ->> 'test'), ' ' order by a.id)
      into v_txt from app.audit_event a where a.actor = v_m2 and a.kind = 'consent_given';
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'saving a Leader Profile records consent given, with the person and the test and no score; a retake again',
      'expected', 'consent_given:true:true:consent+test:leader_profile:quick consent_given:true:true:consent+test:leader_profile:quick',
      'actual', coalesce(v_txt, 'none'),
      'pass', v_txt = 'consent_given:true:true:consent+test:leader_profile:quick consent_given:true:true:consent+test:leader_profile:quick');

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 15 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'privacy-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name like 'Privacy % organisation';
  v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_privacy
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_privacy order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_privacy;
  if v_failed is not null then
    raise exception 'privacy invariants failed: %', v_failed;
  end if;
  if v_count <> 15 then
    raise exception 'privacy invariants: expected 15 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_privacy;
