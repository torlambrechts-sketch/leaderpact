-- 0001_foundation.sql — the private schema, deny-by-default grants, and the anonymity threshold's bounds.
--
-- LeaderPact's first migration. The rest of the schema is milestone 2; this file sets the ground rules
-- every later table and function inherits (CLAUDE.md, security invariants).
--
-- 1. **Schema `app`** holds every table. PostgREST exposes it (supabase/config.toml), so clients reach
--    tables only through row-level security, and results only through SECURITY DEFINER functions.
--    `usage` is granted; no table privilege is. A table created in `app` starts with no grant to any
--    client role, so a table nobody granted is a table nobody reads.
-- 2. **No function is executable by a client until a migration grants it.** PostgreSQL grants EXECUTE
--    to PUBLIC on every new function, and Supabase adds its own default in `public`: every new function
--    executable by `anon` and `authenticated`. Both defaults are removed for what this project's
--    migrations create (they run as `postgres`). A per-schema default can only add to the global one,
--    never remove it, so the PUBLIC default is removed globally. Every public entry point is then a
--    deliberate `grant`, reviewed one by one (.claude/skills/audit/allowlist.json, check S4).
-- 3. **The threshold's bounds are functions, not columns** (handoff A.2, Orgpuls 0150): no row can lower
--    them. LeaderPact's threshold is 4 and may be raised to 8, never lowered (owner, C10).
--    `app.k_floor()` is 4 and `app.k_max()` is 8; the organisation's setting, the round's frozen k and
--    every reader are bounded by them (milestone 2).
--
-- Pattern origin: Orgpuls 0001_foundation.sql and 0150_k_floor_three.sql @ 6f5d441.

-- ---------------------------------------------------------------- 1 · the private schema
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------- 2 · nothing executable by default
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
-- tables and sequences in app have no default grant to a client role; nothing here adds one

-- ---------------------------------------------------------------- 3 · the threshold's bounds
create function app.k_floor() returns int
  language sql immutable parallel safe
  set search_path = ''
as $$ select 4 $$;

comment on function app.k_floor() is
  'The anonymity threshold''s floor: 4. A function, not a column, so no row can lower it (handoff A.2, owner C10).';

create function app.k_max() returns int
  language sql immutable parallel safe
  set search_path = ''
as $$ select 8 $$;

comment on function app.k_max() is
  'The highest anonymity threshold an organisation may choose: 8 (handoff section 8).';

-- readable by the client roles: the bounds are not secret, and a screen shows "4 to 8"
grant execute on function app.k_floor(), app.k_max() to anon, authenticated, service_role;
