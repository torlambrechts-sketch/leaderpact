-- hardening_invariants.sql — section 13's database checks, proven from the catalogue rather than table by table
-- (handoff 13; milestone 18: "The checks of section 13 pass"; D-56).
--
--      1  a staff role holds no privilege on any table of the app schema
--      2  a staff role runs no reader: the only functions it may call that touch answers, scores or profiles are
--         the reviewed jobs, and none returns rows
--      3  every client function keyed by a group, round, meeting or scan is found, and its readers answer a member
--      4  a member of group A gets nothing of group B from any of them: null, false, or a refusal
--      5  a person whose membership has ended gets nothing from any of them
--      6  neither sees a row of the group in any table a client may select; a current member sees each
--      7  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hardening_invariants.sql

create unlogged table if not exists public._inv_hardening(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_hardening;
-- what each call answered, written while the role is a client's
create unlogged table if not exists public._inv_hardening_calls(who text, fn text, answer text, nothing bool);
truncate public._inv_hardening_calls;
grant insert on public._inv_hardening_calls to authenticated;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_mem uuid := gen_random_uuid();
  v_former uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();
  v_team_b uuid := gen_random_uuid();
  v_scan uuid := gen_random_uuid();
  v_round uuid := gen_random_uuid();
  v_ver uuid;
  v_scan_ver uuid;
  v_quick uuid;
  v_meeting uuid;
  v_key uuid;
  v_sql text;
  v_answer text;
  v_txt text;
  v_n int;
  v_m int;
  v_ok boolean;
  r record;
  w record;
  -- the answer and profile tables, and the jobs reviewed to touch them for the service role: they mail, remind,
  -- open and close, and return a status, a count or the mail to send, never an answer or a score
  v_private constant text[] := array['response_set', 'response', 'participation', 'factor_score', 'item_score',
                                     'scan_response_set', 'scan_response', 'scan_replace_key', 'scan_theme_score',
                                     'agreement_response', 'agreement_score', 'personality_profile', 'profile_share'];
  v_jobs constant text[] := array['claim_mail', 'claim_reminders', 'close_round', 'close_scan', 'open_round'];
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- no table for the staff role
  select coalesce(string_agg(c.relname, ',' order by c.relname), 'none') into v_txt
  from pg_class c where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
    and (has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         or has_any_column_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'));
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'a staff role holds no privilege on any table of the app schema',
    'expected', 'none', 'actual', v_txt, 'pass', v_txt = 'none');

  -- 2 -------------------------------------------------------------- no reader for the staff role
  select coalesce(string_agg(p.proname || case when p.proretset then ' (rows)' else '' end, ',' order by p.proname), 'none') into v_txt
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public') and p.prokind = 'f' and has_function_privilege('service_role', p.oid, 'EXECUTE')
    and exists (select 1 from unnest(v_private) t where p.prosrc ~* ('app\.' || t || '\M'))
    and (not (p.proname = any (v_jobs)) or p.proretset);
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'a staff role runs no reader: the only functions it may call that touch answers, scores or profiles are the reviewed jobs, and none returns rows',
    'expected', 'none', 'actual', v_txt, 'pass', v_txt = 'none');

  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';
  select v.id into strict v_scan_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'scan' and v.status = 'published';
  select t.id into strict v_quick from app.profile_test t where t.key = 'quick';

  begin
    insert into auth.users (id, email) values
      (v_lead, 'hardening-test-lead@example.invalid'), (v_mem, 'hardening-test-member@example.invalid'),
      (v_former, 'hardening-test-former@example.invalid'), (v_outsider, 'hardening-test-outsider@example.invalid');
    insert into app.person (id, display_name) values
      (v_lead, 'Hardening lead'), (v_mem, 'Hardening member'), (v_former, 'Hardening former'), (v_outsider, 'Hardening outsider');
    insert into app.organisation (id, name) values (v_org, 'Hardening test organisation'), (v_org_b, 'Hardening other organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Hardening test group'), (v_team_b, v_org_b, 'Hardening other group');
    -- the outsider leads a group of their own; the former member left yesterday
    insert into app.membership (org_id, team_id, person_id, role, valid_from, valid_to) values
      (v_org, v_team, v_lead, 'leader', now() - interval '30 days', null),
      (v_org, v_team, v_mem, 'member', now() - interval '30 days', null),
      (v_org, v_team, v_former, 'member', now() - interval '30 days', now() - interval '1 day'),
      (v_org_b, v_team_b, v_outsider, 'leader', now() - interval '30 days', null);
    insert into app.subscription (team_id, org_id, plan_key, interval, currency, amount_minor, price_version, method, state,
                                  started_at, current_period_end, company_name, country, provider)
    values (v_team, v_org, 'team', 'year', 'USD', 180000, 1, 'card', 'active', now() - interval '30 days', now() + interval '335 days',
            'Hardening AS', 'NO', 'development');
    insert into app.scan_session (id, org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
    values (v_scan, v_org, v_team, v_scan_ver, 'hardening-test-code-' || substr(md5(v_scan::text), 1, 12), 4, 4, 7,
            now() - interval '1 day', now() + interval '6 days');
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org, v_team, 'diagnostic', v_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round);
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_meeting := (app.plan_meeting(v_team, 'Hardening meeting', current_date + 3, '09:00', 60) ->> 'meeting')::uuid;
    -- the member shares a quick Leader Profile with the group
    perform set_config('request.jwt.claims', format(claims, v_mem), true);
    perform app.save_profile('quick', (select jsonb_object_agg(i.id::text, 3) from app.profile_item i where i.test_id = v_quick));
    perform app.set_profile_share(v_team, 'domains');
    reset role;

    -- every client function whose first argument is the group, a round, a meeting or a scan, called with that key
    -- and nulls for the rest, by each person in turn; a refusal is a null, a false, {"ok": false}, or an error
    for w in select * from (values ('member', v_mem), ('outsider', v_outsider), ('former', v_former)) x(who, id) loop
      for r in
        select p.proname, p.pronargs, p.proretset, p.proargnames[1] as key, pg_get_function_identity_arguments(p.oid) as args
        from pg_proc p
        where p.pronamespace = 'app'::regnamespace and p.prokind = 'f' and p.pronargs >= 1
          and p.proargtypes[0] = 'uuid'::regtype and p.proargnames[1] in ('p_team', 'p_round', 'p_meeting', 'p_scan')
          and (has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE'))
        order by p.proname
      loop
        v_key := case r.key when 'p_team' then v_team when 'p_round' then v_round when 'p_meeting' then v_meeting else v_scan end;
        v_sql := case when r.proretset
                      then format('select string_agg(x::text, ''|'') from app.%I(%L::uuid%s) x', r.proname, v_key, repeat(', null', r.pronargs - 1))
                      else format('select app.%I(%L::uuid%s)::text', r.proname, v_key, repeat(', null', r.pronargs - 1)) end;
        begin
          set local role authenticated;
          perform set_config('request.jwt.claims', format(claims, w.id), true);
          execute v_sql into v_answer;
          insert into public._inv_hardening_calls values (w.who, r.proname || '(' || r.args || ')', v_answer,
            coalesce(v_answer is null or v_answer = 'false' or (v_answer ~ '^\{' and v_answer::jsonb ->> 'ok' = 'false'), false));
          reset role;
        exception when others then
          reset role;
          insert into public._inv_hardening_calls values (w.who, r.proname || '(' || r.args || ')', 'error ' || sqlstate, true);
        end;
      end loop;
    end loop;

    -- 3 ------------------------------------------------------------ the catalogue, and its control
    select count(*) into v_n from public._inv_hardening_calls where who = 'member';
    select count(*) into v_m from public._inv_hardening_calls where who = 'member' and fn ~ '^get_' and not nothing;
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'every client function keyed by a group, round, meeting or scan is found, and its readers answer a member',
      'expected', 'at least 50 functions; at least 12 readers answer', 'actual', v_n || ' functions; ' || v_m || ' readers answer',
      'pass', v_n >= 50 and v_m >= 12);

    -- 4 ------------------------------------------------------------ another group's member
    select coalesce(string_agg(fn || ' = ' || left(answer, 60), '; ' order by fn), 'none') into v_txt
    from public._inv_hardening_calls where who = 'outsider' and not nothing;
    select count(*) into v_n from public._inv_hardening_calls where who = 'outsider';
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'a member of group A gets nothing of group B from any of them: null, false, or a refusal',
      'expected', 'none answered', 'actual', case when v_txt = 'none' then 'none answered' else v_txt end || ' (' || v_n || ' called)',
      'pass', v_txt = 'none' and v_n >= 50);

    -- 5 ------------------------------------------------------------ a former member
    select coalesce(string_agg(fn || ' = ' || left(answer, 60), '; ' order by fn), 'none') into v_txt
    from public._inv_hardening_calls where who = 'former' and not nothing;
    select count(*) into v_n from public._inv_hardening_calls where who = 'former';
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'a person whose membership has ended gets nothing from any of them',
      'expected', 'none answered', 'actual', case when v_txt = 'none' then 'none answered' else v_txt end || ' (' || v_n || ' called)',
      'pass', v_txt = 'none' and v_n >= 50);

    -- 6 ------------------------------------------------------------ every table a client may select
    -- a table's rows of this group: by its own id (organisation, team), by its group or organisation, or, for a
    -- person, the group's people
    v_txt := '';
    v_ok := true;
    for r in
      select c.relname,
             exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'team_id' and not a.attisdropped) as by_team,
             exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'org_id' and not a.attisdropped) as by_org
      from pg_class c
      where c.relnamespace = 'app'::regnamespace and c.relkind in ('r', 'p', 'v') and has_table_privilege('authenticated', c.oid, 'SELECT')
      order by c.relname
    loop
      v_sql := case
        when r.relname = 'organisation' then format('select count(*) from app.organisation where id = %L', v_org)
        when r.relname = 'team' then format('select count(*) from app.team where id = %L', v_team)
        when r.relname = 'person' then format('select count(*) from app.person where id in (%L, %L)', v_lead, v_mem)
        when r.relname = 'personality_profile' then format('select count(*) from app.personality_profile where person_id = %L', v_mem)
        when r.by_team then format('select count(*) from app.%I where team_id = %L', r.relname, v_team)
        when r.by_org then format('select count(*) from app.%I where org_id = %L', r.relname, v_org)
      end;
      continue when v_sql is null;
      for w in select * from (values ('member', v_mem), ('outsider', v_outsider), ('former', v_former)) x(who, id) loop
        set local role authenticated;
        perform set_config('request.jwt.claims', format(claims, w.id), true);
        execute v_sql into v_n;
        reset role;
        -- a member sees each of the group's tables that holds a row of it; the others see none
        if w.who <> 'member' and v_n > 0 then
          v_ok := false;
          v_txt := v_txt || w.who || ' sees ' || r.relname || '; ';
        end if;
        -- (the billing details are the leader's alone, 0013, so the member's control leaves out the subscription)
        if w.who = 'member' and v_n = 0 and r.relname in ('organisation', 'team', 'person', 'membership', 'assessment_round',
                                                          'profile_share', 'personality_profile') then
          v_ok := false;
          v_txt := v_txt || 'the member does not see ' || r.relname || '; ';
        end if;
      end loop;
    end loop;
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'neither sees a row of the group in any table a client may select; a current member sees each',
      'expected', 'as expected', 'actual', case when v_ok then 'as expected' else v_txt end, 'pass', v_ok);

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 7 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'hardening-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name like 'Hardening % organisation';
  v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_hardening
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_hardening order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_hardening;
  if v_failed is not null then
    raise exception 'hardening invariants failed: %', v_failed;
  end if;
  if v_count <> 7 then
    raise exception 'hardening invariants: expected 7 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_hardening;
drop table public._inv_hardening_calls;
