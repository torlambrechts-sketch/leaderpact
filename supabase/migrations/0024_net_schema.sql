-- 0024_net_schema.sql — pg_net in the extensions schema (Supabase's security advisor, "extension in public";
-- D-53).
--
-- 0022 created pg_net with no schema, so the extension was recorded in `public`. Its functions live in `net`
-- either way, and the dispatcher's job calls `net.http_post`; only the extension's own schema moves. pg_net
-- cannot be relocated, so where it sits in `public` it is created again in `extensions`. Its queue holds
-- requests and responses for minutes at most, and the job sends nothing until Vault holds its secret (0022).
-- Where pg_net is elsewhere or absent (a local stack), nothing changes.
do $$
begin
  if exists (select 1 from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'pg_net' and n.nspname = 'public') then
    drop extension pg_net;
    create schema if not exists extensions;
    create extension pg_net with schema extensions;
  end if;
end $$;
