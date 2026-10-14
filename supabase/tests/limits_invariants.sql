-- limits_invariants.sql — rate limits that answer 429 (0021; handoff 8, Rate limits; milestone 16: "Limits return
-- 429").
--
--      1  the counters are reached as reviewed: the app's public count and PostgREST's pre-request; nothing else
--      2  no role holds a privilege on the limits or the counters; a counter holds a hash, never an address
--      3  the limits are handoff 8's, as rows
--      4  the public count takes only the scan's and sign-in's buckets, and only a keyed hash
--      5  the scan: 60 an hour per network pass, the 61st waits; another network is not touched
--      6  a window that has ended starts again
--      7  the API: 120 writes a minute per person pass, the 121st answers HTTP 429 with the seconds to wait
--      8  a live meeting's events: 10 a second pass, the 11th answers 429; other calls do not count as events
--      9  an anonymous request is not counted
--     10  PostgREST runs the pre-request, where its role exists
--     11  pruning removes the windows that ended, and keeps the rest
--     12  where pg_cron exists, the pruning runs hourly, once
--     13  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/limits_invariants.sql

create unlogged table if not exists public._inv_limits(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_limits;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_net text := encode(sha256('limits-test-network-a'::bytea), 'hex');
  v_net2 text := encode(sha256('limits-test-network-b'::bytea), 'hex');
  v_txt text;
  v_n int;
  v_m int;
  v_ok boolean;
  v_state text;
  v_detail text;
begin
  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('anon', 'app.take_public_rate(text, text)', 'execute')
          and has_function_privilege('authenticated', 'app.take_public_rate(text, text)', 'execute')
          and has_function_privilege('anon', 'app.pre_request()', 'execute')
          and has_function_privilege('authenticated', 'app.pre_request()', 'execute')
          -- PostgREST runs it as every role it serves: the dispatcher's service role too (0027)
          and has_function_privilege('service_role', 'app.pre_request()', 'execute')
          and has_function_privilege('service_role', 'app.prune_rate_windows()', 'execute')
          and not exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) r
                          where has_function_privilege(r, 'app.take_rate(text, text)', 'execute'))
          and not exists (select 1 from unnest(array['anon', 'authenticated']) r
                          where has_function_privilege(r, 'app.prune_rate_windows()', 'execute'));
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the counters are reached as reviewed: the app''s public count and PostgREST''s pre-request; nothing else',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- no privilege; a hash only
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.rate_limit'), ('app.rate_window')) as t (rel)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.rel, p.priv);
  select string_agg(a.attname, ',' order by a.attnum) into v_txt
  from pg_attribute a where a.attrelid = 'app.rate_window'::regclass and a.attnum > 0 and not a.attisdropped;
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no role holds a privilege on the limits or the counters; a counter holds a hash, never an address',
    'expected', '0 privileges; bucket,key_hash,window_start,hits', 'actual', v_n || ' privileges; ' || v_txt,
    'pass', v_n = 0 and v_txt = 'bucket,key_hash,window_start,hits');

  -- 3 -------------------------------------------------------------- handoff 8's limits
  select string_agg(bucket || '=' || max_hits || '/' || window_seconds, ' ' order by bucket) into v_txt from app.rate_limit;
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'the limits are handoff 8''s, as rows',
    'expected', 'api=120/60 export=5/86400 live_event=10/1 scan_submit=60/3600 sign_in=5/3600', 'actual', v_txt,
    'pass', v_txt = 'api=120/60 export=5/86400 live_event=10/1 scan_submit=60/3600 sign_in=5/3600');

  begin
    insert into auth.users (id, email) values (v_a, 'limits-test-a@example.invalid'), (v_b, 'limits-test-b@example.invalid');

    -- 4 ------------------------------------------------------------ public buckets and keyed hashes only
    set local role anon;
    v_txt := '';
    foreach v_state in array array['api|' || v_net, 'export|' || v_net, 'scan_submit|192.168.0.0', 'sign_in|someone@example.invalid'] loop
      begin
        perform app.take_public_rate(split_part(v_state, '|', 1), split_part(v_state, '|', 2));
        v_txt := v_txt || 'taken ';
      exception when invalid_parameter_value then
        v_txt := v_txt || 'refused ';
      end;
    end loop;
    v_txt := v_txt || app.take_public_rate('sign_in', v_net2);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'the public count takes only the scan''s and sign-in''s buckets, and only a keyed hash',
      'expected', 'refused refused refused refused 0', 'actual', v_txt, 'pass', v_txt = 'refused refused refused refused 0');

    -- 5 ------------------------------------------------------------ the scan: 60 an hour per network
    set local role anon;
    v_n := 0;
    for v_m in 1..60 loop
      if app.take_public_rate('scan_submit', v_net) = 0 then v_n := v_n + 1; end if;
    end loop;
    v_m := app.take_public_rate('scan_submit', v_net);
    v_txt := v_n || ' passed, then ' || case when v_m between 1 and 3600 then 'a wait' else v_m::text end
             || ', other network ' || app.take_public_rate('scan_submit', v_net2);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'the scan: 60 an hour per network pass, the 61st waits; another network is not touched',
      'expected', '60 passed, then a wait, other network 0', 'actual', v_txt, 'pass', v_txt = '60 passed, then a wait, other network 0');

    -- 6 ------------------------------------------------------------ a new window
    update app.rate_window set window_start = now() - interval '61 minutes'
    where bucket = 'scan_submit' and key_hash = sha256(convert_to(v_net, 'UTF8'));
    set local role anon;
    v_n := app.take_public_rate('scan_submit', v_net);
    reset role;
    select hits into v_m from app.rate_window where bucket = 'scan_submit' and key_hash = sha256(convert_to(v_net, 'UTF8'));
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'a window that has ended starts again',
      'expected', 'allowed, 1 hit', 'actual', case when v_n = 0 then 'allowed' else 'waits' end || ', ' || v_m || ' hit',
      'pass', v_n = 0 and v_m = 1);

    -- 7 ------------------------------------------------------------ the API: 120 writes a minute
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    perform set_config('request.path', '/rpc/get_rounds', true);
    v_n := 0;
    v_state := 'none';
    begin
      for v_m in 1..121 loop
        perform app.pre_request();
        v_n := v_n + 1;
      end loop;
    exception when sqlstate 'PT429' then
      get stacked diagnostics v_detail = pg_exception_detail, v_txt = message_text;
      v_state := v_txt;
    end;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'the API: 120 writes a minute per person pass, the 121st answers HTTP 429 with the seconds to wait',
      'expected', '120 passed, rate_limited, a wait', 'actual', v_n || ' passed, ' || v_state || ', ' || case when v_detail ~ '^[0-9]+$' and v_detail::int between 1 and 60 then 'a wait' else coalesce(v_detail, 'none') end,
      'pass', v_n = 120 and v_state = 'rate_limited' and v_detail ~ '^[0-9]+$' and v_detail::int between 1 and 60);

    -- 8 ------------------------------------------------------------ live events: 10 a second
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
    perform set_config('request.path', '/rpc/get_live', true);
    for v_m in 1..15 loop perform app.pre_request(); end loop;
    perform set_config('request.path', '/rpc/save_decision', true);
    v_n := 0;
    v_state := 'none';
    begin
      for v_m in 1..11 loop
        perform app.pre_request();
        v_n := v_n + 1;
      end loop;
    exception when sqlstate 'PT429' then
      v_state := '429';
    end;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'a live meeting''s events: 10 a second pass, the 11th answers 429; other calls do not count as events',
      'expected', '10 passed, 429', 'actual', v_n || ' passed, ' || v_state, 'pass', v_n = 10 and v_state = '429');

    -- 9 ------------------------------------------------------------ anonymous requests
    select count(*) into v_n from app.rate_window where bucket = 'api';
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
    for v_m in 1..200 loop perform app.pre_request(); end loop;
    reset role;
    select count(*) into v_m from app.rate_window where bucket = 'api';
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'an anonymous request is not counted',
      'expected', 'no new counter', 'actual', (v_m - v_n) || ' new counters', 'pass', v_m = v_n);

    -- 11 ----------------------------------------------------------- pruning
    -- a 429 undoes the counts of its own request, so person b's 15 reads of check 8 are the old window here
    perform app.take_rate('api', 'limits-test-current');
    update app.rate_window set window_start = now() - interval '3 hours' where bucket = 'api' and key_hash = sha256(convert_to(v_b::text, 'UTF8'));
    v_n := app.prune_rate_windows();
    v_txt := v_n || ' pruned, '
             || (select count(*) from app.rate_window where bucket = 'api' and key_hash = sha256(convert_to(v_b::text, 'UTF8'))) || ' left for the old, '
             || (select count(*) from app.rate_window where bucket = 'api' and key_hash = sha256(convert_to('limits-test-current', 'UTF8'))) || ' for the current';
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'pruning removes the windows that ended, and keeps the rest',
      'expected', '0 left for the old, 1 for the current', 'actual', v_txt,
      'pass', v_n >= 1 and v_txt like '% pruned, 0 left for the old, 1 for the current');

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.path', '', true);

  -- 10 ------------------------------------------------------------ PostgREST runs it
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    select count(*) into v_n from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
    where r.rolname = 'authenticator' and 'pgrst.db_pre_request=app.pre_request' = any (s.setconfig);
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'PostgREST runs the pre-request, where its role exists',
      'expected', 'set', 'actual', case when v_n = 1 then 'set' else 'not set' end, 'pass', v_n = 1);
  else
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'PostgREST runs the pre-request, where its role exists',
      'expected', 'set, or no PostgREST role here', 'actual', 'no PostgREST role here', 'pass', true);
  end if;

  -- 12 ------------------------------------------------------------ the schedule
  if to_regclass('cron.job') is null then
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'where pg_cron exists, the pruning runs hourly, once',
      'expected', 'scheduled, or no pg_cron here', 'actual', 'no pg_cron here', 'pass', true);
  else
    execute $q$select count(*) from cron.job where jobname = 'leaderpact-prune-rate-windows' and command = 'select app.prune_rate_windows()'$q$ into v_n;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'where pg_cron exists, the pruning runs hourly, once',
      'expected', '1 job', 'actual', v_n || ' job', 'pass', v_n = 1);
  end if;

  -- 13 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'limits-test-%@example.invalid';
  select v_n + count(*) into v_n from app.rate_window
  where key_hash in (sha256(convert_to(v_net, 'UTF8')), sha256(convert_to(v_net2, 'UTF8')), sha256(convert_to(v_a::text, 'UTF8')), sha256(convert_to(v_b::text, 'UTF8')),
                     sha256(convert_to('limits-test-current', 'UTF8')));
  v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_limits
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_limits order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_limits;
  if v_failed is not null then
    raise exception 'limits invariants failed: %', v_failed;
  end if;
  if v_count <> 13 then
    raise exception 'limits invariants: expected 13 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_limits;
