-- profile_invariants.sql — the Leader Profile is its owner's alone until shared (0011, 0012; handoff 6.17;
-- CLAUDE.md invariant 11; milestone 7: "A profile is unreadable by anyone else until shared. A retake resets
-- sharing.").
--
--      1  only a signed-in client may run the profile's functions; anon may not
--      2  no client role may write a profile or a share; anon and service_role may not read either
--      3  the published tests are reference data: quick 20 items and 5 traits, full 120 items and 35 traits
--      4  no session: save_profile says signed_out and writes nothing
--      5  a missing, extra, out-of-range or fractional answer is refused, and nothing is written
--      6  the full test's sums: every answer 4 gives O 72, C 70, E 84, A 62, N 82 of 24, and its facets
--      7  the bands of those sums: domains middle; Morality and Cautiousness lower, Anxiety higher
--      8  the owner reads their own profile; another signed-in person reads none of it
--      9  before any share, a fellow member sees the owner listed with "nothing": no test, no traits
--     10  shared as domains, the group sees the five domains' bands only, never a sum or a count
--     11  shared as domains and facets, the group sees all 35 traits' bands
--     12  a share reaches only the group it was given to; a non-member reads nothing of the group
--     13  a share is refused for a group the caller is not in, without a profile, or at an unknown level
--     14  a retake replaces the profile and resets every share to nothing, audited per group
--     15  delete removes the profile and its shares at once, audited with no detail
--     16  audit rows carry ids, a level and a reason only; a profile holds sums and counts, never an answer
--     17  a published test's items and a band set never change
--     18  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profile_invariants.sql

create unlogged table if not exists public._inv_profile(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_profile;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_owner uuid := gen_random_uuid();
  v_viewer uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_team2 uuid := gen_random_uuid();
  v_quick uuid;
  v_full uuid;
  v_all4 jsonb;
  v_quick3 jsonb;
  v_res jsonb;
  v_txt text;
  v_n int;
  v_m int;
  v_ok boolean;
  v_json jsonb;
  v_key text;
  r record;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- who may run the functions
  v_ok := not has_function_privilege('anon', 'app.save_profile(text, jsonb)', 'execute')
          and not has_function_privilege('anon', 'app.set_profile_share(uuid, text)', 'execute')
          and not has_function_privilege('anon', 'app.delete_profile()', 'execute')
          and not has_function_privilege('anon', 'app.get_group_profiles(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.save_profile(text, jsonb)', 'execute')
          and has_function_privilege('authenticated', 'app.set_profile_share(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.delete_profile()', 'execute')
          and has_function_privilege('authenticated', 'app.get_group_profiles(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.profile_band(int, int, int)', 'execute')
          and not has_function_privilege('anon', 'app.profile_band(int, int, int)', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'only a signed-in client may run the profile''s functions',
    'expected', 'anon no, authenticated yes', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- no client writes, no other reader
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.personality_profile'), ('app.profile_share')) as t (tbl)
  cross join (values ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.tbl, p.priv);
  select count(*) into v_m
  from (values ('anon'), ('service_role')) as g (role)
  cross join (values ('app.personality_profile'), ('app.profile_share')) as t (tbl)
  where has_table_privilege(g.role, t.tbl, 'select');
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no client writes a profile or a share; anon and service_role read neither',
    'expected', '0 writes, 0 reads', 'actual', v_n || ' writes, ' || v_m || ' reads', 'pass', v_n = 0 and v_m = 0);

  -- 3 -------------------------------------------------------------- the published tests, read as a visitor
  set local role anon;
  select t.id into v_quick from app.profile_test t where t.key = 'quick' and t.status = 'published';
  select t.id into v_full from app.profile_test t where t.key = 'full' and t.status = 'published';
  v_txt := concat_ws(',',
    (select count(*) from app.profile_item i where i.test_id = v_quick),
    (select count(*) from app.profile_trait x where x.test_id = v_quick),
    (select count(*) from app.profile_item i where i.test_id = v_full),
    (select count(*) from app.profile_trait x where x.test_id = v_full));
  reset role;
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'the published tests: quick 20 items and 5 traits, full 120 and 35',
    'expected', '20,5,120,35', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '20,5,120,35');

  select jsonb_object_agg(i.id::text, 4) into v_all4 from app.profile_item i where i.test_id = v_full;
  select jsonb_object_agg(i.id::text, 3) into v_quick3 from app.profile_item i where i.test_id = v_quick;

  begin
    insert into auth.users (id, email) values
      (v_owner, 'profile-test-owner@example.invalid'), (v_viewer, 'profile-test-viewer@example.invalid'),
      (v_outsider, 'profile-test-outsider@example.invalid');
    insert into app.person (id, display_name) values (v_viewer, 'Profile test viewer'), (v_outsider, 'Profile test outsider');
    insert into app.organisation (id, name) values (v_org, 'Profile test organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Profile test group'), (v_team2, v_org, 'Profile test group two');

    -- 4 ------------------------------------------------------------ no session
    perform set_config('request.jwt.claims', '', true);
    set local role authenticated;
    v_res := app.save_profile('full', v_all4);
    reset role;
    select count(*) into v_n from app.personality_profile where person_id = v_owner;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'no session: signed_out, nothing written',
      'expected', 'signed_out, 0', 'actual', coalesce(v_res ->> 'reason', 'null') || ', ' || v_n, 'pass', v_res ->> 'reason' = 'signed_out' and v_n = 0);

    -- 5 ------------------------------------------------------------ refused answers
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_txt := concat_ws(',',
      app.save_profile('full', v_all4 - (select min(k) from jsonb_object_keys(v_all4) k)) ->> 'reason',
      app.save_profile('full', v_all4 || jsonb_build_object(gen_random_uuid()::text, 3)) ->> 'reason',
      app.save_profile('full', v_all4 || jsonb_build_object((select min(k) from jsonb_object_keys(v_all4) k), 6)) ->> 'reason',
      app.save_profile('full', v_all4 || jsonb_build_object((select min(k) from jsonb_object_keys(v_all4) k), 2.5)) ->> 'reason',
      app.save_profile('full', v_quick3) ->> 'reason',
      app.save_profile('full', '[]'::jsonb) ->> 'reason',
      app.save_profile('medium', v_all4) ->> 'reason');
    reset role;
    select count(*) into v_n from app.personality_profile where person_id = v_owner;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'missing, extra, 6, 2.5, the other test''s answers, an array, an unknown test: refused',
      'expected', 'invalid x6, unavailable, 0 written', 'actual', coalesce(v_txt, 'null') || ', ' || v_n || ' written',
      'pass', v_txt = 'invalid,invalid,invalid,invalid,invalid,invalid,unavailable' and v_n = 0);

    -- 6 ------------------------------------------------------------ the sums
    set local role authenticated;
    v_res := app.save_profile('full', v_all4);
    reset role;
    select scores into v_json from app.personality_profile where person_id = v_owner;
    v_txt := concat_ws(',', v_json #>> '{O,sum}', v_json #>> '{C,sum}', v_json #>> '{E,sum}', v_json #>> '{A,sum}', v_json #>> '{N,sum}',
      v_json #>> '{O,n}', v_json #>> '{A2,sum}', v_json #>> '{N1,sum}', v_json #>> '{O4,sum}', v_json #>> '{C6,sum}', v_json #>> '{E5,sum}', v_json #>> '{E5,n}',
      (select count(*) from jsonb_object_keys(v_json)));
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'every answer 4: O 72, C 70, E 84, A 62, N 82 of 24; A2 8, N1 16, O4 10, C6 8, E5 16 of 4; 35 traits',
      'expected', 'ok, 72,70,84,62,82,24,8,16,10,8,16,4,35', 'actual', coalesce(v_res ->> 'ok', 'null') || ', ' || coalesce(v_txt, 'null'),
      'pass', (v_res ->> 'ok')::boolean and v_txt = '72,70,84,62,82,24,8,16,10,8,16,4,35');

    -- 7 ------------------------------------------------------------ the bands
    v_txt := concat_ws(',', app.profile_band(72, 24, 1), app.profile_band(62, 24, 1), app.profile_band(82, 24, 1),
      app.profile_band(8, 4, 1), app.profile_band(8, 4, 1), app.profile_band(16, 4, 1),
      app.profile_band(55, 24, 1), app.profile_band(56, 24, 1), app.profile_band(88, 24, 1), app.profile_band(89, 24, 1));
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'bands: O, A, N middle; Morality, Cautiousness lower; Anxiety higher; 55 lower, 56 and 88 middle, 89 higher of 24',
      'expected', 'middle,middle,middle,lower,lower,higher,lower,middle,middle,higher', 'actual', v_txt,
      'pass', v_txt = 'middle,middle,middle,lower,lower,higher,lower,middle,middle,higher');

    -- 8 ------------------------------------------------------------ the owner reads it; nobody else does
    set local role authenticated;
    select count(*) into v_n from app.personality_profile;
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    select count(*) into v_m from app.personality_profile where person_id = v_owner;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'the owner reads their profile; another signed-in person reads none',
      'expected', 'owner 1, other 0', 'actual', 'owner ' || v_n || ', other ' || v_m, 'pass', v_n = 1 and v_m = 0);

    -- 9 ------------------------------------------------------------ in a group, before any share
    insert into app.membership (org_id, team_id, person_id, role) values
      (v_org, v_team, v_owner, 'leader'), (v_org, v_team, v_viewer, 'member'), (v_org, v_team2, v_owner, 'leader');
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    set local role authenticated;
    select * into r from app.get_group_profiles(v_team) g where g.person_id = v_owner;
    select count(*) into v_n from app.get_group_profiles(v_team);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'before a share: listed with nothing, no test, no traits',
      'expected', '2 rows, nothing, null, null', 'actual', v_n || ' rows, ' || coalesce(r.level, 'null') || ', ' || coalesce(r.test, 'null') || ', ' || coalesce(r.traits::text, 'null'),
      'pass', v_n = 2 and r.level = 'nothing' and r.test is null and r.traits is null);

    -- 10 ----------------------------------------------------------- shared as domains
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_res := app.set_profile_share(v_team, 'domains');
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    select * into r from app.get_group_profiles(v_team) g where g.person_id = v_owner;
    reset role;
    select count(*), count(*) filter (where t ->> 'kind' = 'domain'),
           count(*) filter (where t ? 'sum' or t ? 'n' or t ? 'scores'),
           string_agg(t ->> 'band', ',' order by t ->> 'key')
      into v_n, v_m, v_json, v_txt
    from jsonb_array_elements(r.traits) t;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'shared as domains: five domain bands, no sum or count',
      'expected', 'ok, domains, full, 5 traits, 5 domains, 0 sums, middle x5',
      'actual', coalesce(v_res ->> 'ok', 'null') || ', ' || r.level || ', ' || coalesce(r.test, 'null') || ', ' || v_n || ' traits, ' || v_m || ' domains, ' || v_json || ' sums, ' || coalesce(v_txt, 'null'),
      'pass', (v_res ->> 'ok')::boolean and r.level = 'domains' and r.test = 'full' and v_n = 5 and v_m = 5 and v_json::int = 0
              and v_txt = 'middle,middle,middle,middle,middle');

    -- 11 ----------------------------------------------------------- shared as domains and facets
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_res := app.set_profile_share(v_team, 'facets');
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    select * into r from app.get_group_profiles(v_team) g where g.person_id = v_owner;
    reset role;
    select count(*), count(*) filter (where t ->> 'kind' = 'facet'),
           max(t ->> 'band') filter (where t ->> 'key' = 'A2') || ',' || max(t ->> 'band') filter (where t ->> 'key' = 'N1')
      into v_n, v_m, v_txt
    from jsonb_array_elements(r.traits) t;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'shared as domains and facets: 35 bands, Morality lower, Anxiety higher',
      'expected', 'facets, 35, 30 facets, lower,higher', 'actual', r.level || ', ' || v_n || ', ' || v_m || ' facets, ' || coalesce(v_txt, 'null'),
      'pass', r.level = 'facets' and v_n = 35 and v_m = 30 and v_txt = 'lower,higher');

    -- 12 ----------------------------------------------------------- one group's share is not another's
    insert into app.membership (org_id, team_id, person_id, role) values (v_org, v_team2, v_viewer, 'member');
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    set local role authenticated;
    select g.level into v_txt from app.get_group_profiles(v_team2) g where g.person_id = v_owner;
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    select count(*) into v_n from app.get_group_profiles(v_team);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'a share reaches only its group; a non-member reads nothing of it',
      'expected', 'nothing in the other group, 0 rows', 'actual', coalesce(v_txt, 'null') || ' in the other group, ' || v_n || ' rows',
      'pass', v_txt = 'nothing' and v_n = 0);

    -- 13 ----------------------------------------------------------- refused shares
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    set local role authenticated;
    v_txt := app.set_profile_share(v_team, 'domains') ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    v_txt := concat_ws(',', v_txt, app.set_profile_share(v_team, 'domains') ->> 'reason');
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    v_txt := concat_ws(',', v_txt, app.set_profile_share(v_team, 'everything') ->> 'reason', app.set_profile_share(null, 'domains') ->> 'reason');
    reset role;
    select count(*) into v_n from app.profile_share where person_id in (v_viewer, v_outsider);
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'a share for a group not one''s own, without a profile, at an unknown level: refused',
      'expected', 'not_member,no_profile,invalid,not_member, 0 written', 'actual', coalesce(v_txt, 'null') || ', ' || v_n || ' written',
      'pass', v_txt = 'not_member,no_profile,invalid,not_member' and v_n = 0);

    -- 14 ----------------------------------------------------------- a retake resets sharing
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_res := app.set_profile_share(v_team2, 'domains');
    v_res := app.save_profile('quick', v_quick3);
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    select * into r from app.get_group_profiles(v_team) g where g.person_id = v_owner;
    reset role;
    select string_agg(level, ',' order by level) into v_txt from app.profile_share where person_id = v_owner;
    select count(*) into v_n from app.audit_event where actor = v_owner and kind = 'sharing_changed' and detail ->> 'reason' = 'retake';
    select t.key into v_key from app.personality_profile pp join app.profile_test t on t.id = pp.test_id where pp.person_id = v_owner;
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'a retake replaces the profile and resets both shares to nothing, audited twice',
      'expected', 'ok, quick, nothing,nothing, group sees nothing, 2 audited',
      'actual', coalesce(v_res ->> 'ok', 'null') || ', ' || coalesce(v_key, 'null') || ', ' || coalesce(v_txt, 'null') || ', group sees ' || r.level || ', ' || v_n || ' audited',
      'pass', (v_res ->> 'ok')::boolean and v_key = 'quick' and v_txt = 'nothing,nothing' and r.level = 'nothing' and r.traits is null and v_n = 2);

    -- 15 ----------------------------------------------------------- delete
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_res := app.set_profile_share(v_team, 'facets');
    v_res := app.delete_profile();
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    select * into r from app.get_group_profiles(v_team) g where g.person_id = v_owner;
    reset role;
    select count(*) into v_n from app.personality_profile where person_id = v_owner;
    select v_n + count(*) into v_n from app.profile_share where person_id = v_owner;
    select count(*) into v_m from app.audit_event where actor = v_owner and kind = 'profile_deleted' and detail = '{}'::jsonb and org_id is null;
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'delete removes the profile and its shares at once, audited with no detail',
      'expected', 'ok, 0 left, group sees nothing, 1 audited', 'actual', coalesce(v_res ->> 'ok', 'null') || ', ' || v_n || ' left, group sees ' || r.level || ', ' || v_m || ' audited',
      'pass', (v_res ->> 'ok')::boolean and v_n = 0 and r.level = 'nothing' and v_m = 1);

    -- 16 ----------------------------------------------------------- no answer anywhere
    select count(*) into v_n from app.audit_event a, jsonb_object_keys(a.detail) k
    where a.actor = v_owner and k not in ('team', 'level', 'reason');
    select string_agg(column_name, ',' order by ordinal_position) into v_txt
    from information_schema.columns where table_schema = 'app' and table_name = 'personality_profile';
    perform set_config('request.jwt.claims', format(claims, v_viewer), true);
    set local role authenticated;
    v_res := app.save_profile('full', v_all4);
    reset role;
    select count(*) into v_m from app.personality_profile pp, jsonb_each(pp.scores) s
    where pp.person_id = v_viewer and (select array_agg(k order by k) from jsonb_object_keys(s.value) k) <> array['n', 'sum'];
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'audit rows carry ids, a level and a reason; a profile holds sums and counts only',
      'expected', '0 other keys, person_id,test_id,band_set,taken_at,scores, 0 other score keys',
      'actual', v_n || ' other keys, ' || coalesce(v_txt, 'null') || ', ' || v_m || ' other score keys',
      'pass', v_n = 0 and v_txt = 'person_id,test_id,band_set,taken_at,scores' and v_m = 0);

    -- 17 ----------------------------------------------------------- published content is fixed
    v_n := 0;
    begin
      update app.profile_item set text = '{"en": "Changed."}' where test_id = v_full and ordinal = 1;
    exception when check_violation then v_n := v_n + 1;
    end;
    begin
      update app.profile_band_set set lower_below = 2.00 where version = 1;
    exception when check_violation then v_n := v_n + 1;
    end;
    begin
      update app.profile_test set body_hash = repeat('0', 64) where id = v_quick;
    exception when check_violation then v_n := v_n + 1;
    end;
    v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'a published item, a band set and a test''s hash never change',
      'expected', '3 refused', 'actual', v_n || ' refused', 'pass', v_n = 3);

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 18 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'profile-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Profile test organisation';
  v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_profile
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_profile order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_profile;
  if v_failed is not null then
    raise exception 'profile invariants failed: %', v_failed;
  end if;
  if v_count <> 18 then
    raise exception 'profile invariants: expected 18 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_profile;
