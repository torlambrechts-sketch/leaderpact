-- scoring_invariants.sql — the measurement rules of handoff section 7 in SQL give exactly what lib/scoring
-- gives, case for case, and the closing functions store what the rules compute (handoff 13, Scoring).
--
-- lib/scoring/cases.json holds the cases, each expected value computed independently with exact
-- rationals; tests/unit/scoring.test.ts runs the same file through the TypeScript.
--
--    1  the cases' cut-offs are cut-off version 1 in the database
--    2  every level case: mean over persons and items, one decimal, half up
--    3  every item case
--    4  every agreement case: the label (identical answers high; 0.70 medium; 0.50 low)
--    5  every agreement case: the stored index, to four decimals
--    6  every standing case: the order, then the table, at every boundary
--    7  every change case: 0.5 within normal variation, 0.6 shows
--    8  every scan theme case: one person's mean of two items
--    9  a released round stores, for a scale, the level, label, index and standing the rules give
--   10  a released scan stores, for a theme, the level, label and index the rules give
--   11  a scale compares across two versions only when its core items are the same rows (owner C5)
--   12  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Run from the repository root:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/scoring_invariants.sql

\set cases `cat lib/scoring/cases.json`
create temp table _scoring_cases as select :'cases'::jsonb as c;

create unlogged table if not exists public._inv_scoring(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_scoring;

do $$
declare
  v_c jsonb := (select c from _scoring_cases);
  v_rows jsonb := '[]'::jsonb;
  v_cut app.cutoff_set;
  v_e jsonb;
  v_fail text[];
  v_n int;
  v_sums int[];
  v_total bigint;
  v_got text;
  v_case jsonb;
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_people uuid[];
  v_diag_ver uuid;
  v_scan_ver uuid;
  v_round uuid := gen_random_uuid();
  v_scan uuid := gen_random_uuid();
  v_code text := 'scoringTestCode_00000000001';
  v_answers jsonb;
  v_fs app.factor_score;
  v_ts app.scan_theme_score;
  v_draft uuid := gen_random_uuid();
  v_txt text;
begin
  -- 1 ------------------------------------------------------------ the cut-offs
  select * into strict v_cut from app.cutoff_set where version = (v_c -> 'cutoffs' ->> 'version')::int;
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the cases'' cut-offs are cut-off version 1',
    'expected', v_c -> 'cutoffs', 'actual', jsonb_build_object('version', v_cut.version, 'agreementHigh', v_cut.agreement_high,
      'agreementLow', v_cut.agreement_low, 'higherPriorityBelow', v_cut.higher_priority_below, 'higherStrengthFrom', v_cut.higher_strength_from,
      'lowerPriorityFrom', v_cut.lower_priority_from, 'lowerStrengthBelow', v_cut.lower_strength_below, 'changeMargin', v_cut.change_margin),
    'pass', v_cut.version = 1
      and v_cut.agreement_high = (v_c -> 'cutoffs' ->> 'agreementHigh')::numeric and v_cut.agreement_low = (v_c -> 'cutoffs' ->> 'agreementLow')::numeric
      and v_cut.higher_priority_below = (v_c -> 'cutoffs' ->> 'higherPriorityBelow')::numeric
      and v_cut.higher_strength_from = (v_c -> 'cutoffs' ->> 'higherStrengthFrom')::numeric
      and v_cut.lower_priority_from = (v_c -> 'cutoffs' ->> 'lowerPriorityFrom')::numeric
      and v_cut.lower_strength_below = (v_c -> 'cutoffs' ->> 'lowerStrengthBelow')::numeric
      and v_cut.change_margin = (v_c -> 'cutoffs' ->> 'changeMargin')::numeric);

  -- 2 ------------------------------------------------------------ levels
  v_fail := '{}';
  for v_e in select * from jsonb_array_elements(v_c -> 'levels') loop
    select sum(a::int), count(*) into v_total, v_n from jsonb_array_elements(v_e -> 'persons') p, jsonb_array_elements_text(p) a;
    v_got := app.level(v_total, v_n)::text;
    if v_got is distinct from v_e ->> 'level' then v_fail := v_fail || (v_e ->> 'name') || (': ' || v_got); end if;
  end loop;
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'every level case',
    'expected', jsonb_array_length(v_c -> 'levels') || ' agree', 'actual', jsonb_array_length(v_c -> 'levels') - cardinality(v_fail) || ' agree '
      || array_to_string(v_fail, '; '), 'pass', cardinality(v_fail) = 0 and jsonb_array_length(v_c -> 'levels') > 0);

  -- 3 ------------------------------------------------------------ items
  v_fail := '{}';
  for v_e in select * from jsonb_array_elements(v_c -> 'items') loop
    select sum(a::int), count(*) into v_total, v_n from jsonb_array_elements_text(v_e -> 'answers') a;
    v_got := app.level(v_total, v_n)::text;
    if v_got is distinct from v_e ->> 'level' then v_fail := v_fail || (v_e ->> 'name') || (': ' || v_got); end if;
  end loop;
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'every item case',
    'expected', jsonb_array_length(v_c -> 'items') || ' agree', 'actual', jsonb_array_length(v_c -> 'items') - cardinality(v_fail) || ' agree '
      || array_to_string(v_fail, '; '), 'pass', cardinality(v_fail) = 0 and jsonb_array_length(v_c -> 'items') > 0);

  -- 4-5 ----------------------------------------------------------- agreement
  v_fail := '{}';
  v_txt := '';
  for v_e in select * from jsonb_array_elements(v_c -> 'agreement') loop
    select array_agg(s order by o) into v_sums from (
      select o, (select sum(a::int)::int from jsonb_array_elements_text(p) a) as s
      from jsonb_array_elements(v_e -> 'persons') with ordinality x (p, o)) y;
    v_got := app.agreement_label(v_sums, (v_e ->> 'items')::int, v_cut.version);
    if v_got is distinct from v_e ->> 'label' then v_fail := v_fail || (v_e ->> 'name') || (': ' || v_got); end if;
    if app.agreement_value(v_sums, (v_e ->> 'items')::int) is distinct from (v_e ->> 'value')::numeric then
      v_txt := v_txt || (v_e ->> 'name') || ': ' || app.agreement_value(v_sums, (v_e ->> 'items')::int) || '; ';
    end if;
  end loop;
  v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'every agreement case: the label',
    'expected', jsonb_array_length(v_c -> 'agreement') || ' agree', 'actual', jsonb_array_length(v_c -> 'agreement') - cardinality(v_fail) || ' agree '
      || array_to_string(v_fail, '; '), 'pass', cardinality(v_fail) = 0 and jsonb_array_length(v_c -> 'agreement') > 0);
  v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'every agreement case: the stored index, to four decimals',
    'expected', 'all agree', 'actual', coalesce(nullif(v_txt, ''), 'all agree'), 'pass', v_txt = '');

  -- 6 ------------------------------------------------------------ standing
  v_fail := '{}';
  for v_e in select * from jsonb_array_elements(v_c -> 'standing') loop
    v_got := app.standing(v_e ->> 'readingType', (v_e ->> 'level')::numeric, v_e ->> 'agreement', v_cut.version);
    if v_got is distinct from v_e ->> 'standing' then v_fail := v_fail || (v_e ->> 'name') || (': ' || v_got); end if;
  end loop;
  v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'every standing case',
    'expected', jsonb_array_length(v_c -> 'standing') || ' agree', 'actual', jsonb_array_length(v_c -> 'standing') - cardinality(v_fail) || ' agree '
      || array_to_string(v_fail, '; '), 'pass', cardinality(v_fail) = 0 and jsonb_array_length(v_c -> 'standing') > 0);

  -- 7 ------------------------------------------------------------ change
  v_fail := '{}';
  for v_e in select * from jsonb_array_elements(v_c -> 'change') loop
    if app.change_shows((v_e ->> 'from')::numeric, (v_e ->> 'to')::numeric, v_cut.version) is distinct from (v_e ->> 'shows')::boolean
       or ((v_e ->> 'shows')::boolean and ((v_e ->> 'to')::numeric - (v_e ->> 'from')::numeric)::text is distinct from v_e ->> 'delta') then
      v_fail := v_fail || (v_e ->> 'name');
    end if;
  end loop;
  v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'every change case',
    'expected', jsonb_array_length(v_c -> 'change') || ' agree', 'actual', jsonb_array_length(v_c -> 'change') - cardinality(v_fail) || ' agree '
      || array_to_string(v_fail, '; '), 'pass', cardinality(v_fail) = 0 and jsonb_array_length(v_c -> 'change') > 0);

  -- 8 ------------------------------------------------------------ scan themes, one person
  v_fail := '{}';
  for v_e in select * from jsonb_array_elements(v_c -> 'themes') loop
    select sum(a::int), count(*) into v_total, v_n from jsonb_array_elements_text(v_e -> 'items') a;
    v_got := app.level(v_total, v_n)::text;
    if v_got is distinct from v_e ->> 'level' then v_fail := v_fail || (v_e ->> 'name') || (': ' || v_got); end if;
  end loop;
  v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'every scan theme case',
    'expected', jsonb_array_length(v_c -> 'themes') || ' agree', 'actual', jsonb_array_length(v_c -> 'themes') - cardinality(v_fail) || ' agree '
      || array_to_string(v_fail, '; '), 'pass', cardinality(v_fail) = 0 and jsonb_array_length(v_c -> 'themes') > 0);

  begin
    select v.id into strict v_diag_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'diagnostic' and v.status = 'published' order by v.version desc limit 1;
    select v.id into strict v_scan_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'scan' and v.status = 'published' order by v.version desc limit 1;

    -- 9 ---------------------------------------------------------- a released round stores what the rules give
    -- the largest 3-item agreement case a group can be (4 to 15), not a high one, so the standing has a choice
    select e into strict v_case from jsonb_array_elements(v_c -> 'agreement') e
    where (e ->> 'items')::int = 3 and jsonb_array_length(e -> 'persons') between 4 and 15
    order by (e ->> 'label') = 'high', jsonb_array_length(e -> 'persons') desc limit 1;
    v_n := jsonb_array_length(v_case -> 'persons');
    select array_agg(gen_random_uuid()) into v_people from generate_series(1, v_n);
    insert into auth.users (id, email) select u, 'score-test-' || u || '@example.invalid' from unnest(v_people) u;
    insert into app.person (id, display_name) select u, 'Test person' from unnest(v_people) u;
    insert into app.organisation (id, name) values (v_org, 'Scoring test');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Group');
    insert into app.membership (org_id, team_id, person_id, role)
    select v_org, v_team, u, case when o = 1 then 'leader' else 'member' end from unnest(v_people) with ordinality x (u, o);
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org, v_team, 'diagnostic', v_diag_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round);
    for v_n in 1..cardinality(v_people) loop
      -- this person's three answers to clear_purpose (in code order), and 3 to everything else
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value',
               coalesce((v_case -> 'persons' -> (v_n - 1) ->> (cp.o - 1)::int)::int, 3)) order by vi.ordinal)
        into v_answers
      from app.instrument_version_item vi
      join app.item i on i.id = vi.item_id
      left join (select i2.id, row_number() over (order by i2.code) as o from app.item i2
                 join app.factor f2 on f2.id = i2.factor_id and f2.key = 'clear_purpose'
                 join app.instrument_version_item v2 on v2.item_id = i2.id and v2.instrument_version_id = v_diag_ver) cp on cp.id = i.id
      where vi.instrument_version_id = v_diag_ver;
      perform set_config('request.jwt.claims', json_build_object('sub', v_people[v_n], 'role', 'authenticated')::text, true);
      set local role authenticated;
      perform app.submit_response(v_round, v_answers);
      reset role;
    end loop;
    perform set_config('request.jwt.claims', '', true);
    select fs.* into v_fs from app.factor_score fs join app.factor f on f.id = fs.factor_id
    where fs.round_id = v_round and f.key = 'clear_purpose';
    select array_agg(s order by o) into v_sums from (
      select o, (select sum(a::int)::int from jsonb_array_elements_text(p) a) as s
      from jsonb_array_elements(v_case -> 'persons') with ordinality x (p, o)) y;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'a released round stores the level, label, index and standing the rules give',
      'expected', format('n %s, level %s, %s, %s, %s', jsonb_array_length(v_case -> 'persons'), app.level((select sum(s) from unnest(v_sums) s), 3 * cardinality(v_sums)),
                         v_case ->> 'label', v_case ->> 'value',
                         app.standing('higher', app.level((select sum(s) from unnest(v_sums) s), 3 * cardinality(v_sums)), v_case ->> 'label', v_cut.version)),
      'actual', format('n %s, level %s, %s, %s, %s', v_fs.n, v_fs.level, v_fs.agreement_label, v_fs.agreement, v_fs.standing),
      'pass', v_fs.n = jsonb_array_length(v_case -> 'persons')
              and v_fs.level = app.level((select sum(s) from unnest(v_sums) s), 3 * cardinality(v_sums))
              and v_fs.agreement_label = v_case ->> 'label' and v_fs.agreement = (v_case ->> 'value')::numeric
              and v_fs.standing = app.standing('higher', v_fs.level, v_fs.agreement_label, v_cut.version)
              and v_fs.cutoff_version = v_cut.version and v_fs.instrument_version_id = v_diag_ver);

    -- 10 --------------------------------------------------------- a released scan stores what the rules give
    select e into strict v_case from jsonb_array_elements(v_c -> 'agreement') e
    where (e ->> 'items')::int = 2 and jsonb_array_length(e -> 'persons') between 4 and 15
    order by (e ->> 'label') = 'high', jsonb_array_length(e -> 'persons') desc limit 1;
    v_n := jsonb_array_length(v_case -> 'persons');
    insert into app.scan_session (id, org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
    values (v_scan, v_org, v_team, v_scan_ver, v_code, v_n, app.k_threshold(v_org), 7, now() - interval '1 day', now() + interval '6 days');
    set local role anon;
    for v_n in 1..jsonb_array_length(v_case -> 'persons') loop
      -- this person's two answers to the first theme, and 3 to the other ten items
      select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value',
               case when vi.ordinal <= 2 then (v_case -> 'persons' -> (v_n - 1) ->> (vi.ordinal - 1))::int else 3 end) order by vi.ordinal)
        into v_answers
      from app.instrument_version_item vi where vi.instrument_version_id = v_scan_ver;
      perform app.submit_scan(v_code, v_answers);
    end loop;
    reset role;
    select ts.* into v_ts from app.scan_theme_score ts join app.scan_theme t on t.id = ts.theme_id
    where ts.scan_session_id = v_scan and t.ordinal = 1;
    select array_agg(s order by o) into v_sums from (
      select o, (select sum(a::int)::int from jsonb_array_elements_text(p) a) as s
      from jsonb_array_elements(v_case -> 'persons') with ordinality x (p, o)) y;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'a released scan stores the level, label and index the rules give',
      'expected', format('n %s, level %s, %s, %s', jsonb_array_length(v_case -> 'persons'),
                         app.level((select sum(s) from unnest(v_sums) s), 2 * cardinality(v_sums)), v_case ->> 'label', v_case ->> 'value'),
      'actual', format('n %s, level %s, %s, %s', v_ts.n, v_ts.level, v_ts.agreement_label, v_ts.agreement),
      'pass', v_ts.n = jsonb_array_length(v_case -> 'persons')
              and v_ts.level = app.level((select sum(s) from unnest(v_sums) s), 2 * cardinality(v_sums))
              and v_ts.agreement_label = v_case ->> 'label' and v_ts.agreement = (v_case ->> 'value')::numeric);

    -- 11 --------------------------------------------------------- comparable across versions (owner C5)
    -- a draft second version of the diagnostic that rewords one clear_purpose item and keeps the rest
    insert into app.item (code, revision, factor_id, text, use)
    select i.code, i.revision + 1, i.factor_id, jsonb_build_object('en', 'A reworded test item.'), i.use
    from app.item i join app.factor f on f.id = i.factor_id
    where f.key = 'clear_purpose' and i.use = 'core' order by i.code limit 1;
    insert into app.instrument_version (id, instrument_id, version, body_hash)
    select v_draft, v.instrument_id, 99, repeat('0', 64) from app.instrument_version v where v.id = v_diag_ver;
    insert into app.instrument_version_item (instrument_version_id, item_id, ordinal)
    select v_draft, coalesce(nw.id, vi.item_id), vi.ordinal
    from app.instrument_version_item vi join app.item i on i.id = vi.item_id
    left join app.item nw on nw.code = i.code and nw.revision = i.revision + 1
    where vi.instrument_version_id = v_diag_ver;
    v_txt := format('same version %s; reworded scale %s; untouched scale %s; scan against diagnostic %s',
      app.factor_comparable(v_diag_ver, v_diag_ver, (select id from app.factor where key = 'clear_purpose'))::text,
      app.factor_comparable(v_diag_ver, v_draft, (select id from app.factor where key = 'clear_purpose'))::text,
      app.factor_comparable(v_diag_ver, v_draft, (select id from app.factor where key = 'team_tasks'))::text,
      app.factor_comparable(v_scan_ver, v_diag_ver, (select id from app.factor where key = 'clear_purpose'))::text);
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a scale compares across versions only when its core items are the same rows (owner C5)',
      'expected', 'same version true; reworded scale false; untouched scale true; scan against diagnostic false', 'actual', v_txt,
      'pass', v_txt = 'same version true; reworded scale false; untouched scale true; scan against diagnostic false');

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    null;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 12 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from app.organisation where name = 'Scoring test';
  select v_n + count(*) into v_n from auth.users where email like 'score-test-%@example.invalid';
  select v_n + count(*) into v_n from app.instrument_version where version = 99;
  v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_scoring
  select (r->>'seq')::int, r->>'name', r->>'expected', r->>'actual', (r->>'pass')::boolean
  from jsonb_array_elements(v_rows) r;
end $$;

select seq, name, expected, actual, pass from public._inv_scoring order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_scoring;
  if v_failed is not null then
    raise exception 'scoring invariants failed: %', v_failed;
  end if;
  if v_count <> 12 then
    raise exception 'scoring invariants: expected 12 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_scoring;
