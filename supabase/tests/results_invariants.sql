-- results_invariants.sql — the results in three depths (0007 readers, 0016; handoff 6.12 and 7; milestone 11:
-- "Every row shows level, agreement label and one standing. No forbidden element appears").
--
--      1  every scale and outcome has a definition; anyone may read them, no role may write them
--      2  a definition never changes: a new wording is a new version
--      3  the readers return exactly what a result may show: no spread, no agreement number, no band, no person
--      4  while the round is open, and for an outsider, the readers return nothing
--      5  a released round: every scale has one level to one decimal, an agreement label and one standing
--      6  each scale's questions have a mean to one decimal, three per scale, and nothing else
--      7  a person whose membership has ended reads nothing of the results
--      8  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/results_invariants.sql

create unlogged table if not exists public._inv_results(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_results;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_people uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_out uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_round uuid := gen_random_uuid();
  v_ver uuid;
  v_txt text;
  v_n int;
  v_m int;
  v_ok boolean;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';

  -- 1 -------------------------------------------------------------- definitions
  select count(*) into v_n from app.factor f
  where exists (select 1 from app.factor_text x where x.factor_id = f.id and x.version = 1 and length(btrim(x.definition ->> 'en')) > 0);
  select count(*) into v_m
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, 'app.factor_text', p.priv);
  v_ok := has_table_privilege('anon', 'app.factor_text', 'select') and has_table_privilege('authenticated', 'app.factor_text', 'select')
          and (select relrowsecurity from pg_class where oid = 'app.factor_text'::regclass);
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'every scale and outcome has a definition; anyone reads them, no role writes them',
    'expected', '24 defined, 0 write privileges, read and RLS on', 'actual', v_n || ' defined, ' || v_m || ' write privileges, ' || case when v_ok then 'read and RLS on' else 'not so' end,
    'pass', v_n = 24 and v_n = (select count(*) from app.factor) and v_m = 0 and v_ok);

  -- 2 -------------------------------------------------------------- a definition never changes
  begin
    update app.factor_text set definition = '{"en": "Something else."}' where version = 1 and factor_id = (select id from app.factor where key = 'trust');
    v_txt := 'changed';
  exception when check_violation then
    v_txt := 'refused';
  end;
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'a definition never changes: a new wording is a new version',
    'expected', 'refused', 'actual', v_txt, 'pass', v_txt = 'refused');

  -- 3 -------------------------------------------------------------- what the readers return, from the catalogue
  select string_agg(a, ',' order by o) into v_txt
  from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as x (a, m, o)
  where p.oid = 'app.get_results(uuid)'::regprocedure and m = 't';
  v_ok := v_txt = 'factor_key,factor_name,layer,reading_type,evidence,ordinal,level,agreement,standing,n';
  select string_agg(a, ',' order by o) into v_txt
  from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as x (a, m, o)
  where p.oid = 'app.get_item_results(uuid)'::regprocedure and m = 't';
  v_ok := v_ok and v_txt = 'item_code,item_text,factor_key,level,n';
  -- and the agreement it returns is the label column, text, never the stored number
  v_ok := v_ok and (select format_type(t, null) from pg_proc p, unnest(p.proallargtypes, p.proargnames) as x (t, a)
                    where p.oid = 'app.get_results(uuid)'::regprocedure and a = 'agreement') = 'text';
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'the readers return exactly what a result may show: no spread, number, band or person',
    'expected', 'as reviewed', 'actual', case when v_ok then 'as reviewed' else 'not as reviewed' end, 'pass', v_ok);

  begin
    insert into auth.users (id, email) select p, 'results-test-' || i || '@example.invalid' from unnest(v_people) with ordinality as x (p, i);
    insert into auth.users (id, email) values (v_out, 'results-test-out@example.invalid');
    insert into app.person (id, display_name) select p, 'Results person ' || i from unnest(v_people) with ordinality as x (p, i);
    insert into app.person (id, display_name) values (v_out, 'Results outsider');
    insert into app.organisation (id, name) values (v_org, 'Results test organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Results test group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from)
    select v_org, v_team, p, case when i = 1 then 'leader' else 'member' end, now() - interval '30 days' from unnest(v_people) with ordinality as x (p, i);
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org, v_team, 'diagnostic', v_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round);

    -- four of five answer, each in their own subtransaction
    for v_n in 1..4 loop
      perform set_config('request.jwt.claims', format(claims, v_people[v_n]), true);
      set local role authenticated;
      perform app.submit_response(v_round, (
        select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 1 + (vi.ordinal + v_n) % 5) order by vi.ordinal)
        from app.instrument_version_item vi where vi.instrument_version_id = v_ver));
      reset role;
    end loop;

    -- 4 ------------------------------------------------------------ nothing before close, nothing for an outsider
    perform set_config('request.jwt.claims', format(claims, v_people[1]), true);
    set local role authenticated;
    select (select count(*) from app.get_results(v_round)) + (select count(*) from app.get_item_results(v_round)) into v_n;
    perform set_config('request.jwt.claims', format(claims, v_out), true);
    reset role;
    alter table app.assessment_round disable trigger assessment_round_fixed;
    update app.assessment_round set closes_at = now() - interval '1 second' where id = v_round;
    alter table app.assessment_round enable trigger assessment_round_fixed;
    v_txt := app.close_round(v_round);
    set local role authenticated;
    select (select count(*) from app.get_results(v_round)) + (select count(*) from app.get_item_results(v_round)) into v_m;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'while the round is open, and for an outsider after it, the readers return nothing',
      'expected', '0 open, released, 0 outsider', 'actual', v_n || ' open, ' || v_txt || ', ' || v_m || ' outsider',
      'pass', v_n = 0 and v_txt = 'released' and v_m = 0);

    -- 5 ------------------------------------------------------------ the overview
    perform set_config('request.jwt.claims', format(claims, v_people[5]), true);
    set local role authenticated;
    select concat_ws(',', count(*), count(*) filter (where r.level = round(r.level, 1) and r.level between 1 and 5),
                     count(*) filter (where r.agreement in ('high', 'medium', 'low')),
                     count(*) filter (where r.standing in ('priority', 'watch', 'strength', 'views_differ', 'fact', 'read_with')),
                     min(r.n), max(r.n), count(distinct r.layer))
      into v_txt from app.get_results(v_round) r;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'every scale: one level to one decimal, an agreement label, one standing, at n = 4',
      'expected', '24,24,24,24,4,4,4', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '24,24,24,24,4,4,4');

    -- 6 ------------------------------------------------------------ the questions
    set local role authenticated;
    select concat_ws(',', count(*), count(*) filter (where r.level = round(r.level, 1)), count(distinct r.factor_key),
                     (select max(c) from (select count(*) c from app.get_item_results(v_round) g group by g.factor_key) x),
                     (select min(c) from (select count(*) c from app.get_item_results(v_round) g group by g.factor_key) x))
      into v_txt from app.get_item_results(v_round) r;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'each scale''s questions: a mean to one decimal, three per scale',
      'expected', '72,72,24,3,3', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '72,72,24,3,3');

    -- 7 ------------------------------------------------------------ an ended membership
    update app.membership set valid_to = now() where team_id = v_team and person_id = v_people[5];
    set local role authenticated;
    select (select count(*) from app.get_results(v_round)) + (select count(*) from app.get_item_results(v_round)) into v_n;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a person whose membership has ended reads nothing of the results',
      'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 8 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'results-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Results test organisation';
  v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_results
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_results order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_results;
  if v_failed is not null then
    raise exception 'results invariants failed: %', v_failed;
  end if;
  if v_count <> 8 then
    raise exception 'results invariants: expected 8 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_results;
