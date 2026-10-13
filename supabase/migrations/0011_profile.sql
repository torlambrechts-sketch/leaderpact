-- 0011_profile.sql — the Leader Profile: its two tests as rows, the person's profile, sharing with a group,
-- retake and delete (handoff 6.17, 8 and 9; milestone 7; CLAUDE.md invariant 11).
--
-- 1. **Two tests, as versioned rows.** The quick test is the Mini-IPIP (20 items, five domains), the full
--    test the IPIP-NEO-120 (120 items, five domains and 30 facets), both public domain and both from the
--    sources handoff section 9 names (data/profile/, rows in 0012). An item scores one trait: a facet in
--    the full test, a domain in the quick one. Nothing about a published test changes.
-- 2. **A profile is the owner's alone.** One per person: the latest test taken. It holds, per trait, the
--    sum of the keyed answers and their count, never an answer: the answers pass through `save_profile`
--    and are not stored. Only its owner can select it (RLS); no other role is granted anything on it,
--    `service_role` included (REUSE: the profile, Sentral cannot read it).
-- 3. **Bands are read from the sum, with the band set the profile was made with** (`profile_band`):
--    below the lower limit is lower, above the higher limit is higher, the rest middle. Version 1 is
--    equal thirds of the answer scale (D-31). In integers of hundredths, so 56 of 24 items is exactly
--    middle. No norm group is used until the norm table exists (handoff 9).
-- 4. **A group sees a profile only through a share, at the level shared** (`get_group_profiles`): the
--    domains' bands, or the domains' and the facets' bands. Never a sum, a count or an answer. A profile
--    that is not shared and a person with no profile read the same: "nothing". The share is per group,
--    readable by its owner, and set only by `set_profile_share`.
-- 5. **A retake resets sharing to nothing** (handoff 6.17), in the same transaction as the new profile.
--    **Delete removes the profile at once** with its shares (within the 30 days handoff 8 allows).
--    Both are audited with ids only (handoff 8, CLAUDE.md invariant 10).
-- 6. **It shares nothing with the scan.** No table here refers to a scan, a response or a link code.
--
-- Pattern origin: the model triggers of 0003 (nobody may change published content; a cascade passes).

-- ---------------------------------------------------------------- the tests
create table app.profile_test (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key in ('quick', 'full')),
  version int not null check (version > 0),
  name text not null check (length(btrim(name)) between 1 and 60),
  citation text not null check (length(btrim(citation)) between 1 and 400),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  unique (key, version)
);
create unique index profile_test_published_uidx on app.profile_test (key) where status = 'published';
comment on table app.profile_test is 'The Leader Profile''s tests (handoff 6.17): quick (Mini-IPIP) and full (IPIP-NEO-120), versioned.';

create table app.profile_trait (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references app.profile_test (id) on delete cascade,
  key text not null check (key ~ '^[A-Z][1-6]?$'),
  kind text not null check (kind in ('domain', 'facet')),
  -- a domain's own key; a facet's parent domain
  domain text not null check (domain ~ '^[A-Z]$'),
  name jsonb not null check (jsonb_typeof(name -> 'en') = 'string'),
  ordinal int not null check (ordinal > 0),
  unique (test_id, key),
  check ((kind = 'domain') = (key = domain))
);
comment on table app.profile_trait is 'A test''s domains and facets, with their names in versioned rows.';

create table app.profile_item (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references app.profile_test (id) on delete cascade,
  ordinal int not null check (ordinal > 0),
  text jsonb not null check (jsonb_typeof(text -> 'en') = 'string'),
  -- the trait it scores: a facet in the full test, a domain in the quick one
  trait text not null,
  -- +1 or -1: a minus-keyed answer counts as 6 minus the answer (the published keys, handoff 7)
  keyed smallint not null check (keyed in (1, -1)),
  unique (test_id, ordinal),
  foreign key (test_id, trait) references app.profile_trait (test_id, key)
);
comment on table app.profile_item is 'A test''s items, wording and key as published (handoff 9). Never changed once published.';

create table app.profile_band_set (
  version int primary key check (version > 0),
  lower_below numeric(3, 2) not null,
  higher_above numeric(3, 2) not null,
  valid_from timestamptz not null,
  check (1 < lower_below and lower_below < higher_above and higher_above < 5)
);
comment on table app.profile_band_set is 'Where lower, middle and higher divide the answer scale (D-31). Versioned; a profile keeps its version.';

-- ---------------------------------------------------------------- nobody may change published content
create function app.profile_test_forward() returns trigger
  language plpgsql set search_path = ''
as $$
declare
  v_rank constant jsonb := '{"draft": 0, "published": 1, "retired": 2}';
begin
  if (old.key, old.version, old.name, old.citation, old.body_hash) is distinct from (new.key, new.version, new.name, new.citation, new.body_hash) then
    raise exception 'a profile test never changes its content' using errcode = 'check_violation';
  end if;
  if (v_rank ->> new.status)::int < (v_rank ->> old.status)::int then
    raise exception 'a profile test moves only forward (% to %)', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger profile_test_forward before update on app.profile_test for each row execute function app.profile_test_forward();

-- a published test's traits and items are fixed; a removal passes only when the test itself is gone
create function app.profile_content_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
declare
  v_status text;
begin
  select t.status into v_status from app.profile_test t
  where t.id = case when tg_op = 'INSERT' then new.test_id else old.test_id end;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;  -- the parent is gone: a cascade
  end if;
  if v_status <> 'draft' then
    raise exception 'the content of a published profile test never changes' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger profile_trait_fixed before insert or update or delete on app.profile_trait
  for each row execute function app.profile_content_fixed();
create trigger profile_item_fixed before insert or update or delete on app.profile_item
  for each row execute function app.profile_content_fixed();

create function app.forbid_band_change() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  raise exception 'a band set never changes: add a version instead' using errcode = 'check_violation';
end $$;
create trigger profile_band_set_fixed before update on app.profile_band_set for each row execute function app.forbid_band_change();

-- ---------------------------------------------------------------- the profile and its shares
create table app.personality_profile (
  person_id uuid primary key references app.person (id) on delete cascade,
  test_id uuid not null references app.profile_test (id),
  band_set int not null references app.profile_band_set (version),
  taken_at timestamptz not null default now(),
  -- per trait the sum of its keyed answers and their count, {"O": {"sum": 86, "n": 24}, …}: never an answer
  scores jsonb not null check (jsonb_typeof(scores) = 'object')
);
comment on table app.personality_profile is
  'A person''s Leader Profile (handoff 6.17): readable by its owner only; a group sees it only through profile_share.';

create table app.profile_share (
  person_id uuid not null references app.personality_profile (person_id) on delete cascade,
  team_id uuid not null references app.team (id) on delete cascade,
  level text not null check (level in ('nothing', 'domains', 'facets')),
  primary key (person_id, team_id)
);
create index profile_share_team_idx on app.profile_share (team_id);
comment on table app.profile_share is
  'What one group may see of a person''s profile: nothing, domains, or domains and facets (handoff 6.17). Set by its owner only.';

-- ---------------------------------------------------------------- the band of a trait
create function app.profile_band(p_sum int, p_n int, p_set int) returns text
  language sql stable set search_path = ''
as $$
  select case
    when p_sum * 100 < b.lower_below * 100 * p_n then 'lower'
    when p_sum * 100 > b.higher_above * 100 * p_n then 'higher'
    else 'middle' end
  from app.profile_band_set b
  where b.version = p_set and p_n > 0
$$;
comment on function app.profile_band(int, int, int) is 'Lower, middle or higher for a trait''s sum over n items, by a band set (D-31).';

-- ---------------------------------------------------------------- the one write path for a profile
create function app.save_profile(p_test text, p_answers jsonb) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_test uuid;
  v_items int;
  v_valid int;
  v_set int;
  v_scores jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is null or position('@' in v_email) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select t.id into v_test from app.profile_test t where t.key = p_test and t.status = 'published';
  if v_test is null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- every item answered once, with a whole number from 1 to 5, and nothing else
  select count(*) into v_items from app.profile_item i where i.test_id = v_test;
  select count(*) into v_valid
  from jsonb_each(p_answers) a
  join app.profile_item i on i.test_id = v_test and i.id::text = a.key
  where jsonb_typeof(a.value) = 'number' and a.value::text ~ '^[1-5]$';
  if v_valid <> v_items or (select count(*) from jsonb_object_keys(p_answers)) <> v_items then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select b.version into v_set from app.profile_band_set b where b.valid_from <= now() order by b.version desc limit 1;
  if v_set is null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  -- per trait the sum of the keyed answers and their count; a facet's answers count for its domain too
  with a as (
    select f.key as trait, f.domain,
           case when i.keyed = 1 then (p_answers ->> i.id::text)::int else 6 - (p_answers ->> i.id::text)::int end as v
    from app.profile_item i
    join app.profile_trait f on f.test_id = i.test_id and f.key = i.trait
    where i.test_id = v_test
  ), t as (
    select a.trait as key, sum(a.v)::int as s, count(*)::int as n from a group by a.trait
    union all
    select a.domain, sum(a.v)::int, count(*)::int from a where a.trait <> a.domain group by a.domain
  )
  select jsonb_object_agg(t.key, jsonb_build_object('sum', t.s, 'n', t.n)) into v_scores from t;

  -- the person row exists once they have a group (0009); a profile can come first
  insert into app.person (id, display_name)
  values (v_uid, left(btrim(split_part(v_email, '@', 1)), 120))
  on conflict (id) do nothing;

  -- one profile per person: a retake replaces it
  insert into app.personality_profile (person_id, test_id, band_set, taken_at, scores)
  values (v_uid, v_test, v_set, now(), v_scores)
  on conflict (person_id) do update
    set test_id = excluded.test_id, band_set = excluded.band_set, taken_at = excluded.taken_at, scores = excluded.scores;

  -- and resets sharing to nothing (handoff 6.17), audited per group with ids only
  with reset as (
    update app.profile_share s set level = 'nothing'
    where s.person_id = v_uid and s.level <> 'nothing'
    returning s.team_id
  )
  insert into app.audit_event (org_id, kind, actor, detail)
  select t.org_id, 'sharing_changed', v_uid, jsonb_build_object('team', t.id, 'level', 'nothing', 'reason', 'retake')
  from reset r join app.team t on t.id = r.team_id;

  return jsonb_build_object('ok', true);
end $$;
comment on function app.save_profile(text, jsonb) is
  'The signed-in caller''s profile from a full set of answers: stores sums per trait, never the answers. A retake resets sharing.';

-- ---------------------------------------------------------------- sharing, per group, by its owner
create function app.set_profile_share(p_team uuid, p_level text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_changed uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_level is null or p_level not in ('nothing', 'domains', 'facets') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_team is null or not app.is_team_member(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not exists (select 1 from app.personality_profile pp where pp.person_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  insert into app.profile_share as s (person_id, team_id, level)
  values (v_uid, p_team, p_level)
  on conflict (person_id, team_id) do update set level = excluded.level
    where s.level is distinct from excluded.level
  returning s.team_id into v_changed;

  if v_changed is not null then
    insert into app.audit_event (org_id, kind, actor, detail)
    select t.org_id, 'sharing_changed', v_uid, jsonb_build_object('team', t.id, 'level', p_level)
    from app.team t where t.id = p_team;
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.set_profile_share(uuid, text) is
  'The caller sets what one of their groups may see of their profile. Applies at once (handoff 6.17).';

-- ---------------------------------------------------------------- delete, at once
create function app.delete_profile() returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  -- its shares go with it (on delete cascade)
  delete from app.personality_profile pp where pp.person_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into app.audit_event (org_id, kind, actor, detail) values (null, 'profile_deleted', v_uid, '{}'::jsonb);
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.delete_profile() is 'The caller''s profile and every share of it, removed at once (handoff 6.17 and 8).';

-- ---------------------------------------------------------------- what a group sees
create function app.get_group_profiles(p_team uuid)
  returns table (person_id uuid, display_name text, role text, level text, test text, traits jsonb)
  language sql stable security definer set search_path = ''
as $$
  select m.person_id, p.display_name, m.role,
         coalesce(case when pp.person_id is not null then s.level end, 'nothing') as level,
         case when pp.person_id is not null and s.level in ('domains', 'facets') then t.key end as test,
         case when pp.person_id is not null and s.level in ('domains', 'facets') then (
           select jsonb_agg(jsonb_build_object(
                    'key', tr.key, 'kind', tr.kind, 'domain', tr.domain, 'name', tr.name ->> 'en',
                    'band', app.profile_band((pp.scores -> tr.key ->> 'sum')::int, (pp.scores -> tr.key ->> 'n')::int, pp.band_set))
                  order by tr.kind <> 'domain', tr.ordinal)
           from app.profile_trait tr
           where tr.test_id = pp.test_id and (tr.kind = 'domain' or s.level = 'facets')
         ) end as traits
  from app.membership m
  join app.person p on p.id = m.person_id
  left join app.personality_profile pp on pp.person_id = m.person_id
  left join app.profile_share s on s.person_id = m.person_id and s.team_id = p_team
  left join app.profile_test t on t.id = pp.test_id
  where app.is_team_member(p_team)
    and m.team_id = p_team and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())
  order by m.role = 'leader' desc, p.display_name
$$;
comment on function app.get_group_profiles(uuid) is
  'A group''s current members for its members: name, role, and each profile only at the level its owner shares with this group. Bands only.';

-- ---------------------------------------------------------------- access
alter table app.profile_test enable row level security;
alter table app.profile_trait enable row level security;
alter table app.profile_item enable row level security;
alter table app.profile_band_set enable row level security;
alter table app.personality_profile enable row level security;
alter table app.profile_share enable row level security;

revoke all on app.profile_test, app.profile_trait, app.profile_item, app.profile_band_set,
  app.personality_profile, app.profile_share from anon, authenticated, service_role;

-- the published tests are reference data: a visitor takes them with no account (handoff 8, roles)
create policy profile_test_read on app.profile_test for select to anon, authenticated using (status <> 'draft');
create policy profile_trait_read on app.profile_trait for select to anon, authenticated
  using (exists (select 1 from app.profile_test t where t.id = test_id and t.status <> 'draft'));
create policy profile_item_read on app.profile_item for select to anon, authenticated
  using (exists (select 1 from app.profile_test t where t.id = test_id and t.status <> 'draft'));
create policy profile_band_set_read on app.profile_band_set for select to anon, authenticated using (true);
grant select on app.profile_test, app.profile_trait, app.profile_item, app.profile_band_set to anon, authenticated;

-- the profile and its shares: their owner only; no client writes
create policy personality_profile_owner on app.personality_profile for select to authenticated using (person_id = auth.uid());
create policy profile_share_owner on app.profile_share for select to authenticated using (person_id = auth.uid());
grant select on app.personality_profile, app.profile_share to authenticated;

grant execute on function app.save_profile(text, jsonb), app.set_profile_share(uuid, text), app.delete_profile(),
  app.get_group_profiles(uuid) to authenticated;
