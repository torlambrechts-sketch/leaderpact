-- 0003_model.sql — the model as data: scales, instruments and their versions, items, scan themes,
-- cut-offs, settings and plans. The rows themselves are 0004, generated from data/ (CLAUDE.md, Model as
-- data; REUSE 4.10).
--
-- 1. **A scale is a `factor`** (handoff 8 names the table; every screen says "scale"). Its layer, reading
--    type and evidence rating are columns, so a rule that depends on them reads the row.
-- 2. **Item wording is versioned.** An item row never changes: a reworded item is a new row (same code,
--    next revision). An instrument version lists its items; once published, the list never changes. A
--    stored answer points at the item row it answered, so a closed round always says what it asked, and
--    two versions are comparable on a scale exactly when they list the same core item rows (owner C5).
-- 3. **Cut-offs are versioned rows** (owner C6). A result stores the version it was made with, and a row
--    never changes: the pilot adds a version instead.
-- 4. **Settings are rows with a default and a range** (handoff 8, Configuration). A row may display
--    "4 to 8"; it is never the source of the threshold's floor, which is a function (0001).
-- 5. **Plans and prices are rows** (handoff 1: test prices, held as data), in minor units.
-- 6. **Readable as reference data,** with two limits: candidate items are shown to nobody outside a
--    pilot (handoff 9), and a visitor without an account reads only the scan's items.
--
-- Immutability rules are written as "nobody may change this content", so a cascade from a deleted parent
-- still passes (CLAUDE.md, Immutability triggers).

-- ---------------------------------------------------------------- scales
create table app.factor (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z_]*[a-z]$'),
  name jsonb not null check (jsonb_typeof(name) = 'object' and name ? 'en'),
  layer text not null check (layer in ('conditions', 'processes', 'states', 'outcomes')),
  -- higher or lower is better; descriptive (no target); conditional (task conflict, read with relationship conflict)
  reading_type text not null check (reading_type in ('higher', 'lower', 'descriptive', 'conditional')),
  -- outcomes carry no evidence rating: they are what the scales explain (handoff, Appendix A)
  evidence text check (evidence in ('strong', 'moderate', 'mixed', 'not_rated')),
  ordinal int not null unique check (ordinal > 0),
  check ((layer = 'outcomes') = (evidence is null))
);
comment on table app.factor is '21 scales and 3 outcomes (handoff Appendix A). "Scale" on every screen.';

-- ---------------------------------------------------------------- instruments and versions
create table app.instrument (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('scan', 'diagnostic', 'pulse')),
  name jsonb not null check (jsonb_typeof(name) = 'object' and name ? 'en')
);

create table app.instrument_version (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references app.instrument (id) on delete cascade,
  version int not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  -- SHA-256 of the canonical JSON the version was generated from (scripts/seed/model.mjs)
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  unique (instrument_id, version)
);

-- ---------------------------------------------------------------- items
create table app.item (
  id uuid primary key default gen_random_uuid(),
  -- stable across rewordings: <scale key>.<n>, e.g. clear_purpose.1
  code text not null check (code ~ '^[a-z][a-z_]*\.[1-9][0-9]*$'),
  revision int not null default 1 check (revision > 0),
  factor_id uuid not null references app.factor (id),
  text jsonb not null check (jsonb_typeof(text) = 'object' and text ? 'en'),
  -- core: one of the diagnostic's 72; candidate: stored, shown only to pilot groups (handoff 9)
  use text not null check (use in ('core', 'candidate')),
  unique (code, revision)
);
create index item_factor_idx on app.item (factor_id);

-- ---------------------------------------------------------------- scan themes
create table app.scan_theme (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z_]*[a-z]$'),
  name jsonb not null check (jsonb_typeof(name) = 'object' and name ? 'en'),
  ordinal int not null unique check (ordinal > 0)
);
comment on table app.scan_theme is 'The six themes of the Leadership Team Scan, two items each (handoff Appendix C).';

-- ---------------------------------------------------------------- what a version asks, in which order
create table app.instrument_version_item (
  instrument_version_id uuid not null references app.instrument_version (id) on delete cascade,
  item_id uuid not null references app.item (id),
  ordinal int not null check (ordinal > 0),
  -- the scan theme an item belongs to, in a scan version only
  theme_id uuid references app.scan_theme (id),
  primary key (instrument_version_id, item_id),
  unique (instrument_version_id, ordinal)
);
create index instrument_version_item_item_idx on app.instrument_version_item (item_id);

-- ---------------------------------------------------------------- cut-offs, versioned (owner C6)
create table app.cutoff_set (
  version int primary key check (version > 0),
  -- agreement label: high above, low at or below (handoff 7, Agreement)
  agreement_high numeric(3, 2) not null,
  agreement_low numeric(3, 2) not null,
  -- standing on the shown level (handoff 7, Standing)
  higher_priority_below numeric(2, 1) not null,
  higher_strength_from numeric(2, 1) not null,
  lower_priority_from numeric(2, 1) not null,
  lower_strength_below numeric(2, 1) not null,
  -- the smallest change shown between two closed rounds (handoff 7, Change)
  change_margin numeric(2, 1) not null,
  valid_from timestamptz not null default now(),
  check (0 < agreement_low and agreement_low < agreement_high and agreement_high < 1),
  check (1 < higher_priority_below and higher_priority_below < higher_strength_from and higher_strength_from < 5),
  check (1 < lower_strength_below and lower_strength_below < lower_priority_from and lower_priority_from < 5),
  check (0 < change_margin and change_margin < 4)
);
comment on table app.cutoff_set is
  'Agreement, standing and change cut-offs, one row per version. A result stores the version it was made with; a row never changes.';

-- the version in force: the newest that has started
create function app.cutoff_version() returns int
  language sql stable security definer set search_path = ''
as $$ select max(c.version) from app.cutoff_set c where c.valid_from <= now() $$;

-- ---------------------------------------------------------------- settings (handoff 8, Configuration)
create table app.setting (
  key text primary key check (key ~ '^[a-z][a-z_]*[a-z]$'),
  scope text not null check (scope in ('platform', 'organisation', 'group')),
  -- a number, or for reminder days a list of numbers
  default_value jsonb not null check (jsonb_typeof(default_value) in ('number', 'array')),
  min_value numeric,
  max_value numeric,
  -- fixed: no organisation or group may change it (until pilot data exists, where the handoff says so)
  fixed boolean not null default false,
  unit text not null check (unit in ('count', 'days', 'weeks', 'months', 'points')),
  check (min_value is null or max_value is null or min_value <= max_value)
);
comment on table app.setting is
  'Defaults and ranges. Display only for the threshold: its floor is app.k_floor(), never a row (owner C10).';

-- ---------------------------------------------------------------- plans (handoff 1, Plans)
create table app.plan (
  key text primary key check (key ~ '^[a-z][a-z_]*$'),
  name jsonb not null check (jsonb_typeof(name) = 'object' and name ? 'en'),
  active boolean not null default true,
  -- groups per subscription; members per group (handoff 1)
  max_groups int check (max_groups > 0),
  max_members int not null check (max_members between 4 and 15),
  ordinal int not null unique
);

create table app.plan_feature (
  plan_key text not null references app.plan (key) on delete cascade,
  feature text not null check (feature in (
    'scan', 'team_view', 'leader_profile', 'scan_history', 'charter', 'diagnostic', 'pulse', 'meetings', 'focus_areas')),
  primary key (plan_key, feature)
);

create table app.plan_price (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null references app.plan (key) on delete cascade,
  interval text not null check (interval in ('month', 'year')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- minor units: 180000 is $1,800.00
  amount_minor bigint not null check (amount_minor >= 0),
  version int not null check (version > 0),
  valid_from timestamptz not null default now(),
  unique (plan_key, interval, currency, version)
);
comment on table app.plan_price is 'Test prices (handoff 1), versioned. Pricing is per group, never per seat.';

-- ---------------------------------------------------------------- nobody may change this content
create function app.forbid_item_change() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.code, old.revision, old.factor_id, old.text, old.use) is distinct from (new.code, new.revision, new.factor_id, new.text, new.use) then
    raise exception 'an item never changes: add a revision instead' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger item_content_fixed before update on app.item for each row execute function app.forbid_item_change();

create function app.forbid_cutoff_change() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  raise exception 'a cut-off version never changes: add a version instead' using errcode = 'check_violation';
end $$;
create trigger cutoff_set_fixed before update on app.cutoff_set for each row execute function app.forbid_cutoff_change();

-- a version moves draft -> published -> retired, and its hash never changes
create function app.instrument_version_forward() returns trigger
  language plpgsql set search_path = ''
as $$
declare
  v_rank constant jsonb := '{"draft": 0, "published": 1, "retired": 2}';
begin
  if (old.instrument_id, old.version, old.body_hash) is distinct from (new.instrument_id, new.version, new.body_hash) then
    raise exception 'an instrument version never changes its content' using errcode = 'check_violation';
  end if;
  if (v_rank ->> new.status)::int < (v_rank ->> old.status)::int then
    raise exception 'an instrument version moves only forward (% to %)', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger instrument_version_forward before update on app.instrument_version
  for each row execute function app.instrument_version_forward();

-- a published version's item list is fixed; a delete passes only when the version itself is gone
create function app.version_items_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
declare
  v_status text;
begin
  select v.status into v_status from app.instrument_version v
  where v.id = case when tg_op = 'INSERT' then new.instrument_version_id else old.instrument_version_id end;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;  -- the parent is gone: a cascade
  end if;
  if v_status <> 'draft' then
    raise exception 'the items of a published instrument version never change' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger instrument_version_item_fixed before insert or update or delete on app.instrument_version_item
  for each row execute function app.version_items_fixed();

-- ---------------------------------------------------------------- read as reference data
alter table app.factor enable row level security;
alter table app.instrument enable row level security;
alter table app.instrument_version enable row level security;
alter table app.item enable row level security;
alter table app.scan_theme enable row level security;
alter table app.instrument_version_item enable row level security;
alter table app.cutoff_set enable row level security;
alter table app.setting enable row level security;
alter table app.plan enable row level security;
alter table app.plan_feature enable row level security;
alter table app.plan_price enable row level security;

create policy factor_read on app.factor for select to anon, authenticated using (true);
create policy instrument_read on app.instrument for select to anon, authenticated using (true);
create policy instrument_version_read on app.instrument_version for select to anon, authenticated using (status <> 'draft');
create policy scan_theme_read on app.scan_theme for select to anon, authenticated using (true);
create policy cutoff_set_read on app.cutoff_set for select to anon, authenticated using (true);
create policy setting_read on app.setting for select to anon, authenticated using (true);
create policy plan_read on app.plan for select to anon, authenticated using (true);
create policy plan_feature_read on app.plan_feature for select to anon, authenticated using (true);
create policy plan_price_read on app.plan_price for select to anon, authenticated using (true);

-- whether an item is asked by a published version of the scan: what a visitor without an account may read
create function app.is_scan_item(p_item uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app.instrument_version_item vi
    join app.instrument_version v on v.id = vi.instrument_version_id
    join app.instrument i on i.id = v.instrument_id
    where vi.item_id = p_item and i.key = 'scan' and v.status <> 'draft')
$$;
grant execute on function app.is_scan_item(uuid) to anon, authenticated;

-- candidate items: no client reads them (pilot groups get a definer reader in milestone 10, owner D8)
create policy item_read_member on app.item for select to authenticated using (use = 'core');
create policy item_read_visitor on app.item for select to anon using (use = 'core' and app.is_scan_item(id));
create policy instrument_version_item_read_member on app.instrument_version_item for select to authenticated
  using (exists (select 1 from app.instrument_version v where v.id = instrument_version_id and v.status <> 'draft'));
create policy instrument_version_item_read_visitor on app.instrument_version_item for select to anon
  using (exists (select 1 from app.instrument_version v join app.instrument i on i.id = v.instrument_id
                 where v.id = instrument_version_id and v.status <> 'draft' and i.key = 'scan'));

grant select on app.factor, app.instrument, app.instrument_version, app.item, app.scan_theme, app.instrument_version_item,
  app.cutoff_set, app.setting, app.plan, app.plan_feature, app.plan_price to anon, authenticated;
grant execute on function app.cutoff_version() to anon, authenticated;
