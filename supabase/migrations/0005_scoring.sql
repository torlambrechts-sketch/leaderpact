-- 0005_scoring.sql — the measurement rules of handoff section 7, in SQL: level, agreement, standing,
-- change, and whether two versions can be compared on a scale.
--
-- The same rules are pure functions in lib/scoring (the personal view runs them on the device), and one
-- set of cases, lib/scoring/cases.json, is run through both: supabase/tests/scoring_invariants.sql and
-- tests/unit/scoring.test.ts. Every decision is made in exact arithmetic, so the two cannot disagree at a
-- boundary:
--
-- * **Level.** A person's scale score is the mean of the scale's items; the level is the mean over
--   respondents, which is the sum of every answer over (items × n). Shown to one decimal, half up.
-- * **Agreement.** With s_i a person's sum over the scale's items, the sample variance of the person
--   scores is num / den, num = n·Σs² − (Σs)², den = items² · n · (n − 1). The index is
--   max(0, 1 − variance / 2.0), 2.0 being the variance of a flat five-point distribution (handoff 7,
--   proposed). High above the high cut-off, low at or below the low cut-off; decided as
--   num < 2·(1 − high)·den and num ≥ 2·(1 − low)·den, products of exact numerics. The index itself is kept
--   in the snapshot and never shown.
-- * **Standing** is read off the level as shown, in the order of handoff 7: descriptive, task conflict,
--   low agreement, then the table.
-- * **Change** shows between two shown levels when it is at least the margin (0.6).
-- * **Comparable** (owner C5): a scale compares across two versions of one instrument only when both list
--   the same core item rows for it.
--
-- One function per rule, so a confirmed formula changes one body (handoff 14: "The agreement formula is
-- proposed. One function, easy to change.").

-- ---------------------------------------------------------------- level
create function app.level(p_total bigint, p_count bigint) returns numeric
  language sql immutable strict parallel safe set search_path = ''
as $$ select round(p_total::numeric / p_count, 1) $$;
comment on function app.level(bigint, bigint) is 'A mean to one decimal, half up: the shown level (handoff 7, Level).';

-- ---------------------------------------------------------------- agreement
create function app.agreement_value(p_sums int[], p_items int) returns numeric
  language plpgsql immutable strict parallel safe set search_path = ''
as $$
declare
  v_n bigint := cardinality(p_sums);
  v_s1 numeric;
  v_s2 numeric;
begin
  if v_n < 2 then
    raise exception 'agreement needs at least two respondents' using errcode = 'invalid_parameter_value';
  end if;
  select sum(x), sum(x * x) into v_s1, v_s2 from unnest(p_sums) x;
  return round(greatest(0, 1 - (v_n * v_s2 - v_s1 * v_s1) / (2 * p_items * p_items * v_n * (v_n - 1))), 4);
end $$;
comment on function app.agreement_value(int[], int) is
  'The within-group agreement index, stored in the snapshot and never shown (handoff 7: label only).';

create function app.agreement_label(p_sums int[], p_items int, p_cutoff_version int) returns text
  language plpgsql stable strict set search_path = ''
as $$
declare
  v_n bigint := cardinality(p_sums);
  v_s1 numeric;
  v_s2 numeric;
  v_num numeric;
  v_den numeric;
  v_cut app.cutoff_set;
begin
  if v_n < 2 then
    raise exception 'agreement needs at least two respondents' using errcode = 'invalid_parameter_value';
  end if;
  select * into strict v_cut from app.cutoff_set c where c.version = p_cutoff_version;
  select sum(x), sum(x * x) into v_s1, v_s2 from unnest(p_sums) x;
  v_num := v_n * v_s2 - v_s1 * v_s1;
  v_den := p_items * p_items * v_n * (v_n - 1);
  if v_num < 2 * (1 - v_cut.agreement_high) * v_den then return 'high'; end if;
  if v_num >= 2 * (1 - v_cut.agreement_low) * v_den then return 'low'; end if;
  return 'medium';
end $$;
comment on function app.agreement_label(int[], int, int) is
  'High above the high cut-off, low at or below the low one, medium between (handoff 7, Agreement).';

-- ---------------------------------------------------------------- standing
create function app.standing(p_reading text, p_level numeric, p_agreement text, p_cutoff_version int) returns text
  language plpgsql stable strict set search_path = ''
as $$
declare
  v_cut app.cutoff_set;
begin
  select * into strict v_cut from app.cutoff_set c where c.version = p_cutoff_version;
  if p_reading = 'descriptive' then return 'fact'; end if;
  if p_reading = 'conditional' then return 'read_with'; end if;
  if p_agreement = 'low' then return 'views_differ'; end if;
  if p_reading = 'higher' then
    if p_level < v_cut.higher_priority_below then return 'priority'; end if;
    if p_level >= v_cut.higher_strength_from then return 'strength'; end if;
    return 'watch';
  end if;
  if p_reading = 'lower' then
    if p_level >= v_cut.lower_priority_from then return 'priority'; end if;
    if p_level < v_cut.lower_strength_below then return 'strength'; end if;
    return 'watch';
  end if;
  raise exception 'unknown reading type %', p_reading using errcode = 'invalid_parameter_value';
end $$;
comment on function app.standing(text, numeric, text, int) is
  'One standing per scale, in the order of handoff 7: fact, read_with, views_differ, then the table.';

-- ---------------------------------------------------------------- change
create function app.change_shows(p_from numeric, p_to numeric, p_cutoff_version int) returns boolean
  language sql stable strict set search_path = ''
as $$
  select abs(p_to - p_from) >= c.change_margin from app.cutoff_set c where c.version = p_cutoff_version
$$;
comment on function app.change_shows(numeric, numeric, int) is
  'Whether a change between two shown levels shows; a smaller one reads "within normal variation" (handoff 7).';

-- ---------------------------------------------------------------- comparable across versions (owner C5)
create function app.factor_comparable(p_version_a uuid, p_version_b uuid, p_factor uuid) returns boolean
  language sql stable strict set search_path = ''
as $$
  with a as (
    select vi.item_id from app.instrument_version_item vi join app.item i on i.id = vi.item_id
    where vi.instrument_version_id = p_version_a and i.factor_id = p_factor and i.use = 'core'),
  b as (
    select vi.item_id from app.instrument_version_item vi join app.item i on i.id = vi.item_id
    where vi.instrument_version_id = p_version_b and i.factor_id = p_factor and i.use = 'core')
  select (select v.instrument_id from app.instrument_version v where v.id = p_version_a)
           = (select v.instrument_id from app.instrument_version v where v.id = p_version_b)
     and exists (select 1 from a)
     and not exists ((select item_id from a) except (select item_id from b))
     and not exists ((select item_id from b) except (select item_id from a))
$$;
comment on function app.factor_comparable(uuid, uuid, uuid) is
  'True when two versions of one instrument ask a scale with the same core item rows (owner C5).';

-- no grant: the snapshot carries every level, label and standing a screen shows, and the readers compute
-- change; a client has no use for these on data of its own
