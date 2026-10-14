-- model_invariants.sql — the rows of 0004, generated from data/ by scripts/seed/model.mjs (CLAUDE.md, Model
-- as data; handoff 9), and the rules of 0003 that guard them.
--
--    1  24 rows: 21 scales and 3 outcomes, 6 conditions, 11 processes, 4 states and 3 outcomes (Appendix A)
--    2  the evidence rating is null exactly for the 3 outcomes
--    3  96 items at revision 1: 72 core and 24 candidate (Appendix B)
--    4  every scale has 3 core items and 1 candidate
--    5  three instruments, named as handoff 10 names them
--    6  the Full diagnostic v1 is published and asks exactly the 72 core items
--    7  ... in bank order, without a theme
--    8  the Leadership Team Scan v1 is published and asks 12 items in Appendix C order
--    9  ... each with its Appendix C theme, two per theme
--   10  ... each a core item
--   11  no candidate item is in any version
--   12  cut-off version 1 holds the values of handoff 7
--   13  the version in force is 1 (app.cutoff_version())
--   14  the settings of handoff 8, with defaults, units and ranges, the trial's 14 days (owner D2a) and an invitation's 14 days (D-40)
--   15  the threshold row is 4, set by the organisation, within app.k_floor() to app.k_max()
--   16  plans Free and Team, 1 group of up to 15 members each (handoff 1)
--   17  their features
--   18  their prices: Team $1,800 a year or $180 a month, Free none; in force
--   19  as anon: only the 12 scan items are readable, and no candidate
--   20  as anon: only the scan's 12 version rows are readable
--   21  as authenticated: the 72 core items are readable, and no candidate
--   22  as authenticated: the 84 rows of the two published versions are readable
--   23  adding an item to a published version is refused
--   24  changing an item's text is refused
--   25  changing a cut-off is refused
--   26  a published version does not return to draft
--   27  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/model_invariants.sql

create unlogged table if not exists public._inv_model(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_model;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_txt text;
  v_exp text;
  v_n int;
  v_m int;
  v_k int;
  v_r int;
  v_scan uuid;
  v_diag uuid;
begin
  select v.id into v_scan from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'scan' and v.version = 1;
  select v.id into v_diag from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.version = 1;

  -- 1
  select string_agg(l.layer || ' ' || (select count(*) from app.factor f where f.layer = l.layer), ', ' order by l.n)
    into v_txt
  from (values (1, 'conditions'), (2, 'processes'), (3, 'states'), (4, 'outcomes')) as l (n, layer);
  select count(*) into v_n from app.factor;
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', '21 scales and 3 outcomes, split 6, 11, 4 and 3',
    'expected', '24: conditions 6, processes 11, states 4, outcomes 3', 'actual', v_n || ': ' || v_txt,
    'pass', v_n = 24 and v_txt = 'conditions 6, processes 11, states 4, outcomes 3');

  -- 2
  select count(*) filter (where (layer = 'outcomes') <> (evidence is null)), count(*) filter (where evidence is null)
    into v_n, v_m from app.factor;
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'evidence is null exactly for the outcomes',
    'expected', '0 mismatched, 3 null', 'actual', v_n || ' mismatched, ' || v_m || ' null', 'pass', v_n = 0 and v_m = 3);

  -- 3
  select count(*), count(*) filter (where use = 'core'), count(*) filter (where use = 'candidate'), count(*) filter (where revision <> 1)
    into v_n, v_m, v_k, v_r from app.item;
  v_rows := v_rows || jsonb_build_object('seq', 3, 'name', '96 items at revision 1: 72 core, 24 candidate',
    'expected', '96: 72 core, 24 candidate, 0 not revision 1',
    'actual', v_n || ': ' || v_m || ' core, ' || v_k || ' candidate, ' || v_r || ' not revision 1',
    'pass', v_n = 96 and v_m = 72 and v_k = 24 and v_r = 0);

  -- 4
  select coalesce(string_agg(f.key, ', ' order by f.ordinal), '') into v_txt from app.factor f
  where (select count(*) from app.item i where i.factor_id = f.id and i.use = 'core') <> 3
     or (select count(*) from app.item i where i.factor_id = f.id and i.use = 'candidate') <> 1
     or exists (select 1 from app.item i where i.factor_id = f.id and i.code not like f.key || '.%');
  v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'every scale has 3 core items and 1 candidate, coded under its key',
    'expected', '', 'actual', v_txt, 'pass', v_txt = '');

  -- 5
  select string_agg(key || ' ' || (name ->> 'en'), '; ' order by key) into v_txt from app.instrument;
  v_exp := 'diagnostic Full diagnostic; pulse Pulse; scan Leadership Team Scan';
  v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'three instruments, named as handoff 10 names them',
    'expected', v_exp, 'actual', v_txt, 'pass', v_txt = v_exp);

  -- 6
  select count(*) into v_n from app.instrument_version_item vi where vi.instrument_version_id = v_diag;
  select count(*) into v_m from app.item i where i.use = 'core'
    and not exists (select 1 from app.instrument_version_item vi where vi.instrument_version_id = v_diag and vi.item_id = i.id);
  v_txt := (select status from app.instrument_version where id = v_diag);
  v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'the Full diagnostic v1 is published with exactly the 72 core items',
    'expected', 'published, 72 items, 0 core missing', 'actual', coalesce(v_txt, 'missing') || ', ' || v_n || ' items, ' || v_m || ' core missing',
    'pass', v_txt = 'published' and v_n = 72 and v_m = 0);

  -- 7
  select count(*) filter (where vi.ordinal <> (f.ordinal - 1) * 3 + split_part(i.code, '.', 2)::int), count(*) filter (where vi.theme_id is not null)
    into v_n, v_m
  from app.instrument_version_item vi join app.item i on i.id = vi.item_id join app.factor f on f.id = i.factor_id
  where vi.instrument_version_id = v_diag;
  v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'the Full diagnostic asks them in bank order, without a theme',
    'expected', '0 out of order, 0 with a theme', 'actual', v_n || ' out of order, ' || v_m || ' with a theme', 'pass', v_n = 0 and v_m = 0);

  -- 8
  select string_agg(i.code, ',' order by vi.ordinal), count(*) filter (where vi.ordinal not between 1 and 12)
    into v_txt, v_n
  from app.instrument_version_item vi join app.item i on i.id = vi.item_id where vi.instrument_version_id = v_scan;
  v_exp := 'clear_purpose.1,team_tasks.1,meeting_goals.1,focus.1,dialogue.2,dialogue.3,behavioural_integration.1,'
    || 'behavioural_integration.2,psychological_safety.1,trust.1,direction_alignment_and_commitment.1,direction_alignment_and_commitment.3';
  v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'the Leadership Team Scan v1 is published with 12 items in Appendix C order',
    'expected', 'published: ' || v_exp,
    'actual', coalesce((select status from app.instrument_version where id = v_scan), 'missing') || ': ' || coalesce(v_txt, ''),
    'pass', (select status from app.instrument_version where id = v_scan) = 'published' and v_txt = v_exp and v_n = 0);

  -- 9
  select string_agg(coalesce(t.key, 'none'), ',' order by vi.ordinal) into v_txt
  from app.instrument_version_item vi left join app.scan_theme t on t.id = vi.theme_id where vi.instrument_version_id = v_scan;
  v_exp := 'purpose_and_priorities,purpose_and_priorities,meetings,meetings,dialogue_and_conflict,dialogue_and_conflict,'
    || 'working_as_one_team,working_as_one_team,safety_and_trust,safety_and_trust,results,results';
  v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'each scan item has its Appendix C theme, two per theme',
    'expected', v_exp, 'actual', coalesce(v_txt, ''), 'pass', v_txt = v_exp);

  -- 10
  select count(*) filter (where i.use <> 'core') into v_n
  from app.instrument_version_item vi join app.item i on i.id = vi.item_id where vi.instrument_version_id = v_scan;
  v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'each scan item is a core item',
    'expected', '0 not core', 'actual', v_n || ' not core', 'pass', v_n = 0);

  -- 11
  select count(*) into v_n from app.instrument_version_item vi join app.item i on i.id = vi.item_id where i.use = 'candidate';
  v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'no candidate item is in any version',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  -- 12
  select concat_ws(',', agreement_high, agreement_low, higher_priority_below, higher_strength_from, lower_priority_from,
                   lower_strength_below, change_margin)
    into v_txt from app.cutoff_set where version = 1;
  v_exp := '0.70,0.50,3.0,3.4,3.5,2.8,0.6';
  v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'cut-off v1: agreement 0.70 and 0.50; standing 3.0, 3.4, 3.5, 2.8; change 0.6',
    'expected', v_exp, 'actual', coalesce(v_txt, 'missing'), 'pass', v_txt = v_exp);

  -- 13
  v_txt := coalesce(app.cutoff_version()::text, 'none');
  v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'the cut-off version in force is 1',
    'expected', '1', 'actual', v_txt, 'pass', v_txt = '1');

  -- 14
  select string_agg(format('%s %s=%s %s %s%s', scope, key, default_value, unit, coalesce(min_value || '..' || max_value, '-'),
                           case when fixed then ' fixed' else '' end), '; ' order by key)
    into v_txt from app.setting;
  v_exp := 'platform active_focus_areas=2 count - fixed; organisation anonymity_threshold=4 count 4..8; '
    || 'group diagnostic_rhythm_months=6 months 3..12; group diagnostic_window_days=14 days 7..30; '
    || 'platform extension_days=7 days - fixed; platform invitation_days=14 days - fixed; platform members_per_group=15 count - fixed; '
    || 'group pulse_rhythm_weeks=4 weeks 2..8; group pulse_window_days=7 days 3..14; '
    || 'group reminder_days=[3, 7, 12] days 1..30; organisation retention_after_cancel_days=90 days 30..365; '
    || 'group scan_window_days=7 days 2..14; platform trial_days=14 days - fixed';
  v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'the settings of handoff 8, the trial and the invitation, with defaults, units and ranges',
    'expected', v_exp, 'actual', coalesce(v_txt, ''), 'pass', v_txt = v_exp);

  -- 15
  select format('%s, default %s, %s to %s', scope, default_value, min_value, max_value) into v_txt
  from app.setting where key = 'anonymity_threshold';
  v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'the threshold row: 4, by the organisation, from k_floor() to k_max()',
    'expected', format('organisation, default 4, %s to %s', app.k_floor(), app.k_max()), 'actual', coalesce(v_txt, 'missing'),
    'pass', v_txt = format('organisation, default 4, %s to %s', app.k_floor(), app.k_max()) and app.k_floor() = 4 and app.k_max() = 8);

  -- 16
  select string_agg(format('%s %s, %s group, %s members', key, name ->> 'en', max_groups, max_members), '; ' order by ordinal)
    into v_txt from app.plan where active;
  v_exp := 'free Free, 1 group, 15 members; team Team, 1 group, 15 members';
  v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'plans Free and Team: 1 group of up to 15 members',
    'expected', v_exp, 'actual', coalesce(v_txt, ''), 'pass', v_txt = v_exp);

  -- 17
  select string_agg(p.key || ': ' || (select string_agg(pf.feature, ',' order by pf.feature) from app.plan_feature pf where pf.plan_key = p.key),
                    '; ' order by p.ordinal)
    into v_txt from app.plan p;
  v_exp := 'free: leader_profile,scan,team_view; team: charter,diagnostic,focus_areas,leader_profile,meetings,pulse,scan,scan_history,team_view';
  v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'their features',
    'expected', v_exp, 'actual', coalesce(v_txt, ''), 'pass', v_txt = v_exp);

  -- 18
  select string_agg(format('%s %s %s %s v%s', plan_key, interval, currency, amount_minor, version), '; ' order by plan_key, interval),
         count(*) filter (where valid_from > now())
    into v_txt, v_n from app.plan_price;
  v_exp := 'team month USD 18000 v1; team year USD 180000 v1';
  v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'Team: $1,800 a year or $180 a month; Free: no price row; all in force',
    'expected', v_exp || ', 0 not yet in force', 'actual', coalesce(v_txt, '') || ', ' || v_n || ' not yet in force',
    'pass', v_txt = v_exp and v_n = 0);

  -- 19 and 20: a visitor without an account
  begin
    set local role anon;
    select count(*), count(*) filter (where use = 'candidate'), count(*) filter (where not app.is_scan_item(id))
      into v_n, v_m, v_k from app.item;
    select count(*) into v_txt from app.instrument_version_item;
    reset role;
  exception when others then
    reset role;
    v_n := -1; v_txt := sqlerrm;
  end;
  v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'as anon: only the 12 scan items are readable, and no candidate',
    'expected', '12 readable, 0 candidate, 0 outside the scan',
    'actual', v_n || ' readable, ' || v_m || ' candidate, ' || v_k || ' outside the scan',
    'pass', v_n = 12 and v_m = 0 and v_k = 0);
  v_rows := v_rows || jsonb_build_object('seq', 20, 'name', 'as anon: only the scan''s 12 version rows are readable',
    'expected', '12', 'actual', v_txt, 'pass', v_txt = '12');

  -- 21 and 22: a signed-in person
  begin
    set local role authenticated;
    select count(*), count(*) filter (where use = 'candidate') into v_n, v_m from app.item;
    select count(*) into v_txt from app.instrument_version_item;
    reset role;
  exception when others then
    reset role;
    v_n := -1; v_txt := sqlerrm;
  end;
  v_rows := v_rows || jsonb_build_object('seq', 21, 'name', 'as authenticated: the 72 core items are readable, and no candidate',
    'expected', '72 readable, 0 candidate', 'actual', v_n || ' readable, ' || v_m || ' candidate', 'pass', v_n = 72 and v_m = 0);
  v_rows := v_rows || jsonb_build_object('seq', 22, 'name', 'as authenticated: the 84 rows of the two published versions are readable',
    'expected', '84', 'actual', v_txt, 'pass', v_txt = '84');

  -- 23 to 26: probes, each in its own subtransaction, rolled back whether refused or not
  begin
    insert into app.instrument_version_item (instrument_version_id, item_id, ordinal)
    values (v_diag, (select id from app.item where code = 'clear_purpose.4' and revision = 1), 73);
    v_txt := 'ACCEPTED';
    raise exception 'rollback' using errcode = 'P0001';
  exception
    when check_violation then v_txt := 'check_violation';
    when sqlstate 'P0001' then null;
  end;
  v_rows := v_rows || jsonb_build_object('seq', 23, 'name', 'adding an item to a published version is refused',
    'expected', 'check_violation', 'actual', v_txt, 'pass', v_txt = 'check_violation');

  begin
    update app.item set text = '{"en": "We agree on what this team is for."}' where code = 'clear_purpose.1' and revision = 1;
    v_txt := 'ACCEPTED';
    raise exception 'rollback' using errcode = 'P0001';
  exception
    when check_violation then v_txt := 'check_violation';
    when sqlstate 'P0001' then null;
  end;
  v_rows := v_rows || jsonb_build_object('seq', 24, 'name', 'changing an item''s text is refused: a reword is a new revision',
    'expected', 'check_violation', 'actual', v_txt, 'pass', v_txt = 'check_violation');

  begin
    update app.cutoff_set set change_margin = 0.5 where version = 1;
    v_txt := 'ACCEPTED';
    raise exception 'rollback' using errcode = 'P0001';
  exception
    when check_violation then v_txt := 'check_violation';
    when sqlstate 'P0001' then null;
  end;
  v_rows := v_rows || jsonb_build_object('seq', 25, 'name', 'changing a cut-off is refused: the pilot adds a version',
    'expected', 'check_violation', 'actual', v_txt, 'pass', v_txt = 'check_violation');

  begin
    update app.instrument_version set status = 'draft' where id = v_scan;
    v_txt := 'ACCEPTED';
    raise exception 'rollback' using errcode = 'P0001';
  exception
    when check_violation then v_txt := 'check_violation';
    when sqlstate 'P0001' then null;
  end;
  v_rows := v_rows || jsonb_build_object('seq', 26, 'name', 'a published version does not return to draft',
    'expected', 'check_violation', 'actual', v_txt, 'pass', v_txt = 'check_violation');

  -- 27
  select format('%s items, %s version rows, margin %s, %s, %s', (select count(*) from app.item),
                (select count(*) from app.instrument_version_item),
                (select change_margin from app.cutoff_set where version = 1),
                (select text ->> 'en' from app.item where code = 'clear_purpose.1' and revision = 1),
                (select string_agg(status, ',' order by id) from app.instrument_version where id in (v_scan, v_diag)))
    into v_txt;
  v_exp := 'published,published';
  v_rows := v_rows || jsonb_build_object('seq', 27, 'name', 'nothing written by this suite survives',
    'expected', '96 items, 84 version rows, margin 0.6, We agree on what this leadership team is for., ' || v_exp,
    'actual', v_txt,
    'pass', v_txt = '96 items, 84 version rows, margin 0.6, We agree on what this leadership team is for., ' || v_exp);

  insert into public._inv_model
  select (r ->> 'seq')::int, r ->> 'name', r ->> 'expected', r ->> 'actual', (r ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r;
end $$;

select seq, name, expected, actual, pass from public._inv_model order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_model;
  if v_failed is not null then
    raise exception 'model invariants failed: %', v_failed;
  end if;
  if v_count <> 27 then
    raise exception 'model invariants: expected 27 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_model;
