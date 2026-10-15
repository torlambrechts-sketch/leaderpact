-- signup_invariants.sql — the account's name and company from sign-up (0028; owner, 15 October 2026; D-57).
--
--      1  ensure_person is the signed-in caller's; the name and company readers are no client's
--      2  the name given at sign-up is the display name; a provider's name when there is none; the email's
--         first part when neither; control characters stripped, 120 characters kept
--      3  ensure_person makes the row once, and never renames a row that exists; signed out, nothing
--      4  a group's organisation takes the company; without one, the group's name; 200 characters kept
--      5  the leader's person row from start_group carries the sign-up's name
--      6  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/signup_invariants.sql

create unlogged table if not exists public._inv_signup(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_signup;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_d uuid := gen_random_uuid();
  v_e uuid := gen_random_uuid();
  v_res jsonb;
  v_txt text;
  v_n int;
  v_ok boolean;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.ensure_person()', 'execute')
          and not has_function_privilege('anon', 'app.ensure_person()', 'execute')
          and not exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) g,
                                        unnest(array['app.display_name_for(uuid)', 'app.company_for(uuid)']) f
                          where has_function_privilege(g, f, 'execute'));
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'ensure_person is the signed-in caller''s; the name and company readers are no client''s',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (v_a, 'signup-test-a@example.invalid', '{"full_name": "  Astrid  Berg ", "company": "Lumio Test AS"}'),
      (v_b, 'signup-test-b@example.invalid', '{"name": "Bjørn Dahl"}'),
      (v_c, 'signup-test-c@example.invalid', null),
      (v_d, 'signup-test-d@example.invalid', jsonb_build_object('full_name', 'Dag' || chr(10) || 'Moe' || chr(7), 'company', repeat('x', 250))),
      (v_e, 'signup-test-e@example.invalid', jsonb_build_object('full_name', repeat('n', 130), 'company', '   '));

    -- 2 ------------------------------------------------------------ the display name
    v_txt := concat_ws('|', app.display_name_for(v_a), app.display_name_for(v_b), app.display_name_for(v_c),
                       app.display_name_for(v_d), length(app.display_name_for(v_e)));
    v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'the name given at sign-up is the display name; a provider''s name when there is none; the email''s first part when neither; control characters stripped, 120 characters kept',
      'expected', 'Astrid  Berg|Bjørn Dahl|signup-test-c|Dag Moe|120', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'Astrid  Berg|Bjørn Dahl|signup-test-c|Dag Moe|120');

    -- 3 ------------------------------------------------------------ ensure_person
    -- signed out: the role with no user in its claims (anon holds no grant at all, check 1)
    set local role authenticated;
    perform set_config('request.jwt.claims', '{"role": "authenticated"}', true);
    v_txt := app.ensure_person() ->> 'reason';
    reset role;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_a), true);
    v_txt := concat_ws(',', v_txt, app.ensure_person() ->> 'ok', app.ensure_person() ->> 'ok');
    perform set_config('request.jwt.claims', format(claims, v_b), true);
    v_txt := concat_ws(',', v_txt, app.ensure_person() ->> 'ok');
    reset role;
    -- a row that exists keeps its name, whatever the metadata says later
    update auth.users set raw_user_meta_data = '{"full_name": "Someone Else"}' where id = v_a;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_a), true);
    perform app.ensure_person();
    reset role;
    select v_txt || ',' || count(*) || ',' || string_agg(display_name, '/' order by display_name) into v_txt
    from app.person where id in (v_a, v_b);
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'ensure_person makes the row once, and never renames a row that exists; signed out, nothing',
      'expected', 'signed_out,true,true,true,2,Astrid  Berg/Bjørn Dahl', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'signed_out,true,true,true,2,Astrid  Berg/Bjørn Dahl');

    -- 4 ------------------------------------------------------------ the organisation's name
    update auth.users set raw_user_meta_data = '{"full_name": "Astrid Berg", "company": "Lumio Test AS"}' where id = v_a;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_a), true);
    v_res := app.start_group('Signup test group A', 5, gen_random_uuid());
    perform set_config('request.jwt.claims', format(claims, v_c), true);
    v_txt := v_res ->> 'ok' || ',' || (app.start_group('Signup test group C', 5, gen_random_uuid()) ->> 'ok');
    perform set_config('request.jwt.claims', format(claims, v_d), true);
    v_txt := v_txt || ',' || (app.start_group('Signup test group D', 5, gen_random_uuid()) ->> 'ok');
    perform set_config('request.jwt.claims', format(claims, v_e), true);
    v_txt := v_txt || ',' || (app.start_group('Signup test group E', 5, gen_random_uuid()) ->> 'ok');
    reset role;
    select v_txt || ',' || string_agg(case when length(o.name) > 60 then 'x*' || length(o.name) else o.name end, '/' order by t.name) into v_txt
    from app.team t join app.organisation o on o.id = t.org_id where t.name like 'Signup test group %';
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'a group''s organisation takes the company; without one, the group''s name; 200 characters kept',
      'expected', 'true,true,true,true,Lumio Test AS/Signup test group C/x*200/Signup test group E', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,true,true,true,Lumio Test AS/Signup test group C/x*200/Signup test group E');

    -- 5 ------------------------------------------------------------ the leader's row from start_group
    select string_agg(p.display_name, '/' order by p.display_name) into v_txt from app.person p where p.id in (v_c, v_d);
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'the leader''s person row from start_group carries the sign-up''s name',
      'expected', 'Dag Moe/signup-test-c', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'Dag Moe/signup-test-c');

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 6 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'signup-test-%@example.invalid';
  select v_n + count(*) into v_n from app.team where name like 'Signup test group %';
  v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_signup
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_signup order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_signup;
  if v_failed is not null then
    raise exception 'signup invariants failed: %', v_failed;
  end if;
  if v_count <> 6 then
    raise exception 'signup invariants: expected 6 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_signup;
