-- What a plain PostgreSQL needs before the migrations apply as they do on Supabase: the client roles,
-- the extensions schema, and Supabase's default grants in public (which 0001 then removes).
-- Used only by scripts/qa/local-pg.sh, for cloud sessions without Docker. CI runs real Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
