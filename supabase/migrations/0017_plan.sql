-- 0017_plan.sql — the group's plan: focus areas and their actions (handoff 6.13; milestone 12: "A third focus
-- area is refused. An action without an owner is refused"; D-46).
--
-- 1. **At most 2 active focus areas.** A focus area is one of the 21 scales, chosen from a released round of
--    the Full diagnostic (handoff 6.12: "a button to make it a focus area"). The number is the platform
--    setting `active_focus_areas` (2, fixed). A third is refused until one is closed: by the function, and by
--    a trigger on the table under the group's lock, so no path and no race makes a third. A scale is active
--    once at most. A closed focus area stays closed and keeps its row; choosing the scale again makes a new
--    one.
-- 2. **Every action has an owner and a due date.** The owner is a current member of the group when the action
--    is saved; the column is not null, so an action without an owner cannot be stored at all. An action
--    belongs to an active focus area when it is added. Its owner or the leader marks it done, reopens it, or
--    changes its title, owner and date. No target on a survey score: an action is a title, an owner and a
--    date, and a focus area holds no number (handoff 6.13).
-- 3. **Who.** The leader records the group's choice of focus areas and closes them, as with the charter
--    (handoff 2: "Choose focus areas and actions · Group"). Any member adds an action. Everything is the Team
--    plan's (`focus_areas`) and stops when the group is read-only (`team_plan_writable`).
-- 4. **Through functions only.** No client reads or writes these tables; `get_plan` answers the group's current
--    members. It returns no count of actions per person (handoff 6.8 and section 11): each action names its
--    owner, as the design's list does, and nothing adds them up by person.
-- 5. **Nothing is deleted here.** A closed focus area and a done action keep their rows, with a state and a
--    date; their group's removal takes them. A person's removal takes the actions they own (the owner is
--    never empty) and clears who created or closed a row.

-- ---------------------------------------------------------------- focus areas
create table app.focus_area (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  factor_id uuid not null references app.factor (id),
  -- the released round of the Full diagnostic it was chosen from
  round_id uuid not null references app.assessment_round (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid references app.person (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references app.person (id) on delete set null,
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  unique (id, team_id),
  check ((status = 'closed') = (closed_at is not null))
);
create index focus_area_team_idx on app.focus_area (team_id);
create unique index focus_area_active_uidx on app.focus_area (team_id, factor_id) where status = 'active';
comment on table app.focus_area is
  'A group''s focus areas (handoff 6.13): a scale chosen from a released round, at most active_focus_areas active at once. No client reads it.';

-- at most `active_focus_areas` active per group, counted under the group's lock; a focus area never moves to
-- another group or scale, and only closes. A person's removal may clear created_by or closed_by (on delete
-- set null): that is the only other change it allows.
create function app.focus_area_guard() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.org_id, old.team_id, old.factor_id, old.round_id, old.created_at)
       is distinct from (new.org_id, new.team_id, new.factor_id, new.round_id, new.created_at) then
      raise exception 'a focus area never changes its group, scale or round' using errcode = 'check_violation';
    end if;
    if new.status <> old.status and not (old.status = 'active' and new.status = 'closed') then
      raise exception 'a closed focus area stays closed' using errcode = 'check_violation';
    end if;
    if old.status = 'closed' and (old.closed_at is distinct from new.closed_at
                                  or (new.closed_by is not null and new.closed_by is distinct from old.closed_by)) then
      raise exception 'a closed focus area never changes' using errcode = 'check_violation';
    end if;
    if new.created_by is not null and new.created_by is distinct from old.created_by then
      raise exception 'a focus area keeps who made it' using errcode = 'check_violation';
    end if;
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform 1 from app.team t where t.id = new.team_id for update;
    if (select count(*) from app.focus_area f where f.team_id = new.team_id and f.status = 'active' and f.id <> new.id)
       >= app.setting_int('active_focus_areas') then
      raise exception 'at most % active focus areas', app.setting_int('active_focus_areas') using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger focus_area_guard before insert or update on app.focus_area for each row execute function app.focus_area_guard();

-- ---------------------------------------------------------------- actions
create table app.action (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  -- the focus area it serves; every action added in this milestone has one (a meeting's actions come later)
  focus_area_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  -- never empty: an action without an owner cannot be stored (milestone 12)
  owner_id uuid not null references app.person (id) on delete cascade,
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz,
  created_by uuid references app.person (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  foreign key (focus_area_id, team_id) references app.focus_area (id, team_id) on delete cascade,
  check ((status = 'done') = (done_at is not null))
);
create index action_team_idx on app.action (team_id);
create index action_focus_area_idx on app.action (focus_area_id);
create index action_owner_idx on app.action (owner_id);
comment on table app.action is
  'A group''s actions (handoff 6.13): a title, an owner and a due date, open or done. Each open action goes on the next agenda. No client reads it.';

create function app.action_guard() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.org_id, old.team_id, old.focus_area_id, old.created_at) is distinct from (new.org_id, new.team_id, new.focus_area_id, new.created_at) then
    raise exception 'an action never moves to another group or focus area' using errcode = 'check_violation';
  end if;
  if new.created_by is not null and new.created_by is distinct from old.created_by then
    raise exception 'an action keeps who added it' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger action_guard before update on app.action for each row execute function app.action_guard();

-- ---------------------------------------------------------------- who may write
create function app.plan_writable(p_team uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$ select app.team_plan_writable(p_team) and app.plan_allows(p_team, 'focus_areas') $$;
comment on function app.plan_writable(uuid) is
  'True while the group''s plan includes focus areas and it is not read-only. Internal: no client runs it.';

-- an action's due date: a day, from yesterday (a time zone ahead of UTC) to two years on
create function app.due_date_ok(p_due date) returns boolean
  language sql stable set search_path = ''
as $$ select p_due is not null and p_due between current_date - 1 and current_date + 730 $$;
comment on function app.due_date_ok(date) is 'Whether an action''s due date may be saved: from yesterday to two years on. Internal.';

-- whether a person is a current member of the group: an owner must be
create function app.is_current_member(p_team uuid, p_person uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app.membership m
    where m.team_id = p_team and m.person_id = p_person
      and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now()))
$$;
comment on function app.is_current_member(uuid, uuid) is 'Whether a named person is a current member of the group. Internal: no client runs it.';

-- ---------------------------------------------------------------- reading the plan
create function app.get_plan(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then jsonb_build_object(
    'focus_areas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', f.id, 'scale', x.key, 'name', x.name ->> 'en', 'round', f.round_id, 'status', f.status,
          'created_at', f.created_at, 'closed_at', f.closed_at,
          'actions', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', a.id, 'title', a.title, 'owner', a.owner_id, 'owner_name', p.display_name,
                'owner_current', app.is_current_member(p_team, a.owner_id),
                'due_on', a.due_on, 'status', a.status, 'done_at', a.done_at,
                'mine', a.owner_id = auth.uid(),
                'can_edit', (a.owner_id = auth.uid() or app.is_team_leader(p_team)) and app.plan_writable(p_team))
              order by a.status = 'done', a.due_on, a.created_at, a.id)
            from app.action a join app.person p on p.id = a.owner_id
            where a.focus_area_id = f.id), '[]'::jsonb))
        order by f.status = 'closed', coalesce(f.closed_at, f.created_at) desc, f.id)
      from app.focus_area f join app.factor x on x.id = f.factor_id
      where f.team_id = p_team), '[]'::jsonb),
    -- who may own an action: the group's current members
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('person', m.person_id, 'name', p.display_name, 'me', m.person_id = auth.uid())
                       order by p.display_name, m.person_id)
      from app.membership m join app.person p on p.id = m.person_id
      where m.team_id = p_team and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())), '[]'::jsonb),
    'max', app.setting_int('active_focus_areas'),
    'leader', app.is_team_leader(p_team),
    'can_edit', app.plan_writable(p_team),
    'can_choose', app.is_team_leader(p_team) and app.plan_writable(p_team)) end
$$;
comment on function app.get_plan(uuid) is
  'For the group''s current members: its focus areas, active first, each with its actions; the members who may own one; and what the caller may do. No count per person.';

-- ---------------------------------------------------------------- focus areas
create function app.make_focus_area(p_team uuid, p_round uuid, p_scale text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_factor uuid;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  -- one of the 21 scales, from a released round of this group's Full diagnostic
  select x.id into v_factor from app.factor x where x.key = p_scale and x.layer <> 'outcomes';
  if v_factor is null or not exists (select 1 from app.assessment_round r
                                     where r.id = p_round and r.team_id = p_team and r.kind = 'diagnostic' and r.phase = 'released') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select t.org_id into v_org from app.team t where t.id = p_team for update;
  if exists (select 1 from app.focus_area f where f.team_id = p_team and f.factor_id = v_factor and f.status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  if (select count(*) from app.focus_area f where f.team_id = p_team and f.status = 'active') >= app.setting_int('active_focus_areas') then
    return jsonb_build_object('ok', false, 'reason', 'full', 'max', app.setting_int('active_focus_areas'));
  end if;
  insert into app.focus_area (org_id, team_id, factor_id, round_id, created_by)
  values (v_org, p_team, v_factor, p_round, v_uid)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'focus_area', v_id);
end $$;
comment on function app.make_focus_area(uuid, uuid, text) is
  'The leader makes a scale of a released round a focus area: {ok, focus_area}, or full while active_focus_areas are active.';

create function app.close_focus_area(p_team uuid, p_focus_area uuid) returns jsonb
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
  if not app.plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  update app.focus_area set status = 'closed', closed_at = now(), closed_by = v_uid
  where id = p_focus_area and team_id = p_team and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.close_focus_area(uuid, uuid) is
  'The leader closes an active focus area. Its row and its actions stay; a place opens for another.';

-- ---------------------------------------------------------------- actions
create function app.add_action(p_team uuid, p_focus_area uuid, p_title text, p_owner uuid, p_due date) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_org uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_member(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  -- an owner who is a current member: an action without one is refused (milestone 12)
  if p_owner is null or not app.is_current_member(p_team, p_owner) then
    return jsonb_build_object('ok', false, 'reason', 'no_owner');
  end if;
  if length(v_title) not between 1 and 200 or not app.due_date_ok(p_due) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select f.org_id into v_org from app.focus_area f where f.id = p_focus_area and f.team_id = p_team and f.status = 'active';
  if v_org is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into app.action (org_id, team_id, focus_area_id, title, owner_id, due_on, created_by)
  values (v_org, p_team, p_focus_area, v_title, p_owner, p_due, v_uid);
  return jsonb_build_object('ok', true);
end $$;
comment on function app.add_action(uuid, uuid, text, uuid, date) is
  'A member adds an action to an active focus area: a title, an owner who is a current member, and a due date. Without an owner it is refused.';

create function app.update_action(p_team uuid, p_action uuid, p_title text, p_owner uuid, p_due date) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_a app.action%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_member(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  select * into v_a from app.action a where a.id = p_action and a.team_id = p_team for update;
  if v_a.id is null or v_a.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_a.owner_id <> v_uid and not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;
  if p_owner is null or not app.is_current_member(p_team, p_owner) then
    return jsonb_build_object('ok', false, 'reason', 'no_owner');
  end if;
  -- a date already saved may stay, though it has passed; a new one is from yesterday to two years on
  if length(v_title) not between 1 and 200 or p_due is null or (p_due <> v_a.due_on and not app.due_date_ok(p_due)) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.action set title = v_title, owner_id = p_owner, due_on = p_due, updated_at = now() where id = v_a.id;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.update_action(uuid, uuid, text, uuid, date) is
  'The action''s owner or the leader changes an open action''s title, owner and due date. The owner is a current member.';

create function app.set_action_done(p_team uuid, p_action uuid, p_done boolean) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a app.action%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_member(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.plan_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  select * into v_a from app.action a where a.id = p_action and a.team_id = p_team for update;
  if v_a.id is null or p_done is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_a.owner_id <> v_uid and not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;
  update app.action
  set status = case when p_done then 'done' else 'open' end,
      done_at = case when p_done then coalesce(v_a.done_at, now()) end,
      updated_at = now()
  where id = v_a.id;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.set_action_done(uuid, uuid, boolean) is 'The action''s owner or the leader marks it done, or open again.';

-- ---------------------------------------------------------------- access
alter table app.focus_area enable row level security;
alter table app.action enable row level security;
revoke all on app.focus_area, app.action from anon, authenticated, service_role;

grant execute on function app.get_plan(uuid), app.make_focus_area(uuid, uuid, text), app.close_focus_area(uuid, uuid),
  app.add_action(uuid, uuid, text, uuid, date), app.update_action(uuid, uuid, text, uuid, date),
  app.set_action_done(uuid, uuid, boolean)
  to authenticated;
