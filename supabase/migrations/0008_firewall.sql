-- 0008_firewall.sql — the anonymity firewall: the catalogue's own proof that no role reads an answer and
-- no path a client can take leads from a person to a response set.
--
-- Each rule returns pass and its evidence, and supabase/tests/anonymity_invariants.sql fails on any that
-- does not pass. Written against the catalogue rather than against today's tables, so a table, grant,
-- view, trigger or function added later is checked the moment it exists (handoff 13: "No join of any
-- tables reachable by a client links a person to a response set").
--
-- 1. no_role_reads_answers: no role but a superuser, a table's owner and the platform's own roles holds
--    any privilege on an answer table, on any of its columns, or through a role it belongs to.
--    `service_role` is a role like any other here: staff cannot read answers either (handoff 13).
-- 2. nothing_attached_to_answers: an answer table has no policy and no rewrite rule, and no trigger but
--    its own guard.
-- 3. no_client_path_to_answers: no relation a client can select from has a foreign key to an answer
--    table, and no view or materialised view a client can select from reads one.
-- 4. response_set_columns: a response set has exactly its id, organisation, round or session, and
--    instrument version: no person and no time (CLAUDE.md invariant 2).
-- 5. participation_columns: participation has exactly round, person, organisation and answered: whether,
--    never when.
-- 6. client_functions_reviewed: every function a client may execute that reads an answer table is one of
--    the reviewed readers and writers below. A new one fails here until it is reviewed and listed.
--
-- Pattern origin: Orgpuls 0206_admin_leaves.sql, app.anonymity_firewall() @ 6f5d441 (rules 1 and 2).

create function app.anonymity_firewall() returns table (seq int, rule text, pass boolean, evidence jsonb)
  language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_answer constant text[] := array['response_set', 'response', 'participation', 'factor_score', 'item_score',
                                    'scan_response_set', 'scan_response', 'scan_replace_key', 'scan_theme_score'];
  v_sets constant text[] := array['response_set', 'scan_response_set'];
  v_guards constant text[] := array['forbid_answer_change'];
  -- the platform's own roles, which hold every table by design: no client, key or product path reaches them
  v_platform constant text[] := array['pg_read_all_data', 'pg_write_all_data', 'supabase_read_only_user', 'supabase_etl_admin'];
  -- reviewed: the write paths and the readers that return counts, labels and levels only
  v_reviewed constant text[] := array['submit_scan', 'submit_response', 'get_team_view', 'get_team_view_by_code',
                                      'get_results', 'get_item_results', 'get_participation_count'];
  v_names jsonb;
  v_n bigint;
begin
  -- 1
  select coalesce(jsonb_agg(r.rolname || ' on ' || t.relname order by r.rolname, t.relname), '[]') into v_names
  from pg_roles r cross join pg_class t
  where t.relnamespace = 'app'::regnamespace and t.relname = any (v_answer)
    and not r.rolsuper and r.oid <> t.relowner and not (r.rolname = any (v_platform))
    and (has_table_privilege(r.oid, t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         or has_any_column_privilege(r.oid, t.oid, 'SELECT,INSERT,UPDATE,REFERENCES'));
  select count(*) into v_n from pg_class t where t.relnamespace = 'app'::regnamespace and t.relname = any (v_answer);
  seq := 1; rule := 'no_role_reads_answers';
  pass := jsonb_array_length(v_names) = 0 and v_n = cardinality(v_answer);
  evidence := jsonb_build_object('tables', v_n, 'held', v_names);
  return next;

  -- 2
  with t as (select c.oid, c.relname from pg_class c where c.relnamespace = 'app'::regnamespace and c.relname = any (v_answer))
  select coalesce(jsonb_agg(x.name order by x.name), '[]') into v_names from (
    select t.relname || ' trigger ' || tg.tgname as name
    from t join pg_trigger tg on tg.tgrelid = t.oid and not tg.tgisinternal
    join pg_proc p on p.oid = tg.tgfoid
    where not (p.proname = any (v_guards) and p.pronamespace = 'app'::regnamespace)
    union all
    select t.relname || ' policy ' || po.polname from t join pg_policy po on po.polrelid = t.oid
    union all
    select t.relname || ' rule ' || r.rulename from t join pg_rewrite r on r.ev_class = t.oid) x;
  seq := 2; rule := 'nothing_attached_to_answers'; pass := jsonb_array_length(v_names) = 0;
  evidence := jsonb_build_object('attached', v_names);
  return next;

  -- 3
  with client_rel as (
    select c.oid, n.nspname || '.' || c.relname as name, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname not in ('pg_catalog', 'information_schema') and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'SELECT')
           or has_any_column_privilege('anon', c.oid, 'SELECT') or has_any_column_privilege('authenticated', c.oid, 'SELECT'))),
  answer as (select c.oid from pg_class c where c.relnamespace = 'app'::regnamespace and c.relname = any (v_answer))
  select coalesce(jsonb_agg(x.name order by x.name), '[]') into v_names from (
    select cr.name || ' references ' || con.confrelid::regclass::text as name
    from client_rel cr join pg_constraint con on con.conrelid = cr.oid and con.contype = 'f'
    where con.confrelid in (select oid from answer)
    union all
    select distinct cr.name || ' reads ' || d.refobjid::regclass::text
    from client_rel cr
    join pg_rewrite rw on rw.ev_class = cr.oid
    join pg_depend d on d.classid = 'pg_rewrite'::regclass and d.objid = rw.oid and d.refclassid = 'pg_class'::regclass
    where cr.relkind in ('v', 'm') and d.refobjid in (select oid from answer)) x;
  seq := 3; rule := 'no_client_path_to_answers'; pass := jsonb_array_length(v_names) = 0;
  evidence := jsonb_build_object('paths', v_names);
  return next;

  -- 4
  select coalesce(jsonb_agg(a.attrelid::regclass::text || '.' || a.attname order by 1), '[]') into v_names
  from pg_attribute a join pg_class c on c.oid = a.attrelid
  where c.relnamespace = 'app'::regnamespace and c.relname = any (v_sets) and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('id', 'org_id', 'instrument_version_id',
                          case c.relname when 'response_set' then 'round_id' else 'scan_session_id' end);
  seq := 4; rule := 'response_set_columns'; pass := jsonb_array_length(v_names) = 0;
  evidence := jsonb_build_object('extra', v_names);
  return next;

  -- 5
  select coalesce(jsonb_agg(a.attname order by a.attnum), '[]') into v_names
  from pg_attribute a
  where a.attrelid = 'app.participation'::regclass and a.attnum > 0 and not a.attisdropped;
  seq := 5; rule := 'participation_columns';
  pass := v_names = '["round_id", "person_id", "org_id", "answered"]'::jsonb;
  evidence := jsonb_build_object('columns', v_names);
  return next;

  -- 6
  select coalesce(jsonb_agg(distinct n.nspname || '.' || p.proname), '[]') into v_names
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public') and p.prokind = 'f'
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    and not (p.proname = any (v_reviewed))
    and exists (select 1 from unnest(v_answer) t where p.prosrc ~* ('app\.' || t || '\M'));
  seq := 6; rule := 'client_functions_reviewed'; pass := jsonb_array_length(v_names) = 0;
  evidence := jsonb_build_object('unreviewed', v_names);
  return next;
end $fn$;
comment on function app.anonymity_firewall() is
  'The catalogue''s proof of anonymity (handoff 13). Every row must pass; supabase/tests/anonymity_invariants.sql fails otherwise.';
