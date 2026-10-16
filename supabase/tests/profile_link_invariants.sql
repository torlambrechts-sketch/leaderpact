-- profile_link_invariants.sql — a private link to a Leader Profile (0031; D-66; CLAUDE.md invariant 11): made and
-- ended by its owner only, stored as a fingerprint, read as bands at its level by whoever holds it.
--
--      1  anon may run only the link's reader; a signed-in client also makes, reads and ends their own link
--      2  no client role holds any privilege on profile_link, service_role included
--      3  no session: making or reading a link says signed_out, and nothing is written
--      4  an unknown level, "nothing", or no profile: refused, and nothing is written
--      5  a link: a 22-character token, returned once, stored only as its SHA-256; Me reads it as on, at its level
--      6  whoever holds it reads the five domains' bands, the owner's name, the test and its day: never a sum or a count
--      7  a new link at domains and facets replaces the last: the old token reads nothing, the new one 35 bands
--      8  a wrong, short, long or odd token reads nothing
--      9  another person reads their own link (off) and cannot end the owner's
--     10  turned off: Me reads off, the token reads nothing, audited as a sharing change with the level only
--     11  a retake ends the link, audited with its reason
--     12  the export says the link is on, its level and its day, and never holds the token
--     13  deleting the profile removes the link
--     14  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block that is
-- rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profile_link_invariants.sql

create unlogged table if not exists public._inv_profile_link(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_profile_link;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_full uuid;
  v_all4 jsonb;
  v_res jsonb;
  v_token text;
  v_old text;
  v_txt text;
  v_n int;
  v_ok boolean;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- who may run the functions
  v_ok := has_function_privilege('anon', 'app.get_linked_profile(text)', 'execute')
          and not has_function_privilege('anon', 'app.make_profile_link(text)', 'execute')
          and not has_function_privilege('anon', 'app.end_profile_link()', 'execute')
          and not has_function_privilege('anon', 'app.get_profile_link()', 'execute')
          and has_function_privilege('authenticated', 'app.make_profile_link(text)', 'execute')
          and has_function_privilege('authenticated', 'app.end_profile_link()', 'execute')
          and has_function_privilege('authenticated', 'app.get_profile_link()', 'execute')
          and has_function_privilege('authenticated', 'app.get_linked_profile(text)', 'execute')
          and not has_function_privilege('anon', 'app.profile_link_retake()', 'execute')
          and not has_function_privilege('authenticated', 'app.profile_link_retake()', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'anon runs only the reader; a signed-in client makes, reads and ends its own link',
    'expected', 'as granted', 'actual', case when v_ok then 'as granted' else 'not as granted' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- the table is nobody's to read or write
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, 'app.profile_link', p.priv);
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no client role holds a privilege on profile_link, service_role included',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  select t.id into v_full from app.profile_test t where t.key = 'full' and t.status = 'published';
  select jsonb_object_agg(i.id::text, 4) into v_all4 from app.profile_item i where i.test_id = v_full;

  begin
    insert into auth.users (id, email) values
      (v_owner, 'profile-link-test-owner@example.invalid'), (v_other, 'profile-link-test-other@example.invalid');
    insert into app.person (id, display_name) values (v_owner, 'Link test owner'), (v_other, 'Link test other');

    -- 3 ------------------------------------------------------------ no session
    perform set_config('request.jwt.claims', '', true);
    set local role authenticated;
    v_txt := concat_ws(',', app.make_profile_link('domains') ->> 'reason', app.get_profile_link() ->> 'reason');
    reset role;
    select count(*) into v_n from app.profile_link;
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'no session: signed_out, nothing written',
      'expected', 'signed_out,signed_out, 0', 'actual', coalesce(v_txt, 'null') || ', ' || v_n, 'pass', v_txt = 'signed_out,signed_out' and v_n = 0);

    -- 4 ------------------------------------------------------------ refused
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_txt := app.make_profile_link('domains') ->> 'reason';
    v_res := app.save_profile('full', v_all4);
    v_txt := concat_ws(',', v_txt, app.make_profile_link('nothing') ->> 'reason', app.make_profile_link('everything') ->> 'reason',
      app.make_profile_link(null) ->> 'reason');
    reset role;
    select count(*) into v_n from app.profile_link;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'no profile, "nothing", an unknown level, none: refused, nothing written',
      'expected', 'no_profile,invalid,invalid,invalid, 0', 'actual', coalesce(v_txt, 'null') || ', ' || v_n,
      'pass', v_txt = 'no_profile,invalid,invalid,invalid' and v_n = 0);

    -- 5 ------------------------------------------------------------ a link, stored as its fingerprint
    set local role authenticated;
    v_res := app.make_profile_link('domains');
    v_token := v_res ->> 'token';
    v_txt := concat_ws(',', app.get_profile_link() ->> 'on', app.get_profile_link() ->> 'level');
    reset role;
    v_ok := v_res ->> 'ok' = 'true' and v_token ~ '^[A-Za-z0-9_-]{22}$'
            and exists (select 1 from app.profile_link l where l.person_id = v_owner and l.token_hash = pg_catalog.sha256(convert_to(v_token, 'UTF8')))
            and not exists (select 1 from app.profile_link l where position(convert_to(v_token, 'UTF8') in l.token_hash) > 0)
            and v_txt = 'true,domains';
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'a 22-character token, stored only as its SHA-256; Me reads it on, at domains',
      'expected', 'stored as a hash; true,domains', 'actual', case when v_ok then 'stored as a hash; ' || v_txt else 'not as expected: ' || coalesce(v_txt, 'null') end, 'pass', v_ok);

    -- 6 ------------------------------------------------------------ what the link shows
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    v_res := app.get_linked_profile(v_token);
    reset role;
    select count(*) into v_n from jsonb_array_elements(v_res -> 'traits') x;
    v_ok := v_res ->> 'ok' = 'true' and v_res ->> 'name' = 'Link test owner' and v_res ->> 'test' = 'full' and v_res ->> 'level' = 'domains'
            and v_res ->> 'taken_on' = to_char((now() at time zone 'UTC')::date, 'YYYY-MM-DD') and v_n = 5
            and not exists (select 1 from jsonb_array_elements(v_res -> 'traits') x where x ->> 'kind' <> 'domain' or x ? 'sum' or x ? 'n' or x ? 'position'
                            or x ->> 'band' not in ('lower', 'middle', 'higher'))
            and v_res::text !~ '"sum"|"scores"|"position"';
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'the holder reads five domains'' bands, the name, the test and its day; never a sum',
      'expected', '5 bands', 'actual', v_n || case when v_ok then ' bands' else ' bands, not as expected' end, 'pass', v_ok);

    -- 7 ------------------------------------------------------------ a new link replaces the last
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_old := v_token;
    v_token := app.make_profile_link('facets') ->> 'token';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    v_txt := concat_ws(',', app.get_linked_profile(v_old) ->> 'reason',
      (select count(*) from jsonb_array_elements(app.get_linked_profile(v_token) -> 'traits')), app.get_linked_profile(v_token) ->> 'level');
    reset role;
    select v_txt || ',' || count(*) into v_txt from app.profile_link where person_id = v_owner;
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a new link at domains and facets replaces the last: old reads nothing, new 35 bands',
      'expected', 'not_found,35,facets,1', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'not_found,35,facets,1');

    -- 8 ------------------------------------------------------------ odd tokens
    v_old := app.new_link_code();
    set local role anon;
    v_txt := concat_ws(',', app.get_linked_profile(v_old) ->> 'reason', app.get_linked_profile(left(v_token, 21)) ->> 'reason',
      app.get_linked_profile(v_token || 'x') ->> 'reason', app.get_linked_profile(null) ->> 'reason',
      app.get_linked_profile(''' or ''1''=''1') ->> 'reason', app.get_linked_profile(upper(v_token)) ->> 'ok');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'a wrong, short, long, missing or odd token reads nothing',
      'expected', 'not_found x5, then false or true only if the token had no letters', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt like 'not_found,not_found,not_found,not_found,not_found,%' and (split_part(v_txt, ',', 6) = 'false' or v_token = upper(v_token)));

    -- 9 ------------------------------------------------------------ another person
    perform set_config('request.jwt.claims', format(claims, v_other), true);
    set local role authenticated;
    v_txt := concat_ws(',', app.get_profile_link() ->> 'on', app.end_profile_link() ->> 'ok');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    v_txt := v_txt || ',' || (app.get_linked_profile(v_token) ->> 'ok');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'another person reads their own link as off and cannot end the owner''s',
      'expected', 'false,true,true', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'false,true,true');

    -- 10 ----------------------------------------------------------- turned off
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_res := app.end_profile_link();
    v_txt := concat_ws(',', v_res ->> 'ok', app.get_profile_link() ->> 'on');
    reset role;
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    v_txt := v_txt || ',' || (app.get_linked_profile(v_token) ->> 'reason');
    reset role;
    select v_txt || ',' || count(*) into v_txt from app.audit_event a
    where a.actor = v_owner and a.kind = 'sharing_changed' and a.detail = '{"to": "link", "level": "off"}'::jsonb;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'turned off: Me reads off, the token reads nothing, audited with the level only',
      'expected', 'true,false,not_found,1', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,false,not_found,1');

    -- 11 ----------------------------------------------------------- a retake ends it
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_token := app.make_profile_link('domains') ->> 'token';
    v_res := app.save_profile('full', v_all4);
    v_txt := app.get_profile_link() ->> 'on';
    reset role;
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    v_txt := v_txt || ',' || (app.get_linked_profile(v_token) ->> 'reason');
    reset role;
    select v_txt || ',' || count(*) into v_txt from app.audit_event a
    where a.actor = v_owner and a.kind = 'sharing_changed' and a.detail = '{"to": "link", "level": "off", "reason": "retake"}'::jsonb;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a retake ends the link, audited with its reason',
      'expected', 'false,not_found,1', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'false,not_found,1');

    -- 12 ----------------------------------------------------------- the export
    perform set_config('request.jwt.claims', format(claims, v_owner), true);
    set local role authenticated;
    v_token := app.make_profile_link('facets') ->> 'token';
    reset role;
    v_res := app.export_person(v_owner) #> '{leader_profile,private_link}';
    v_ok := v_res ->> 'on' = 'true' and v_res ->> 'level' = 'facets' and v_res ? 'made_at'
            and position(v_token in app.export_person(v_owner)::text) = 0
            and exists (select 1 from app.export_coverage c where c.table_name = 'profile_link' and c.treatment = 'included');
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'the export says on, facets and the day, and never holds the token',
      'expected', 'on, facets, a day, no token', 'actual', coalesce(v_res::text, 'null'), 'pass', v_ok);

    -- 13 ----------------------------------------------------------- deleting the profile removes the link
    set local role authenticated;
    v_res := app.delete_profile();
    reset role;
    select count(*) into v_n from app.profile_link where person_id = v_owner;
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'deleting the profile removes the link',
      'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 14 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'profile-link-test-%@example.invalid';
  v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_profile_link
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_profile_link order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_profile_link;
  if v_failed is not null then
    raise exception 'profile link invariants failed: %', v_failed;
  end if;
  if v_count <> 14 then
    raise exception 'profile link invariants: expected 14 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_profile_link;
