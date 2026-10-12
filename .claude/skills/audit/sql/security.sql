-- /audit: the database's security posture, from the catalogue. Every row returned is a finding.
-- psql "$DB" -X -A -F ' | ' -f .claude/skills/audit/sql/security.sql
--
-- Origin: Orgpuls .claude/skills/audit/sql/security.sql @ 6f5d441. Adapted: LeaderPact's answer
-- tables (handoff section 8), k = 4 and 8, service_role in S2, an exact column list in S7, and to_regclass
-- guards, so a check on a table that milestone 2 has not created yet reports nothing instead of stopping.

-- S1 a table in app or public without row-level security
select 'S1 no RLS' as check, n.nspname || '.' || c.relname as object, '' as detail
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('app', 'public') and not c.relrowsecurity and c.relname not like '\_%'
union all
-- S2 an answer table, or a table that says who answered, with any policy or any grant to a client role
--    (CLAUDE.md invariants 1 and 2). service_role is included: staff cannot read answers either.
select 'S2 answer table readable', 'app.' || t,
       coalesce((select string_agg(policyname, ',') from pg_policies p where p.schemaname = 'app' and p.tablename = t), '')
       || case when has_table_privilege('authenticated', 'app.' || t, 'select') then ' +authenticated' else '' end
       || case when has_table_privilege('anon', 'app.' || t, 'select') then ' +anon' else '' end
       || case when has_table_privilege('service_role', 'app.' || t, 'select') then ' +service_role' else '' end
from unnest(array['response_set', 'response', 'scan_response_set', 'scan_response', 'scan_replace_key', 'participation', 'factor_score',
                   'item_score', 'scan_theme_score']) t
where to_regclass('app.' || t) is not null
  and (exists (select 1 from pg_policies p where p.schemaname = 'app' and p.tablename = t)
       or has_table_privilege('authenticated', 'app.' || t, 'select')
       or has_table_privilege('anon', 'app.' || t, 'select')
       or has_table_privilege('service_role', 'app.' || t, 'select'))
union all
-- S3 a SECURITY DEFINER function without a fixed search_path
select 'S3 definer without search_path', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ''
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prosecdef and n.nspname in ('app', 'public')
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
union all
-- S4 a function anon may execute: each must be a deliberate public entry point (review the list)
select 'S4 anon executes', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', case when p.prosecdef then 'definer' else 'invoker' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'app') and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not like 'pg\_%' and p.prokind = 'f'
union all
-- S5 a table a client role may write directly (writes belong in functions here)
select 'S5 client writes table', n.nspname || '.' || c.relname,
       concat_ws(',', case when has_table_privilege(r, c.oid, 'insert') then 'insert' end,
                      case when has_table_privilege(r, c.oid, 'update') then 'update' end,
                      case when has_table_privilege(r, c.oid, 'delete') then 'delete' end) || ' as ' || r
from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join unnest(array['anon', 'authenticated']) r
where c.relkind = 'r' and n.nspname = 'app'
  and (has_table_privilege(r, c.oid, 'insert') or has_table_privilege(r, c.oid, 'update') or has_table_privilege(r, c.oid, 'delete'))
union all
-- S6 the threshold's bounds are still functions returning 4 and 8 (owner C10). 0001 creates both, so a
--    database without them fails here with "function does not exist", which is the right failure.
select 'S6 k floor', 'app.k_floor()', app.k_floor()::text where app.k_floor() <> 4
union all
select 'S6 k max', 'app.k_max()', app.k_max()::text where app.k_max() <> 8
union all
-- S7 a response set carries a column that could link a person or a time (CLAUDE.md invariant 2, owner C3).
--    An exact list of the columns allowed, rather than a list of names forbidden.
select 'S7 response set column', a.attrelid::regclass::text || '.' || a.attname, format_type(a.atttypid, a.atttypmod)
from pg_attribute a
where a.attrelid in (select oid from pg_class where oid in (to_regclass('app.response_set'), to_regclass('app.scan_response_set')))
  and a.attnum > 0 and not a.attisdropped
  and a.attname not in ('id', 'org_id', 'round_id', 'scan_session_id', 'instrument_version_id')
order by 1, 2;
