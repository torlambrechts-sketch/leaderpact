-- foundation_invariants.sql — the ground rules of 0001 (CLAUDE.md, security invariants).
--
--   1  app.k_floor() returns 4
--   2  app.k_floor() is immutable, has no overload, and no table column shadows it
--   3  app.k_max() returns 8
--   4  every table in app and public has row-level security
--   5  every SECURITY DEFINER function in app and public pins its search_path
--   6  a new function, in app or in public, is executable by no client role until a migration grants it
--   7  a new table in app is readable by no client role until a migration grants it
--   8  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/foundation_invariants.sql

create unlogged table if not exists public._inv_foundation(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_foundation;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_text text;
  v_n int;
  v_fn_anon bool;
  v_fn_auth bool;
  v_pub_anon bool;
  v_pub_auth bool;
  v_tb_anon bool;
  v_tb_auth bool;
begin
  -- 1
  v_text := app.k_floor()::text;
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'k_floor() is 4', 'expected', '4', 'actual', v_text, 'pass', v_text = '4');

  -- 2
  select count(*) filter (where p.provolatile = 'i'), count(*) into v_n, v_text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app' and p.proname = 'k_floor';
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'k_floor() is one immutable function',
    'expected', '1 of 1', 'actual', v_n || ' of ' || v_text, 'pass', v_n = 1 and v_text = '1');

  -- 3
  v_text := app.k_max()::text;
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'k_max() is 8', 'expected', '8', 'actual', v_text, 'pass', v_text = '8');

  -- 4
  select coalesce(string_agg(n.nspname || '.' || c.relname, ', '), '') into v_text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and n.nspname in ('app', 'public') and not c.relrowsecurity and c.relname not like '\_%';
  v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'every table has row-level security',
    'expected', '', 'actual', v_text, 'pass', v_text = '');

  -- 5
  select coalesce(string_agg(n.nspname || '.' || p.proname, ', '), '') into v_text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef and n.nspname in ('app', 'public')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'every definer function pins its search_path',
    'expected', '', 'actual', v_text, 'pass', v_text = '');

  -- 6 and 7: probes created and dropped inside this block's own subtransaction
  begin
    execute 'create function app._probe_fn() returns int language sql set search_path = '''' as $f$ select 1 $f$';
    execute 'create function public._probe_fn() returns int language sql set search_path = '''' as $f$ select 1 $f$';
    execute 'create table app._probe_tb(id int primary key)';
    v_fn_anon := has_function_privilege('anon', 'app._probe_fn()', 'execute');
    v_fn_auth := has_function_privilege('authenticated', 'app._probe_fn()', 'execute');
    v_pub_anon := has_function_privilege('anon', 'public._probe_fn()', 'execute');
    v_pub_auth := has_function_privilege('authenticated', 'public._probe_fn()', 'execute');
    v_tb_anon := has_table_privilege('anon', 'app._probe_tb', 'select');
    v_tb_auth := has_table_privilege('authenticated', 'app._probe_tb', 'select');
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    null;
  end;
  v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'a new function is executable by no client role',
    'expected', 'app: anon f, authenticated f; public: anon f, authenticated f',
    'actual', format('app: anon %s, authenticated %s; public: anon %s, authenticated %s', v_fn_anon, v_fn_auth, v_pub_anon, v_pub_auth),
    'pass', not v_fn_anon and not v_fn_auth and not v_pub_anon and not v_pub_auth);
  v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a new app table is readable by no client role',
    'expected', 'anon f, authenticated f', 'actual', format('anon %s, authenticated %s', v_tb_anon, v_tb_auth),
    'pass', not v_tb_anon and not v_tb_auth);

  -- 8
  select count(*) into v_n from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'app' and c.relname = '_probe_tb';
  select v_n + count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public') and p.proname = '_probe_fn';
  v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'every probe was rolled back',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_foundation
  select (r->>'seq')::int, r->>'name', r->>'expected', r->>'actual', (r->>'pass')::boolean
  from jsonb_array_elements(v_rows) r;
end $$;

select seq, name, expected, actual, pass from public._inv_foundation order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_foundation;
  if v_failed is not null then
    raise exception 'foundation invariants failed: %', v_failed;
  end if;
  if v_count <> 8 then
    raise exception 'foundation invariants: expected 8 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_foundation;
