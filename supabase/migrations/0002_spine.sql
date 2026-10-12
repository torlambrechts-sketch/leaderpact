-- 0002_spine.sql — organisation, group, person and the time-bound membership that joins them; the
-- threshold that only rises; the audit trail.
--
-- The spine of handoff section 8. Table names follow the architecture document, where a group is a
-- `team`; every screen says "group" (handoff section 10).
--
-- 1. **Every row carries its organisation**, and every read is scoped by a *current* membership: a
--    person reads a group while valid_from <= now() < valid_to, and not a moment after (handoff 8, test
--    "a person whose membership has ended cannot read the group"). `person` is the one exception: it is
--    the signed-in identity, one per auth user, and a person may belong to groups of more than one
--    organisation, so it carries none. It is read only by the person and by people who share a group.
-- 2. **No client writes any of these tables.** Groups, members and settings are written by definer
--    functions from milestone 4 on. Until then the tables are read-only to `authenticated` and closed to
--    `anon` (S5 in the audit holds this).
-- 3. **The threshold is 4, may rise to 8 and never falls** (CLAUDE.md invariant 1, owner C10). The bounds
--    are the functions of 0001; the column is checked against them, and a trigger refuses any lowering
--    for every role, the table owner included. Each raise writes an audit row.
-- 4. **The audit trail** (handoff 8, Audit) records kinds, ids and counts, never an answer or free text.
--    No client reads it.
--
-- Pattern origin: Orgpuls 0001_foundation.sql (org scoping, helper functions) and 0150_k_floor_three.sql
-- (threshold functions) @ 6f5d441.

-- ---------------------------------------------------------------- organisation
create table app.organisation (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  -- the anonymity threshold: 4 to 8, only ever raised (handoff 8, Configuration)
  threshold int not null default 4 check (threshold between app.k_floor() and app.k_max()),
  -- days the data of a cancelled subscription is kept (handoff 8: 90, 30 to 365)
  retention_days int not null default 90 check (retention_days between 30 and 365),
  -- the demo organisation powers demos, tests and the sample pages; it emits no events (REUSE 4.12)
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table app.organisation is 'A customer. Its threshold only rises (owner C10).';

-- ---------------------------------------------------------------- team (a "group" on every screen)
create table app.team (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references app.organisation (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index team_org_idx on app.team (org_id);
comment on table app.team is 'A leadership group of 4 to 15 (handoff 1). Called "group" in the product.';

-- ---------------------------------------------------------------- person
create table app.person (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);
comment on table app.person is
  'The signed-in identity, one per auth user. Carries no organisation: a person may be in groups of several organisations; membership is org-scoped.';

-- ---------------------------------------------------------------- membership
create table app.membership (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  person_id uuid not null references app.person (id) on delete cascade,
  role text not null check (role in ('leader', 'member')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  check (valid_to is null or valid_to > valid_from),
  -- the membership's organisation is its group's: one key, so the two can never disagree
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade
);
create index membership_person_idx on app.membership (person_id);
create index membership_team_idx on app.membership (team_id);
-- one open membership per person and group; one open leader per group (handoff 6.8)
create unique index membership_open_uidx on app.membership (team_id, person_id) where valid_to is null;
create unique index membership_leader_uidx on app.membership (team_id) where role = 'leader' and valid_to is null;
comment on table app.membership is
  'Team, person, role, valid from, valid to (handoff 8). Access ends at valid_to; past rounds stay intact.';

-- ---------------------------------------------------------------- who the caller is, in which groups
-- Definer functions, so a policy that asks them does not recurse through membership's own policy. Each
-- answers for the caller only (auth.uid()), never for a person named by the caller.
create function app.is_team_member(p_team uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app.membership m
    where m.team_id = p_team and m.person_id = auth.uid()
      and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now()))
$$;

create function app.is_team_leader(p_team uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app.membership m
    where m.team_id = p_team and m.person_id = auth.uid() and m.role = 'leader'
      and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now()))
$$;

create function app.is_org_member(p_org uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app.membership m
    where m.org_id = p_org and m.person_id = auth.uid()
      and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now()))
$$;

-- a person the caller may see: themselves, or anyone who has been in a group the caller is in now
create function app.shares_team(p_person uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_person = auth.uid() or exists (
    select 1 from app.membership mine join app.membership theirs on theirs.team_id = mine.team_id
    where mine.person_id = auth.uid() and theirs.person_id = p_person
      and mine.valid_from <= now() and (mine.valid_to is null or mine.valid_to > now()))
$$;

grant execute on function app.is_team_member(uuid), app.is_team_leader(uuid), app.is_org_member(uuid), app.shares_team(uuid)
  to authenticated;

-- ---------------------------------------------------------------- read policies (no client writes)
alter table app.organisation enable row level security;
alter table app.team enable row level security;
alter table app.person enable row level security;
alter table app.membership enable row level security;

create policy organisation_read on app.organisation for select to authenticated using (app.is_org_member(id));
create policy team_read on app.team for select to authenticated using (app.is_team_member(id));
create policy person_read on app.person for select to authenticated using (app.shares_team(id));
create policy membership_read on app.membership for select to authenticated using (app.is_team_member(team_id));

grant select on app.organisation, app.team, app.person, app.membership to authenticated;

-- ---------------------------------------------------------------- the audit trail
create table app.audit_event (
  id bigint generated always as identity primary key,
  org_id uuid references app.organisation (id) on delete cascade,
  kind text not null check (kind in (
    'group_created', 'round_opened', 'round_extended', 'round_closed', 'results_released', 'reminder_sent',
    'charter_agreed', 'consent_given', 'sharing_changed', 'profile_deleted', 'plan_changed', 'payment_failed',
    'threshold_raised')),
  actor uuid references app.person (id) on delete set null,
  at timestamptz not null default now(),
  -- ids, kinds and counts only: never an answer, a score or free text (CLAUDE.md invariant 10)
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object')
);
create index audit_event_org_idx on app.audit_event (org_id, at);
alter table app.audit_event enable row level security;
-- no policy and no grant: the trail is read by the platform's own functions, not by a client
revoke all on app.audit_event from anon, authenticated, service_role;
comment on table app.audit_event is 'Audited events (handoff 8): kinds, ids and counts, never an answer.';

-- ---------------------------------------------------------------- the threshold only rises
create function app.threshold_only_rises() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if new.threshold < old.threshold then
    raise exception 'the anonymity threshold is never lowered (from % to %)', old.threshold, new.threshold
      using errcode = 'check_violation';
  end if;
  if new.threshold > old.threshold then
    insert into app.audit_event (org_id, kind, actor, detail)
    values (new.id, 'threshold_raised', auth.uid(), jsonb_build_object('from', old.threshold, 'to', new.threshold));
  end if;
  return new;
end $$;

create trigger organisation_threshold_only_rises before update of threshold on app.organisation
  for each row execute function app.threshold_only_rises();

-- the threshold in force for an organisation: its setting, never below the floor nor above the ceiling
create function app.k_threshold(p_org uuid) returns int
  language sql stable security definer set search_path = ''
as $$
  select least(app.k_max(), greatest(app.k_floor(), o.threshold)) from app.organisation o where o.id = p_org
$$;
