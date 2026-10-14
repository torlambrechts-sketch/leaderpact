-- 0018_agenda.sql — meetings and their agendas, with the task match and the time check (handoff 6.14;
-- milestone 13: "An unmatched item is flagged and can be confirmed. Open actions appear on the agenda"; D-47).
--
-- 1. **A meeting** has a title, a day, a start time and a length, as the leader plans it. The day and time are
--    the group's wall clock, as entered: the product holds no time zone per person yet (handoff 6.18).
-- 2. **The agenda template** is a versioned row (handoff 9): the four item types, the closing item ("one thing
--    to keep, one to change") and a meeting's usual length. A new meeting starts with the closing item, owned
--    by the leader; the leader can remove it. Its wording is the design's (`Reflection`).
-- 3. **Any member proposes an item.** An item is ready with a type, a desired outcome, an owner and a time box.
--    Its proposer, its owner or the leader changes it; its proposer or the leader removes it. A removed item
--    keeps its row, with a date.
-- 4. **The task match.** An item names one of the team tasks of the charter in force, or none. With none it is
--    flagged, and stays flagged until it names a task or the leader confirms it. With no team tasks in force
--    the check is off, and the page asks the leader to define them. The closing item is about the meeting
--    itself, so it is never flagged.
-- 5. **The time check** is the items' minutes against the meeting's length, worked out by the reader.
-- 6. **Open actions on the next agenda.** The next meeting is the group's first planned one from today. Its
--    agenda lists every open action of the group, with its owner and due date (handoff 6.13).
-- 7. **Through functions only**, the Team plan's (`meetings`) and not when read-only (`meetings_writable`).
--    Nothing is deleted here; a meeting's removal, with its group, takes its items.

-- ---------------------------------------------------------------- the agenda template (handoff 9)
create table app.agenda_template (
  version int primary key check (version > 0),
  item_types text[] not null check (item_types = array['information', 'discussion', 'decision', 'follow_up']),
  -- {"title": {"en"}, "outcome": {"en"}, "type", "minutes"}
  closing jsonb not null check (
    jsonb_typeof(closing -> 'title') = 'object' and closing -> 'title' ? 'en'
    and jsonb_typeof(closing -> 'outcome') = 'object' and closing -> 'outcome' ? 'en'
    and closing ->> 'type' in ('information', 'discussion', 'decision', 'follow_up')
    and (closing ->> 'minutes')::int between 1 and 60),
  meeting_minutes int not null check (meeting_minutes between 15 and 480),
  max_items int not null check (max_items between 1 and 60),
  valid_from timestamptz not null
);
comment on table app.agenda_template is
  'The agenda template, versioned (handoff 9): the four item types, the closing item and a meeting''s usual length.';
-- version 1: the closing item as the design draws it (proto-core-v5.js and data/sample, "Reflection");
-- a meeting of 90 minutes, as the design's; 30 items, this build's limit
insert into app.agenda_template (version, item_types, closing, meeting_minutes, max_items, valid_from) values
  (1, array['information', 'discussion', 'decision', 'follow_up'],
   '{"title": {"en": "Reflection"}, "outcome": {"en": "One thing to keep and one to change."}, "type": "information", "minutes": 5}',
   90, 30, '2026-01-01T00:00:00Z');

create function app.agenda_template_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  raise exception 'an agenda template never changes: add a version instead' using errcode = 'check_violation';
end $$;
create trigger agenda_template_fixed before update on app.agenda_template for each row execute function app.agenda_template_fixed();

-- ---------------------------------------------------------------- meetings
create table app.meeting (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 120),
  -- the group's wall clock, as the leader entered it
  meets_on date not null,
  starts_at time not null,
  minutes int not null check (minutes between 15 and 480),
  template_version int not null references app.agenda_template (version),
  status text not null default 'planned' check (status in ('planned', 'live', 'held', 'cancelled')),
  created_by uuid references app.person (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  unique (id, team_id)
);
create index meeting_team_idx on app.meeting (team_id, meets_on);
comment on table app.meeting is 'A group''s meetings (handoff 6.14): title, day, start and length, on the group''s wall clock. No client reads it.';

create function app.meeting_guard() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.org_id, old.team_id, old.template_version, old.created_at) is distinct from (new.org_id, new.team_id, new.template_version, new.created_at) then
    raise exception 'a meeting never moves to another group or template' using errcode = 'check_violation';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'a cancelled meeting stays cancelled' using errcode = 'check_violation';
  end if;
  if new.created_by is not null and new.created_by is distinct from old.created_by then
    raise exception 'a meeting keeps who planned it' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger meeting_guard before update on app.meeting for each row execute function app.meeting_guard();

-- ---------------------------------------------------------------- agenda items
create table app.agenda_item (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  meeting_id uuid not null,
  ordinal int not null check (ordinal > 0),
  title text not null check (length(btrim(title)) between 1 and 200),
  -- ready needs all four: a type, a desired outcome, an owner and a time box
  type text check (type in ('information', 'discussion', 'decision', 'follow_up')),
  outcome text check (outcome is null or length(btrim(outcome)) between 1 and 300),
  owner_id uuid references app.person (id) on delete set null,
  minutes int check (minutes between 1 and 240),
  -- a team task of the charter in force when it was named; none is flagged until the leader confirms
  team_task_id uuid references app.team_task (id) on delete set null,
  task_confirmed boolean not null default false,
  confirmed_by uuid references app.person (id) on delete set null,
  -- the template's closing item: never flagged; the leader alone removes it
  closing boolean not null default false,
  removed_at timestamptz,
  proposed_by uuid references app.person (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  foreign key (meeting_id, team_id) references app.meeting (id, team_id) on delete cascade,
  unique (meeting_id, ordinal)
);
create index agenda_item_meeting_idx on app.agenda_item (meeting_id);
create unique index agenda_item_closing_uidx on app.agenda_item (meeting_id) where closing and removed_at is null;
comment on table app.agenda_item is
  'A meeting''s agenda items (handoff 6.14): type, desired outcome, owner, time box and team task. A removed item keeps its row. No client reads it.';

create function app.agenda_item_guard() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.org_id, old.team_id, old.meeting_id, old.closing, old.created_at) is distinct from (new.org_id, new.team_id, new.meeting_id, new.closing, new.created_at) then
    raise exception 'an agenda item never moves to another meeting' using errcode = 'check_violation';
  end if;
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'a removed agenda item stays removed' using errcode = 'check_violation';
  end if;
  if new.proposed_by is not null and new.proposed_by is distinct from old.proposed_by then
    raise exception 'an agenda item keeps who proposed it' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger agenda_item_guard before update on app.agenda_item for each row execute function app.agenda_item_guard();

-- ---------------------------------------------------------------- the rules
create function app.meetings_writable(p_team uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$ select app.team_plan_writable(p_team) and app.plan_allows(p_team, 'meetings') $$;
comment on function app.meetings_writable(uuid) is
  'True while the group''s plan includes meetings and it is not read-only. Internal: no client runs it.';

-- the team tasks of the charter in force: what an item may name
create function app.tasks_in_force(p_team uuid) returns setof uuid
  language sql stable security definer set search_path = ''
as $$
  select t.id from app.team_task t join app.charter_version v on v.id = t.version_id
  where v.team_id = p_team and v.status = 'in_force'
$$;
comment on function app.tasks_in_force(uuid) is 'The ids of the team tasks of the group''s charter in force. Internal: no client runs it.';

-- the group's next meeting: its first planned one from today
create function app.next_meeting(p_team uuid) returns uuid
  language sql stable security definer set search_path = ''
as $$
  select m.id from app.meeting m
  where m.team_id = p_team and m.status = 'planned' and m.meets_on >= current_date
  order by m.meets_on, m.starts_at, m.created_at, m.id
  limit 1
$$;
comment on function app.next_meeting(uuid) is 'The group''s next meeting: its first planned one from today. Internal: no client runs it.';

-- an item's fields, checked: type, outcome, owner, minutes and task may each be missing, never wrong
create function app.agenda_item_ok(p_team uuid, p_title text, p_type text, p_outcome text, p_owner uuid, p_minutes int, p_task uuid)
  returns text
  language sql stable security definer set search_path = ''
as $$
  select case
    when length(btrim(coalesce(p_title, ''))) not between 1 and 200
      or (p_type is not null and p_type not in ('information', 'discussion', 'decision', 'follow_up'))
      or (p_outcome is not null and length(btrim(p_outcome)) > 300)
      or (p_minutes is not null and p_minutes not between 1 and 240) then 'invalid'
    when p_owner is not null and not app.is_current_member(p_team, p_owner) then 'no_owner'
    when p_task is not null and p_task not in (select app.tasks_in_force(p_team)) then 'no_task'
    else null end
$$;
comment on function app.agenda_item_ok(uuid, text, text, text, uuid, int, uuid) is
  'Why an agenda item''s fields cannot be saved, or null. Internal: no client runs it.';

-- ---------------------------------------------------------------- reading
create function app.get_meetings(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then jsonb_build_object(
    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', m.id, 'title', m.title, 'meets_on', m.meets_on, 'starts_at', to_char(m.starts_at, 'HH24:MI'), 'minutes', m.minutes,
          'status', m.status, 'next', m.id = app.next_meeting(p_team))
        order by m.meets_on desc, m.starts_at desc, m.id)
      from app.meeting m where m.team_id = p_team and m.status <> 'cancelled'), '[]'::jsonb),
    'next', app.next_meeting(p_team),
    'meeting_minutes', (select t.meeting_minutes from app.agenda_template t where t.valid_from <= now() order by t.version desc limit 1),
    'leader', app.is_team_leader(p_team),
    'can_plan', app.is_team_leader(p_team) and app.meetings_writable(p_team)) end
$$;
comment on function app.get_meetings(uuid) is 'For the group''s current members: its meetings, the next one marked, and whether the caller may plan one.';

create function app.get_agenda(p_meeting uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  with m as (select * from app.meeting x where x.id = p_meeting and x.status <> 'cancelled' and app.is_team_member(x.team_id)),
       tasks as (select t.id, t.title, t.ordinal from app.team_task t join app.charter_version v on v.id = t.version_id
                 join m on v.team_id = m.team_id where v.status = 'in_force'),
       w as (select app.meetings_writable(m.team_id) as writable, app.is_team_leader(m.team_id) as leader, m.team_id from m)
  select jsonb_build_object(
    'meeting', jsonb_build_object('id', m.id, 'title', m.title, 'meets_on', m.meets_on, 'starts_at', to_char(m.starts_at, 'HH24:MI'),
                                  'minutes', m.minutes, 'status', m.status, 'next', m.id = app.next_meeting(m.team_id)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'type', i.type, 'outcome', i.outcome,
          'owner', i.owner_id, 'owner_name', p.display_name,
          'owner_current', i.owner_id is not null and app.is_current_member(m.team_id, i.owner_id),
          'minutes', i.minutes,
          'task', case when i.team_task_id in (select id from tasks) then i.team_task_id end,
          'task_title', (select t.title from tasks t where t.id = i.team_task_id),
          'confirmed', i.task_confirmed, 'closing', i.closing,
          'ready', i.type is not null and i.outcome is not null and i.owner_id is not null and i.minutes is not null
                   and app.is_current_member(m.team_id, i.owner_id),
          -- flagged: names no team task in force, is not the closing item, and the leader has not kept it
          'flagged', exists (select 1 from tasks) and not i.closing and not i.task_confirmed
                     and (i.team_task_id is null or i.team_task_id not in (select id from tasks)),
          'can_edit', w.writable and m.status = 'planned'
                      and (w.leader or i.proposed_by = auth.uid() or i.owner_id = auth.uid()),
          'can_remove', w.writable and m.status = 'planned'
                        and (w.leader or (i.proposed_by = auth.uid() and not i.closing)))
        order by i.closing, i.ordinal)
      from app.agenda_item i left join app.person p on p.id = i.owner_id
      where i.meeting_id = m.id and i.removed_at is null), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title) order by t.ordinal) from tasks t), '[]'::jsonb),
    -- every open action of the group, on its next agenda only
    'open_actions', case when m.id = app.next_meeting(m.team_id) then coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'owner_name', p.display_name, 'due_on', a.due_on,
                                          'focus', x.name ->> 'en')
                       order by a.due_on, a.created_at, a.id)
      from app.action a join app.person p on p.id = a.owner_id
      left join app.focus_area f on f.id = a.focus_area_id left join app.factor x on x.id = f.factor_id
      where a.team_id = m.team_id and a.status = 'open'), '[]'::jsonb) end,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('person', mb.person_id, 'name', p.display_name, 'me', mb.person_id = auth.uid())
                       order by p.display_name, mb.person_id)
      from app.membership mb join app.person p on p.id = mb.person_id
      where mb.team_id = m.team_id and mb.valid_from <= now() and (mb.valid_to is null or mb.valid_to > now())), '[]'::jsonb),
    'max_items', (select t.max_items from app.agenda_template t where t.version = m.template_version),
    'leader', w.leader,
    'can_propose', w.writable and m.status = 'planned',
    'can_manage', w.writable and w.leader and m.status = 'planned')
  from m, w
$$;
comment on function app.get_agenda(uuid) is
  'For the group''s current members: a meeting''s agenda, each item ready or not and flagged or not; the team tasks in force; and, on the next agenda, every open action.';

-- ---------------------------------------------------------------- meetings
create function app.plan_meeting(p_team uuid, p_title text, p_on date, p_at time, p_minutes int) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_t app.agenda_template%rowtype;
  v_org uuid;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.meetings_writable(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 1 and 120 or p_on is null or p_at is null
     or p_on not between current_date - 1 and current_date + 730 or p_minutes is null or p_minutes not between 15 and 480 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into v_t from app.agenda_template t where t.valid_from <= now() order by t.version desc limit 1;
  select t.org_id into v_org from app.team t where t.id = p_team;
  insert into app.meeting (org_id, team_id, title, meets_on, starts_at, minutes, template_version, created_by)
  values (v_org, p_team, btrim(p_title), p_on, p_at, p_minutes, v_t.version, v_uid)
  returning id into v_id;
  -- the template's closing item, owned by the leader
  insert into app.agenda_item (org_id, team_id, meeting_id, ordinal, title, type, outcome, owner_id, minutes, closing, proposed_by)
  values (v_org, p_team, v_id, 1, v_t.closing -> 'title' ->> 'en', v_t.closing ->> 'type', v_t.closing -> 'outcome' ->> 'en', v_uid,
          (v_t.closing ->> 'minutes')::int, true, v_uid);
  return jsonb_build_object('ok', true, 'meeting', v_id);
end $$;
comment on function app.plan_meeting(uuid, text, date, time, int) is
  'The leader plans a meeting: title, day, start and length. Its agenda starts with the template''s closing item.';

create function app.update_meeting(p_meeting uuid, p_title text, p_on date, p_at time, p_minutes int) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_m app.meeting%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_m from app.meeting m where m.id = p_meeting for update;
  if v_m.id is null or not app.is_team_leader(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.meetings_writable(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if v_m.status <> 'planned' or length(btrim(coalesce(p_title, ''))) not between 1 and 120 or p_on is null or p_at is null
     or (p_on <> v_m.meets_on and p_on not between current_date - 1 and current_date + 730)
     or p_minutes is null or p_minutes not between 15 and 480 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.meeting set title = btrim(p_title), meets_on = p_on, starts_at = p_at, minutes = p_minutes, updated_at = now() where id = v_m.id;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.update_meeting(uuid, text, date, time, int) is 'The leader changes a planned meeting''s title, day, start and length.';

create function app.cancel_meeting(p_meeting uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_m app.meeting%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_m from app.meeting m where m.id = p_meeting for update;
  if v_m.id is null or not app.is_team_leader(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.meetings_writable(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if v_m.status <> 'planned' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.meeting set status = 'cancelled', updated_at = now() where id = v_m.id;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.cancel_meeting(uuid) is 'The leader cancels a planned meeting. Its row and its agenda stay.';

-- ---------------------------------------------------------------- agenda items
create function app.propose_item(p_meeting uuid, p_title text, p_type text, p_outcome text, p_owner uuid, p_minutes int, p_task uuid)
  returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_m app.meeting%rowtype;
  v_why text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_m from app.meeting m where m.id = p_meeting for update;
  if v_m.id is null or not app.is_team_member(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.meetings_writable(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if v_m.status <> 'planned' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  v_why := app.agenda_item_ok(v_m.team_id, p_title, p_type, nullif(btrim(p_outcome), ''), p_owner, p_minutes, p_task);
  if v_why is not null then
    return jsonb_build_object('ok', false, 'reason', v_why);
  end if;
  if (select count(*) from app.agenda_item i where i.meeting_id = v_m.id and i.removed_at is null)
     >= (select t.max_items from app.agenda_template t where t.version = v_m.template_version) then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  insert into app.agenda_item (org_id, team_id, meeting_id, ordinal, title, type, outcome, owner_id, minutes, team_task_id, proposed_by)
  values (v_m.org_id, v_m.team_id, v_m.id,
          (select coalesce(max(i.ordinal), 0) + 1 from app.agenda_item i where i.meeting_id = v_m.id),
          btrim(p_title), p_type, nullif(btrim(p_outcome), ''), p_owner, p_minutes, p_task, v_uid);
  return jsonb_build_object('ok', true);
end $$;
comment on function app.propose_item(uuid, text, text, text, uuid, int, uuid) is
  'Any member proposes an agenda item; its type, outcome, owner, time box and team task may wait. Without a team task it is flagged.';

create function app.update_item(p_item uuid, p_title text, p_type text, p_outcome text, p_owner uuid, p_minutes int, p_task uuid)
  returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_i app.agenda_item%rowtype;
  v_why text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_i from app.agenda_item i where i.id = p_item and i.removed_at is null for update;
  if v_i.id is null or not app.is_team_member(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.meetings_writable(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if not (app.is_team_leader(v_i.team_id) or v_i.proposed_by = v_uid or v_i.owner_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if (select m.status from app.meeting m where m.id = v_i.meeting_id) <> 'planned' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  v_why := app.agenda_item_ok(v_i.team_id, p_title, p_type, nullif(btrim(p_outcome), ''), p_owner, p_minutes, p_task);
  if v_why is not null then
    return jsonb_build_object('ok', false, 'reason', v_why);
  end if;
  update app.agenda_item
  set title = btrim(p_title), type = p_type, outcome = nullif(btrim(p_outcome), ''), owner_id = p_owner, minutes = p_minutes,
      team_task_id = p_task,
      -- naming a task makes the leader's keeping moot; dropping it asks again
      task_confirmed = v_i.task_confirmed and p_task is null and v_i.team_task_id is null,
      confirmed_by = case when v_i.task_confirmed and p_task is null and v_i.team_task_id is null then v_i.confirmed_by end,
      updated_at = now()
  where id = v_i.id;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.update_item(uuid, text, text, text, uuid, int, uuid) is
  'An agenda item''s proposer, its owner or the leader changes it. Dropping its team task flags it again.';

-- "It stays if the leader confirms it" (handoff 6.14)
create function app.confirm_item(p_item uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_i app.agenda_item%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_i from app.agenda_item i where i.id = p_item and i.removed_at is null for update;
  if v_i.id is null or not app.is_team_leader(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not app.meetings_writable(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  -- only a flagged item: one that names no team task in force, while the check is on
  if v_i.closing or v_i.task_confirmed or (select m.status from app.meeting m where m.id = v_i.meeting_id) <> 'planned'
     or not exists (select 1 from app.tasks_in_force(v_i.team_id))
     or (v_i.team_task_id is not null and v_i.team_task_id in (select app.tasks_in_force(v_i.team_id))) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.agenda_item set task_confirmed = true, confirmed_by = v_uid, team_task_id = null, updated_at = now() where id = v_i.id;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.confirm_item(uuid) is 'The leader keeps a flagged agenda item, one that names no team task: it stays, no longer flagged.';

create function app.remove_item(p_item uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_i app.agenda_item%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_i from app.agenda_item i where i.id = p_item and i.removed_at is null for update;
  if v_i.id is null or not app.is_team_member(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.meetings_writable(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  -- the closing item is the leader's to remove (handoff 6.14); any other, its proposer's or the leader's
  if not (app.is_team_leader(v_i.team_id) or (v_i.proposed_by = v_uid and not v_i.closing)) then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if (select m.status from app.meeting m where m.id = v_i.meeting_id) <> 'planned' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.agenda_item set removed_at = now(), updated_at = now() where id = v_i.id;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.remove_item(uuid) is 'An agenda item''s proposer or the leader takes it off the agenda; the closing item, the leader alone. Its row stays.';

-- ---------------------------------------------------------------- access
alter table app.agenda_template enable row level security;
alter table app.meeting enable row level security;
alter table app.agenda_item enable row level security;
revoke all on app.agenda_template, app.meeting, app.agenda_item from anon, authenticated, service_role;

grant execute on function app.get_meetings(uuid), app.get_agenda(uuid), app.plan_meeting(uuid, text, date, time, int),
  app.update_meeting(uuid, text, date, time, int), app.cancel_meeting(uuid),
  app.propose_item(uuid, text, text, text, uuid, int, uuid), app.update_item(uuid, text, text, text, uuid, int, uuid),
  app.confirm_item(uuid), app.remove_item(uuid)
  to authenticated;
