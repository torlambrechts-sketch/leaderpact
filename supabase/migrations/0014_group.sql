-- 0014_group.sql — the group: its charter with versions, and its members, invited by a personal link,
-- removed, and a new leader named (handoff 6.8 and 8; milestone 9: "A draft does not change the version in
-- force until the group agrees").
--
-- 1. **One version in force.** A charter is the versions of one group's purpose, team tasks with decision
--    rights and working agreements (handoff 6.8). A draft is stored, edited by the leader and readable by
--    the group; it never touches the version in force. "The group agrees · put in force" (`agree_charter`)
--    numbers the draft, puts it in force and supersedes the version before. An agreed version never
--    changes and stays readable. Drafts start from the charter template (handoff 9), a versioned row.
-- 2. **Members by invitation.** The leader invites a person by name and email address (`invite_member`).
--    The invitation is a link with a random token, of which only the SHA-256 is kept, for `invitation_days`.
--    The person signs in with that address and joins (`accept_invitation`); the address must match. A group
--    holds up to `members_per_group` members, open invitations counted (handoff 1: up to 15).
-- 3. **Leaving.** A member who leaves loses access at once: `remove_member` ends the membership, and past
--    rounds stay intact. The only leader cannot be removed; the leader names another (`set_group_leader`),
--    which ends both memberships and starts the new ones, so each keeps its dates (handoff 6.8).
-- 4. **The Team plan's.** The charter and invitations are written only while the group has the Team plan or
--    its trial and is not read-only (`team_plan_writable`, after 0013). Ending a membership, revoking an
--    invitation and naming a leader are always open: they take access away or hand it on.
-- 5. **Through functions only.** No client reads or writes these tables; `get_charter`,
--    `get_charter_version` and `get_group_members` answer the group's current members, and the invitation
--    page reads `get_invitation` by token. Putting a version in force is audited with ids only (handoff 8).
-- 6. **Nothing is deleted here.** A discarded draft, a revoked invitation and an ended membership keep their
--    rows, with a state and a date; their group's removal takes them.

-- ---------------------------------------------------------------- the Team plan, writable
create function app.team_plan_writable(p_team uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$ select app.group_access(p_team) in ('trial', 'team', 'grace') $$;
comment on function app.team_plan_writable(uuid) is
  'True while the group has the Team plan or its trial and is not read-only: the charter and invitations are written only then.';

-- ---------------------------------------------------------------- how long an invitation stands
insert into app.setting (key, scope, default_value, min_value, max_value, fixed, unit) values
  ('invitation_days', 'platform', '14', null, null, true, 'days');

-- ---------------------------------------------------------------- the charter template (handoff 9)
create table app.charter_template (
  version int primary key check (version > 0),
  max_tasks int not null check (max_tasks between 1 and 30),
  max_agreements int not null check (max_agreements between 1 and 30),
  purpose_length int not null check (purpose_length between 50 and 2000),
  item_length int not null check (item_length between 40 and 500),
  valid_from timestamptz not null
);
comment on table app.charter_template is
  'The charter''s three parts and their limits, versioned (handoff 9): purpose, team tasks with decision rights, working agreements.';
insert into app.charter_template (version, max_tasks, max_agreements, purpose_length, item_length, valid_from) values
  (1, 12, 12, 600, 200, '2026-01-01T00:00:00Z');

create function app.charter_template_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  raise exception 'a charter template never changes: add a version instead' using errcode = 'check_violation';
end $$;
create trigger charter_template_fixed before update on app.charter_template for each row execute function app.charter_template_fixed();

-- ---------------------------------------------------------------- the charter's versions
create table app.charter_version (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  status text not null default 'draft' check (status in ('draft', 'in_force', 'superseded', 'discarded')),
  -- numbered when put in force: 1, 2, 3 …
  version int check (version > 0),
  template_version int not null references app.charter_template (version),
  -- the version a draft was started from; null for the first
  based_on int check (based_on > 0),
  purpose text not null default '' check (length(purpose) <= 2000),
  -- a draft's tasks and agreements, {"tasks": [{"title", "right"}], "agreements": ["…"]}; an agreed
  -- version's are rows in team_task and working_agreement
  draft jsonb check (draft is null or jsonb_typeof(draft) = 'object'),
  created_by uuid references app.person (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  agreed_at timestamptz,
  agreed_by uuid references app.person (id) on delete set null,
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  unique (id, org_id),
  unique (team_id, version),
  check ((status in ('in_force', 'superseded')) = (version is not null and agreed_at is not null)),
  check ((status in ('in_force', 'superseded')) = (draft is null))
);
create unique index charter_version_draft_uidx on app.charter_version (team_id) where status = 'draft';
create unique index charter_version_in_force_uidx on app.charter_version (team_id) where status = 'in_force';
comment on table app.charter_version is
  'A group''s charter, version by version (handoff 6.8): one in force, at most one draft, earlier versions readable. No client reads it.';

-- a version moves forward only, and an agreed or discarded one keeps its content. A person's removal
-- may clear created_by or agreed_by (on delete set null): that is the only change it allows.
create function app.charter_version_guard() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.team_id, old.org_id) is distinct from (new.team_id, new.org_id) then
    raise exception 'a charter version never moves to another group' using errcode = 'check_violation';
  end if;
  if new.status <> old.status
     and not ((old.status = 'draft' and new.status in ('in_force', 'discarded')) or (old.status = 'in_force' and new.status = 'superseded')) then
    raise exception 'a charter version moves only forward (% to %)', old.status, new.status using errcode = 'check_violation';
  end if;
  if old.status <> 'draft'
     and (old.version, old.template_version, old.based_on, old.purpose, old.draft, old.agreed_at, old.created_at)
         is distinct from (new.version, new.template_version, new.based_on, new.purpose, new.draft, new.agreed_at, new.created_at) then
    raise exception 'an agreed or discarded charter version never changes its content' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger charter_version_guard before update on app.charter_version for each row execute function app.charter_version_guard();

create table app.team_task (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  version_id uuid not null,
  ordinal int not null check (ordinal > 0),
  title text not null check (length(btrim(title)) between 1 and 500),
  decision_right text not null check (decision_right in ('decide', 'advise', 'inform')),
  foreign key (version_id, org_id) references app.charter_version (id, org_id) on delete cascade,
  unique (version_id, ordinal)
);
comment on table app.team_task is 'An agreed charter version''s team tasks, each with its decision right (handoff 6.8). Never changed.';

create table app.working_agreement (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  version_id uuid not null,
  ordinal int not null check (ordinal > 0),
  text text not null check (length(btrim(text)) between 1 and 500),
  foreign key (version_id, org_id) references app.charter_version (id, org_id) on delete cascade,
  unique (version_id, ordinal)
);
comment on table app.working_agreement is 'An agreed charter version''s working agreements (handoff 6.8). Never changed.';

-- an agreed version's tasks and agreements are written once, at agreement; their group's removal takes them
create function app.charter_content_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  raise exception 'an agreed charter version''s tasks and agreements never change' using errcode = 'check_violation';
end $$;
create trigger team_task_fixed before update on app.team_task for each row execute function app.charter_content_fixed();
create trigger working_agreement_fixed before update on app.working_agreement for each row execute function app.charter_content_fixed();

-- ---------------------------------------------------------------- invitations
create table app.invitation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  email text not null check (length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  -- the SHA-256 of the link's token; the token itself is shown once, to the leader who invites
  token_hash bytea not null unique check (length(token_hash) = 32),
  created_by uuid references app.person (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references app.person (id) on delete set null,
  revoked_at timestamptz,
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  check (expires_at > created_at),
  check (accepted_at is null or revoked_at is null)
);
create unique index invitation_open_uidx on app.invitation (team_id, email) where accepted_at is null and revoked_at is null;
comment on table app.invitation is
  'A leader''s invitation to join a group, by name and address (handoff 6.8), with only its token''s hash. No client reads it.';

-- ---------------------------------------------------------------- reading the charter
create function app.charter_version_json(p_version uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'version', v.version,
    'agreed_at', v.agreed_at,
    'purpose', v.purpose,
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'right', t.decision_right) order by t.ordinal)
                       from app.team_task t where t.version_id = v.id), '[]'::jsonb),
    'agreements', coalesce((select jsonb_agg(a.text order by a.ordinal) from app.working_agreement a where a.version_id = v.id), '[]'::jsonb))
  from app.charter_version v
  where v.id = p_version and v.status in ('in_force', 'superseded')
$$;
comment on function app.charter_version_json(uuid) is 'An agreed version, as the charter page reads it. Internal: no client runs it.';

create function app.get_charter(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then jsonb_build_object(
    'in_force', (select app.charter_version_json(v.id) from app.charter_version v where v.team_id = p_team and v.status = 'in_force'),
    'draft', (select jsonb_build_object('purpose', d.purpose, 'tasks', d.draft -> 'tasks', 'agreements', d.draft -> 'agreements',
                                        'based_on', d.based_on, 'updated_at', d.updated_at)
              from app.charter_version d where d.team_id = p_team and d.status = 'draft'),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'agreed_at', v.agreed_at) order by v.version)
                          from app.charter_version v where v.team_id = p_team and v.status in ('in_force', 'superseded')), '[]'::jsonb),
    'template', (select jsonb_build_object('version', t.version, 'max_tasks', t.max_tasks, 'max_agreements', t.max_agreements,
                                            'purpose_length', t.purpose_length, 'item_length', t.item_length)
                 from app.charter_template t where t.valid_from <= now() order by t.version desc limit 1),
    'can_edit', app.is_team_leader(p_team) and app.team_plan_writable(p_team)) end
$$;
comment on function app.get_charter(uuid) is
  'For the group''s current members: the version in force, the draft, the agreed versions, the template''s limits, and whether the caller may edit.';

create function app.get_charter_version(p_team uuid, p_version int) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then (
    select app.charter_version_json(v.id) from app.charter_version v where v.team_id = p_team and v.version = p_version) end
$$;
comment on function app.get_charter_version(uuid, int) is 'An agreed version of the group''s charter, for its current members (handoff 6.8: earlier versions stay readable).';

-- ---------------------------------------------------------------- the draft
create function app.save_charter_draft(p_team uuid, p_purpose text, p_tasks jsonb, p_agreements jsonb) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_t app.charter_template%rowtype;
  v_purpose text := btrim(coalesce(p_purpose, ''));
  v_tasks jsonb;
  v_agreements jsonb;
  v_org uuid;
  v_draft uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.team_plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  select * into v_t from app.charter_template t where t.valid_from <= now() order by t.version desc limit 1;

  -- the parts, checked and trimmed: a task has a title and a decision right, an agreement is text
  if jsonb_typeof(coalesce(p_tasks, 'null')) <> 'array' or jsonb_typeof(coalesce(p_agreements, 'null')) <> 'array'
     or length(v_purpose) > v_t.purpose_length
     or jsonb_array_length(p_tasks) > v_t.max_tasks or jsonb_array_length(p_agreements) > v_t.max_agreements
     or exists (select 1 from jsonb_array_elements(p_tasks) e
                where jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'title') <> 'string'
                   or length(btrim(e ->> 'title')) not between 1 and v_t.item_length
                   or coalesce(e ->> 'right', '') not in ('decide', 'advise', 'inform'))
     or exists (select 1 from jsonb_array_elements(p_agreements) e
                where jsonb_typeof(e) <> 'string' or length(btrim(e #>> '{}')) not between 1 and v_t.item_length) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('title', btrim(e ->> 'title'), 'right', e ->> 'right') order by n), '[]'::jsonb)
    into v_tasks from jsonb_array_elements(p_tasks) with ordinality as x (e, n);
  select coalesce(jsonb_agg(to_jsonb(btrim(e #>> '{}')) order by n), '[]'::jsonb)
    into v_agreements from jsonb_array_elements(p_agreements) with ordinality as x (e, n);

  -- one draft at a time: a second save at the same moment waits here
  select t.org_id into v_org from app.team t where t.id = p_team for update;
  select d.id into v_draft from app.charter_version d where d.team_id = p_team and d.status = 'draft';
  if v_draft is null then
    insert into app.charter_version (org_id, team_id, template_version, based_on, purpose, draft, created_by)
    select v_org, p_team, v_t.version,
           (select v.version from app.charter_version v where v.team_id = p_team and v.status = 'in_force'),
           v_purpose, jsonb_build_object('tasks', v_tasks, 'agreements', v_agreements), v_uid;
  else
    update app.charter_version
    set purpose = v_purpose, draft = jsonb_build_object('tasks', v_tasks, 'agreements', v_agreements), updated_at = now()
    where id = v_draft;
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.save_charter_draft(uuid, text, jsonb, jsonb) is
  'The leader saves the group''s one draft: purpose, tasks with decision rights, agreements. The version in force does not change.';

create function app.discard_charter_draft(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.team_plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  update app.charter_version set status = 'discarded', updated_at = now() where team_id = p_team and status = 'draft';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_draft');
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.discard_charter_draft(uuid) is 'The leader discards the draft. The row stays, discarded; the version in force does not change.';

-- "The group agrees · put in force" (handoff 6.8)
create function app.agree_charter(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_d app.charter_version%rowtype;
  v_next int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.team_plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  perform 1 from app.team t where t.id = p_team for update;
  select * into v_d from app.charter_version d where d.team_id = p_team and d.status = 'draft';
  if v_d.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_draft');
  end if;
  -- all three parts: a purpose, a team task and a working agreement
  if v_d.purpose = '' or jsonb_array_length(v_d.draft -> 'tasks') = 0 or jsonb_array_length(v_d.draft -> 'agreements') = 0 then
    return jsonb_build_object('ok', false, 'reason', 'incomplete');
  end if;

  select coalesce(max(v.version), 0) + 1 into v_next from app.charter_version v where v.team_id = p_team;
  update app.charter_version set status = 'superseded', updated_at = now() where team_id = p_team and status = 'in_force';
  update app.charter_version
  set status = 'in_force', version = v_next, agreed_at = now(), agreed_by = v_uid, draft = null, updated_at = now()
  where id = v_d.id;
  insert into app.team_task (org_id, version_id, ordinal, title, decision_right)
  select v_d.org_id, v_d.id, x.n, x.e ->> 'title', x.e ->> 'right'
  from jsonb_array_elements(v_d.draft -> 'tasks') with ordinality as x (e, n);
  insert into app.working_agreement (org_id, version_id, ordinal, text)
  select v_d.org_id, v_d.id, x.n, x.e #>> '{}'
  from jsonb_array_elements(v_d.draft -> 'agreements') with ordinality as x (e, n);

  insert into app.audit_event (org_id, kind, actor, detail)
  values (v_d.org_id, 'charter_agreed', v_uid, jsonb_build_object('team', p_team, 'version', v_next));
  return jsonb_build_object('ok', true, 'version', v_next);
end $$;
comment on function app.agree_charter(uuid) is
  'The leader records that the group agrees: the draft becomes the version in force, numbered, and the one before is superseded.';

-- ---------------------------------------------------------------- reading the members
create function app.get_group_members(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('person', x.person_id, 'name', x.display_name, 'role', x.role, 'since', x.since,
                                          'me', x.person_id = auth.uid())
                       order by x.role = 'leader' desc, x.display_name, x.person_id)
      from (select m.person_id, p.display_name, m.role,
                   (select min(m2.valid_from) from app.membership m2 where m2.team_id = p_team and m2.person_id = m.person_id) as since
            from app.membership m join app.person p on p.id = m.person_id
            where m.team_id = p_team and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())) x), '[]'::jsonb),
    -- open invitations, for the leader alone: a member sees who is in the group, not who was asked
    'invitations', case when app.is_team_leader(p_team) then coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.display_name, 'email', i.email, 'invited_at', i.created_at,
                                          'expires_at', i.expires_at, 'expired', i.expires_at <= now())
                       order by i.created_at, i.id)
      from app.invitation i where i.team_id = p_team and i.accepted_at is null and i.revoked_at is null), '[]'::jsonb) end,
    'max', app.setting_int('members_per_group'),
    'invitation_days', app.setting_int('invitation_days'),
    'can_invite', app.is_team_leader(p_team) and app.team_plan_writable(p_team),
    'can_manage', app.is_team_leader(p_team)) end
$$;
comment on function app.get_group_members(uuid) is
  'For the group''s current members: who is in it, with role and start date; the open invitations for its leader alone.';

-- ---------------------------------------------------------------- invitations
create function app.invite_member(p_team uuid, p_email text, p_name text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_org uuid;
  v_token text;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.team_plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_name) not between 1 and 120 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select t.org_id into v_org from app.team t where t.id = p_team for update;
  if exists (select 1 from app.membership m join auth.users u on u.id = m.person_id
             where m.team_id = p_team and lower(u.email) = v_email
               and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())) then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end if;
  -- a second invitation to the same address replaces the first, with a new link
  update app.invitation set revoked_at = now()
  where team_id = p_team and email = v_email and accepted_at is null and revoked_at is null;
  if (select count(*) from app.membership m
      where m.team_id = p_team and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now()))
     + (select count(*) from app.invitation i
        where i.team_id = p_team and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
     >= app.setting_int('members_per_group') then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  v_token := app.new_link_code();
  insert into app.invitation (org_id, team_id, email, display_name, token_hash, created_by, expires_at)
  values (v_org, p_team, v_email, v_name, pg_catalog.sha256(convert_to(v_token, 'UTF8')), v_uid,
          now() + make_interval(days => app.setting_int('invitation_days')))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'token', v_token, 'invitation', v_id);
end $$;
comment on function app.invite_member(uuid, text, text) is
  'The leader invites a person by name and address: {ok, token} once; only the token''s hash is kept. Up to 15, invitations counted.';

-- the invitation page: which group asks, and whether the link still stands; never the address
create function app.get_invitation(p_token text) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'group', t.name,
    'name', i.display_name,
    'leader', (select p.display_name from app.membership m join app.person p on p.id = m.person_id
               where m.team_id = i.team_id and m.role = 'leader' and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())),
    'state', case when i.revoked_at is not null then 'revoked' when i.accepted_at is not null then 'used'
                  when i.expires_at <= now() then 'expired' else 'open' end,
    -- the group, for a caller already in it: the page takes them there
    'team', case when app.is_team_member(i.team_id) then i.team_id end)
  from app.invitation i join app.team t on t.id = i.team_id
  where p_token is not null and length(p_token) between 16 and 64
    and i.token_hash = pg_catalog.sha256(convert_to(p_token, 'UTF8'))
$$;
comment on function app.get_invitation(text) is
  'The invitation link''s page, for anyone holding the token: the group, the invited name, the leader and the state; the group''s id only for a caller already in it. Never the address.';

-- whether an address is the one an open invitation names: asked before a sign-in link may make an account
create function app.invitation_matches(p_token text, p_email text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app.invitation i
    where p_token is not null and length(p_token) between 16 and 64
      and i.token_hash = pg_catalog.sha256(convert_to(p_token, 'UTF8'))
      and i.email = lower(btrim(coalesce(p_email, '')))
      and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
$$;
comment on function app.invitation_matches(text, text) is
  'True when an open invitation with this token names this address. The sign-in page asks it before a link may make an account.';

create function app.accept_invitation(p_token text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_i app.invitation%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  select * into v_i from app.invitation i
  where p_token is not null and length(p_token) between 16 and 64
    and i.token_hash = pg_catalog.sha256(convert_to(p_token, 'UTF8'))
  for update;
  if v_i.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if v_i.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;
  if v_i.accepted_at is not null then
    -- the same person opening the link again: they are in
    if v_i.accepted_by = v_uid and app.is_team_member(v_i.team_id) then
      return jsonb_build_object('ok', true, 'team', v_i.team_id);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;
  if v_i.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_email is distinct from v_i.email then
    return jsonb_build_object('ok', false, 'reason', 'other_address');
  end if;

  perform 1 from app.team t where t.id = v_i.team_id for update;
  if not app.is_team_member(v_i.team_id) then
    if (select count(*) from app.membership m
        where m.team_id = v_i.team_id and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now()))
       >= app.setting_int('members_per_group') then
      return jsonb_build_object('ok', false, 'reason', 'full');
    end if;
    -- the person row may already exist (another group, or a profile); the invited name names a new one
    insert into app.person (id, display_name) values (v_uid, v_i.display_name) on conflict (id) do nothing;
    insert into app.membership (org_id, team_id, person_id, role) values (v_i.org_id, v_i.team_id, v_uid, 'member');
  end if;
  update app.invitation set accepted_at = now(), accepted_by = v_uid where id = v_i.id;
  return jsonb_build_object('ok', true, 'team', v_i.team_id);
end $$;
comment on function app.accept_invitation(text) is
  'The signed-in invitee joins the group, when the invitation is open and names their address. Up to 15 members.';

create function app.revoke_invitation(p_team uuid, p_invitation uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  update app.invitation set revoked_at = now()
  where id = p_invitation and team_id = p_team and accepted_at is null and revoked_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.revoke_invitation(uuid, uuid) is 'The leader withdraws an open invitation; its link no longer works.';

-- ---------------------------------------------------------------- leaving, and a new leader
create function app.remove_member(p_team uuid, p_person uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  -- the only leader cannot be removed (handoff 6.8): the leader names another first
  if p_person = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'only_leader');
  end if;
  update app.membership set valid_to = now()
  where team_id = p_team and person_id = p_person and role = 'member'
    and valid_from <= now() and (valid_to is null or valid_to > now());
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.remove_member(uuid, uuid) is
  'The leader ends a member''s membership: access ends at once, past rounds stay intact (handoff 6.8).';

create function app.set_group_leader(p_team uuid, p_person uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  select t.org_id into v_org from app.team t where t.id = p_team for update;
  if p_person is null or p_person = v_uid or not exists (
       select 1 from app.membership m
       where m.team_id = p_team and m.person_id = p_person and m.role = 'member'
         and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  -- both memberships end and start again, so each keeps its dates
  update app.membership set valid_to = now()
  where team_id = p_team and person_id in (v_uid, p_person)
    and valid_from <= now() and (valid_to is null or valid_to > now());
  insert into app.membership (org_id, team_id, person_id, role) values
    (v_org, p_team, v_uid, 'member'),
    (v_org, p_team, p_person, 'leader');
  return jsonb_build_object('ok', true);
end $$;
comment on function app.set_group_leader(uuid, uuid) is
  'The leader names another current member as the group''s leader and stays as a member (handoff 6.8).';

-- ---------------------------------------------------------------- access
alter table app.charter_template enable row level security;
alter table app.charter_version enable row level security;
alter table app.team_task enable row level security;
alter table app.working_agreement enable row level security;
alter table app.invitation enable row level security;
revoke all on app.charter_template, app.charter_version, app.team_task, app.working_agreement, app.invitation
  from anon, authenticated, service_role;

grant execute on function app.get_charter(uuid), app.get_charter_version(uuid, int), app.save_charter_draft(uuid, text, jsonb, jsonb),
  app.discard_charter_draft(uuid), app.agree_charter(uuid), app.get_group_members(uuid), app.invite_member(uuid, text, text),
  app.accept_invitation(text), app.revoke_invitation(uuid, uuid), app.remove_member(uuid, uuid), app.set_group_leader(uuid, uuid)
  to authenticated;
-- the invitation link's page and its sign-in, opened by people with no account yet
grant execute on function app.get_invitation(text), app.invitation_matches(text, text) to anon, authenticated;
