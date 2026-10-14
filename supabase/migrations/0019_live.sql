-- 0019_live.sql — the live meeting over Realtime (handoff 6.15; milestone 14: "Two browsers stay in sync within
-- 1 second. Comments carry no sender"; D-48).
--
-- 1. **One live meeting per group.** The leader starts a planned meeting, runs it item by item and ends it:
--    planned, then live, then held. The current item has a timer (start, pause, plus 5 minutes); each item
--    closes as reached, carried over or parked. An item carried over goes on to the group's next planned
--    meeting, now or when that meeting is planned.
-- 2. **Sync.** Every change bumps a version on `meeting_signal`, one narrow row per live meeting, which
--    Supabase Realtime sends to the meeting's current members (Postgres changes, under its row-level
--    security). The page then reads the meeting through `get_live`. The signal holds a version and the last
--    process comment's kind and item: nothing else, so a change carries no content and no sender.
-- 3. **Process comments carry no sender** (handoff 6.15; REUSE 4.10): a kind and an item, no person and no
--    time, written only by `send_process_comment`. It refuses while fewer than the group's threshold (4 unless
--    raised) are online, counted in a presence table that shares no key with the comments. They are deleted
--    when the meeting ends ("as long as the meeting", handoff 8).
-- 4. **Decisions and actions save per item**; the parking lot holds side topics, with no name on them. An
--    action from a meeting belongs to its item, with an owner and a due date, and goes on the next agenda.
-- 5. **The `live_meeting` flag** (handoff 8, Feature flags) is a row. When it is off the page does not join
--    Realtime and the meeting runs without sync; nothing is deleted.
-- 6. **Through functions only**, the Team plan's (`meetings`) and not when read-only. The readers of 0017 and
--    0018 keep their replies, so the pages already deployed read them unchanged.

-- ---------------------------------------------------------------- the flag (handoff 8)
create table app.feature_flag (
  key text primary key check (key in ('live_meeting')),
  "on" boolean not null,
  updated_at timestamptz not null default now()
);
comment on table app.feature_flag is 'Feature flags as rows (handoff 8): only live_meeting in the MVP. Turning one off never deletes data.';
insert into app.feature_flag (key, "on") values ('live_meeting', true);

create function app.flag_on(p_key text) returns boolean
  language sql stable security definer set search_path = ''
as $$ select coalesce((select f."on" from app.feature_flag f where f.key = p_key), false) $$;
comment on function app.flag_on(text) is 'Whether a feature flag is on; an unknown or unread flag is off. Internal: get_live tells the page.';

-- ---------------------------------------------------------------- the meeting, live
alter table app.meeting
  add column current_item_id uuid,
  add column timer_started_at timestamptz,
  add column started_at timestamptz,
  add column ended_at timestamptz;
alter table app.meeting add constraint meeting_current_item_fk foreign key (current_item_id) references app.agenda_item (id) on delete set null;
create unique index meeting_one_live_uidx on app.meeting (team_id) where status = 'live';

alter table app.agenda_item
  add column extra_minutes int not null default 0 check (extra_minutes between 0 and 240),
  add column elapsed_seconds int not null default 0 check (elapsed_seconds >= 0),
  add column closed_as text check (closed_as in ('reached', 'carried_over', 'parked')),
  add column carried_from uuid references app.agenda_item (id) on delete set null,
  add column carried_to uuid references app.agenda_item (id) on delete set null;

-- the meeting moves forward only: planned, then live or cancelled; live, then held
create or replace function app.meeting_guard() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.org_id, old.team_id, old.template_version, old.created_at) is distinct from (new.org_id, new.team_id, new.template_version, new.created_at) then
    raise exception 'a meeting never moves to another group or template' using errcode = 'check_violation';
  end if;
  if new.status <> old.status
     and not ((old.status = 'planned' and new.status in ('live', 'cancelled')) or (old.status = 'live' and new.status = 'held')) then
    raise exception 'a meeting moves only forward (% to %)', old.status, new.status using errcode = 'check_violation';
  end if;
  if old.status = 'held' and (old.title, old.meets_on, old.starts_at, old.minutes, old.started_at, old.ended_at)
                             is distinct from (new.title, new.meets_on, new.starts_at, new.minutes, new.started_at, new.ended_at) then
    raise exception 'a held meeting never changes' using errcode = 'check_violation';
  end if;
  if new.created_by is not null and new.created_by is distinct from old.created_by then
    raise exception 'a meeting keeps who planned it' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- an item closes once; where it was carried from never changes, and where it went is written once
create or replace function app.agenda_item_guard() returns trigger
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
  if old.closed_as is not null and new.closed_as is distinct from old.closed_as then
    raise exception 'a closed agenda item stays closed' using errcode = 'check_violation';
  end if;
  if (new.carried_from is not null and new.carried_from is distinct from old.carried_from)
     or (old.carried_to is not null and new.carried_to is not null and new.carried_to is distinct from old.carried_to) then
    raise exception 'an agenda item keeps where it was carried from and to' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- decisions, actions, the parking lot
create table app.decision (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  meeting_id uuid not null,
  agenda_item_id uuid not null unique references app.agenda_item (id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 1000),
  recorded_by uuid references app.person (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  foreign key (meeting_id, team_id) references app.meeting (id, team_id) on delete cascade
);
create index decision_meeting_idx on app.decision (meeting_id);
comment on table app.decision is 'An agenda item''s decision, saved in the live meeting (handoff 6.15). No client reads it.';

alter table app.action add column agenda_item_id uuid references app.agenda_item (id) on delete set null;
create index action_agenda_item_idx on app.action (agenda_item_id);

-- an action keeps its group, focus area and item; an item's removal with its meeting may clear the item
create or replace function app.action_guard() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.org_id, old.team_id, old.focus_area_id, old.created_at) is distinct from (new.org_id, new.team_id, new.focus_area_id, new.created_at) then
    raise exception 'an action never moves to another group or focus area' using errcode = 'check_violation';
  end if;
  if new.agenda_item_id is not null and new.agenda_item_id is distinct from old.agenda_item_id then
    raise exception 'an action never moves to another agenda item' using errcode = 'check_violation';
  end if;
  if new.created_by is not null and new.created_by is distinct from old.created_by then
    raise exception 'an action keeps who added it' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create table app.parked_topic (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  meeting_id uuid not null,
  text text not null check (length(btrim(text)) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  foreign key (meeting_id, team_id) references app.meeting (id, team_id) on delete cascade
);
create index parked_topic_meeting_idx on app.parked_topic (meeting_id);
comment on table app.parked_topic is 'The live meeting''s parking lot: side topics, with no name on them (handoff 6.15). No client reads it.';

-- ---------------------------------------------------------------- process comments: no person, no time
create table app.process_comment (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  meeting_id uuid not null,
  agenda_item_id uuid not null references app.agenda_item (id) on delete cascade,
  kind text not null check (kind in ('purpose', 'off_track')),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  foreign key (meeting_id, team_id) references app.meeting (id, team_id) on delete cascade
);
create index process_comment_meeting_idx on app.process_comment (meeting_id, agenda_item_id);
comment on table app.process_comment is
  'A process comment (handoff 6.15): a kind and an item, with no person and no time. Deleted when the meeting ends. No client reads it.';

-- who is online in a live meeting: shares no key with the comments
create table app.meeting_presence (
  meeting_id uuid not null references app.meeting (id) on delete cascade,
  person_id uuid not null references app.person (id) on delete cascade,
  seen_at timestamptz not null,
  primary key (meeting_id, person_id)
);
comment on table app.meeting_presence is 'Who is online in a live meeting, by a heartbeat (handoff 6.15). Shares no key with the process comments. No client reads it.';

-- ---------------------------------------------------------------- the signal Realtime sends
create table app.meeting_signal (
  meeting_id uuid primary key,
  team_id uuid not null,
  version bigint not null default 0,
  -- the last process comment: its kind and item, never who or when
  comment_kind text check (comment_kind in ('purpose', 'off_track')),
  comment_item uuid,
  comment_seq bigint not null default 0,
  foreign key (meeting_id, team_id) references app.meeting (id, team_id) on delete cascade
);
comment on table app.meeting_signal is
  'One row per live meeting that Realtime sends to its current members: a version and the last process comment''s kind and item. No content, no sender.';

-- the online count: members seen in the last 30 seconds
create function app.online_count(p_meeting uuid) returns int
  language sql stable security definer set search_path = ''
as $$
  select count(*)::int from app.meeting_presence p join app.meeting m on m.id = p.meeting_id
  where p.meeting_id = p_meeting and p.seen_at > now() - interval '30 seconds' and app.is_current_member(m.team_id, p.person_id)
$$;
comment on function app.online_count(uuid) is 'How many current members were seen in a meeting in the last 30 seconds. Internal: no client runs it.';

create function app.live_bump(p_meeting uuid) returns void
  language sql volatile security definer set search_path = ''
as $$ update app.meeting_signal set version = version + 1 where meeting_id = p_meeting $$;
comment on function app.live_bump(uuid) is 'Tells the meeting''s members, through Realtime, that it changed. Internal: no client runs it.';

-- the timer of the current item, stopped: its running time added to the item
create function app.live_pause(p_meeting uuid) returns void
  language sql volatile security definer set search_path = ''
as $$
  update app.agenda_item i
  set elapsed_seconds = i.elapsed_seconds + greatest(0, floor(extract(epoch from now() - m.timer_started_at))::int)
  from app.meeting m
  where m.id = p_meeting and i.id = m.current_item_id and m.timer_started_at is not null;
  update app.meeting set timer_started_at = null where id = p_meeting;
$$;
comment on function app.live_pause(uuid) is 'Stops the current item''s timer and keeps its time. Internal: no client runs it.';

-- the next item to take up: the first open one, the closing item last
create function app.live_next_item(p_meeting uuid) returns uuid
  language sql stable security definer set search_path = ''
as $$
  select i.id from app.agenda_item i
  where i.meeting_id = p_meeting and i.removed_at is null and i.closed_as is null
  order by i.closing, i.ordinal limit 1
$$;
comment on function app.live_next_item(uuid) is 'The first item of a meeting not yet closed, the closing item last. Internal: no client runs it.';

-- the next meeting is the live one while a meeting is live, so the open actions stay on its agenda (0018)
create or replace function app.next_meeting(p_team uuid) returns uuid
  language sql stable security definer set search_path = ''
as $$
  select m.id from app.meeting m
  where m.team_id = p_team and (m.status = 'live' or (m.status = 'planned' and m.meets_on >= current_date))
  order by m.status = 'live' desc, m.meets_on, m.starts_at, m.created_at, m.id
  limit 1
$$;

-- items carried over go on to the group's next planned meeting, while it has room
create function app.carry_items(p_team uuid) returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_next uuid := (select m.id from app.meeting m where m.team_id = p_team and m.status = 'planned' and m.meets_on >= current_date
                  order by m.meets_on, m.starts_at, m.created_at, m.id limit 1);
  v_i app.agenda_item%rowtype;
  v_new uuid;
  v_n int := 0;
begin
  if v_next is null then
    return 0;
  end if;
  for v_i in
    select i.* from app.agenda_item i join app.meeting m on m.id = i.meeting_id
    where i.team_id = p_team and i.closed_as = 'carried_over' and i.carried_to is null and m.status = 'held'
    order by m.meets_on, i.ordinal
  loop
    exit when (select count(*) from app.agenda_item x where x.meeting_id = v_next and x.removed_at is null)
              >= (select t.max_items from app.agenda_template t join app.meeting m on m.template_version = t.version where m.id = v_next);
    insert into app.agenda_item (org_id, team_id, meeting_id, ordinal, title, type, outcome, owner_id, minutes, team_task_id, carried_from, proposed_by)
    values (v_i.org_id, p_team, v_next, (select coalesce(max(x.ordinal), 0) + 1 from app.agenda_item x where x.meeting_id = v_next),
            v_i.title, v_i.type, v_i.outcome, v_i.owner_id, v_i.minutes,
            case when v_i.team_task_id in (select app.tasks_in_force(p_team)) then v_i.team_task_id end, v_i.id, v_i.proposed_by)
    returning id into v_new;
    update app.agenda_item set carried_to = v_new where id = v_i.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
comment on function app.carry_items(uuid) is 'Copies the items carried over into the group''s next planned meeting, while it has room. Internal: no client runs it.';

-- ---------------------------------------------------------------- reading the live meeting
create function app.get_live(p_meeting uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  with m as (select * from app.meeting x where x.id = p_meeting and x.status in ('live', 'held') and app.is_team_member(x.team_id)),
       w as (select app.meetings_writable(m.team_id) and m.status = 'live' as writable, app.is_team_leader(m.team_id) as leader,
                    app.k_threshold(m.org_id) as k, app.online_count(m.id) as online from m)
  select jsonb_build_object(
    'meeting', jsonb_build_object('id', m.id, 'title', m.title, 'status', m.status, 'meets_on', m.meets_on,
                                  'starts_at', to_char(m.starts_at, 'HH24:MI'), 'minutes', m.minutes),
    'now', now(),
    'current', m.current_item_id,
    'timer_started_at', m.timer_started_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'title', i.title, 'type', i.type, 'outcome', i.outcome,
          'owner_name', p.display_name, 'minutes', i.minutes, 'extra', i.extra_minutes, 'elapsed', i.elapsed_seconds,
          'task_title', (select t.title from app.team_task t where t.id = i.team_task_id),
          'closing', i.closing, 'closed_as', i.closed_as, 'carried', i.carried_from is not null,
          'decision', (select d.text from app.decision d where d.agenda_item_id = i.id),
          'actions', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'owner_name', ap.display_name,
                                                                   'due_on', a.due_on, 'status', a.status) order by a.created_at, a.id)
                               from app.action a join app.person ap on ap.id = a.owner_id where a.agenda_item_id = i.id), '[]'::jsonb),
          -- counts only, never who
          'comments', jsonb_build_object(
            'purpose', (select count(*)::int from app.process_comment c where c.agenda_item_id = i.id and c.kind = 'purpose'),
            'off_track', (select count(*)::int from app.process_comment c where c.agenda_item_id = i.id and c.kind = 'off_track')))
        order by i.closing, i.ordinal)
      from app.agenda_item i left join app.person p on p.id = i.owner_id
      where i.meeting_id = m.id and i.removed_at is null), '[]'::jsonb),
    'parking', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'text', t.text) order by t.created_at, t.id)
                         from app.parked_topic t where t.meeting_id = m.id), '[]'::jsonb),
    -- every open action of the group, while the meeting is live (handoff 6.13: on the next agenda)
    'open_actions', case when m.status = 'live' then coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'owner_name', p.display_name, 'due_on', a.due_on)
                       order by a.due_on, a.created_at, a.id)
      from app.action a join app.person p on p.id = a.owner_id
      where a.team_id = m.team_id and a.status = 'open'), '[]'::jsonb) end,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('person', mb.person_id, 'name', p.display_name, 'me', mb.person_id = auth.uid())
                       order by p.display_name, mb.person_id)
      from app.membership mb join app.person p on p.id = mb.person_id
      where mb.team_id = m.team_id and mb.valid_from <= now() and (mb.valid_to is null or mb.valid_to > now())), '[]'::jsonb),
    'online', w.online,
    'k', w.k,
    'comments_open', w.writable and w.online >= w.k,
    'sync', app.flag_on('live_meeting'),
    'leader', w.leader,
    'can_run', w.writable and w.leader,
    'can_add', w.writable)
  from m, w
$$;
comment on function app.get_live(uuid) is
  'For the group''s current members: a live or held meeting, its current item and timer, each item''s decision, actions and comment counts, the parking lot, and who may do what. Never who commented.';

-- ---------------------------------------------------------------- running the meeting
create function app.start_meeting(p_meeting uuid) returns jsonb
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
  if v_m.status <> 'planned' or exists (select 1 from app.meeting x where x.team_id = v_m.team_id and x.status = 'live') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.meeting set status = 'live', started_at = now(), current_item_id = app.live_next_item(v_m.id), updated_at = now()
  where id = v_m.id;
  insert into app.meeting_signal (meeting_id, team_id) values (v_m.id, v_m.team_id)
  on conflict (meeting_id) do update set version = app.meeting_signal.version + 1;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.start_meeting(uuid) is 'The leader starts a planned meeting: it goes live, at its first item, with the timer stopped. One live meeting per group.';

-- the leader's controls: start, pause, plus 5 minutes, take up an item, close the current one
create function app.run_meeting(p_meeting uuid, p_do text, p_item uuid default null) returns jsonb
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
  if v_m.status <> 'live' or p_do is null
     or p_do not in ('start', 'pause', 'extend', 'take', 'reached', 'carried_over', 'parked') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_do = 'take' then
    if not exists (select 1 from app.agenda_item i where i.id = p_item and i.meeting_id = v_m.id and i.removed_at is null and i.closed_as is null) then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    perform app.live_pause(v_m.id);
    update app.meeting set current_item_id = p_item, updated_at = now() where id = v_m.id;
  elsif v_m.current_item_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  elsif p_do = 'start' then
    update app.meeting set timer_started_at = coalesce(timer_started_at, now()), updated_at = now() where id = v_m.id;
  elsif p_do = 'pause' then
    perform app.live_pause(v_m.id);
  elsif p_do = 'extend' then
    update app.agenda_item set extra_minutes = least(240, extra_minutes + 5), updated_at = now() where id = v_m.current_item_id;
  else
    -- reached, carried over or parked: the item closes, and the next open one is taken up
    perform app.live_pause(v_m.id);
    update app.agenda_item set closed_as = p_do, updated_at = now() where id = v_m.current_item_id;
    update app.meeting set current_item_id = app.live_next_item(v_m.id), updated_at = now() where id = v_m.id;
  end if;
  perform app.live_bump(v_m.id);
  return jsonb_build_object('ok', true);
end $$;
comment on function app.run_meeting(uuid, text, uuid) is
  'The leader runs a live meeting: start or pause the timer, add 5 minutes, take up an item, or close the current one as reached, carried over or parked.';

create function app.end_meeting(p_meeting uuid) returns jsonb
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
  if v_m.status <> 'live' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  perform app.live_pause(v_m.id);
  update app.meeting set status = 'held', ended_at = now(), current_item_id = null, updated_at = now() where id = v_m.id;
  -- process comments last as long as the meeting (handoff 8)
  delete from app.process_comment where meeting_id = v_m.id;
  perform app.carry_items(v_m.team_id);
  perform app.live_bump(v_m.id);
  return jsonb_build_object('ok', true);
end $$;
comment on function app.end_meeting(uuid) is
  'The leader ends the live meeting: it is held, its process comments are deleted, and items carried over go to the next planned meeting.';

-- ---------------------------------------------------------------- what every participant may add
create function app.save_decision(p_item uuid, p_text text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_i app.agenda_item%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_i from app.agenda_item i where i.id = p_item and i.removed_at is null;
  if v_i.id is null or not app.is_team_member(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.meetings_writable(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if (select m.status from app.meeting m where m.id = v_i.meeting_id) <> 'live' or length(btrim(coalesce(p_text, ''))) not between 1 and 1000 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into app.decision (org_id, team_id, meeting_id, agenda_item_id, text, recorded_by)
  values (v_i.org_id, v_i.team_id, v_i.meeting_id, v_i.id, btrim(p_text), v_uid)
  on conflict (agenda_item_id) do update set text = excluded.text, recorded_by = excluded.recorded_by, updated_at = now();
  perform app.live_bump(v_i.meeting_id);
  return jsonb_build_object('ok', true);
end $$;
comment on function app.save_decision(uuid, text) is 'A participant saves the decision of an item in the live meeting; saving again replaces it.';

create function app.add_item_action(p_item uuid, p_title text, p_owner uuid, p_due date) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_i app.agenda_item%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_i from app.agenda_item i where i.id = p_item and i.removed_at is null;
  if v_i.id is null or not app.is_team_member(v_i.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  -- an action is the plan's as much as the meeting's (0017)
  if not (app.meetings_writable(v_i.team_id) and app.plan_writable(v_i.team_id)) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if p_owner is null or not app.is_current_member(v_i.team_id, p_owner) then
    return jsonb_build_object('ok', false, 'reason', 'no_owner');
  end if;
  if (select m.status from app.meeting m where m.id = v_i.meeting_id) <> 'live'
     or length(btrim(coalesce(p_title, ''))) not between 1 and 200 or not app.due_date_ok(p_due) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into app.action (org_id, team_id, agenda_item_id, title, owner_id, due_on, created_by)
  values (v_i.org_id, v_i.team_id, v_i.id, btrim(p_title), p_owner, p_due, v_uid);
  perform app.live_bump(v_i.meeting_id);
  return jsonb_build_object('ok', true);
end $$;
comment on function app.add_item_action(uuid, text, uuid, date) is
  'A participant adds an action to an item in the live meeting: a title, an owner who is a current member, and a due date.';

create function app.park_topic(p_meeting uuid, p_text text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_m app.meeting%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_m from app.meeting m where m.id = p_meeting;
  if v_m.id is null or not app.is_team_member(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.meetings_writable(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if v_m.status <> 'live' or length(btrim(coalesce(p_text, ''))) not between 1 and 200 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if (select count(*) from app.parked_topic t where t.meeting_id = v_m.id) >= 50 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  insert into app.parked_topic (org_id, team_id, meeting_id, text) values (v_m.org_id, v_m.team_id, v_m.id, btrim(p_text));
  perform app.live_bump(v_m.id);
  return jsonb_build_object('ok', true);
end $$;
comment on function app.park_topic(uuid, text) is 'A participant puts a side topic in the live meeting''s parking lot, with no name on it. At most 50.';

-- "What are we trying to achieve?" and "We are off track", sent without a name (handoff 6.15)
create function app.send_process_comment(p_meeting uuid, p_kind text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_m app.meeting%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_m from app.meeting m where m.id = p_meeting for update;
  if v_m.id is null or not app.is_team_member(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if not app.meetings_writable(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if v_m.status <> 'live' or v_m.current_item_id is null or p_kind is null or p_kind not in ('purpose', 'off_track') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  -- fewer online than the group's threshold: one sender could be told apart
  if app.online_count(v_m.id) < app.k_threshold(v_m.org_id) then
    return jsonb_build_object('ok', false, 'reason', 'too_few');
  end if;
  if (select count(*) from app.process_comment c where c.agenda_item_id = v_m.current_item_id) >= 50 then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;
  insert into app.process_comment (org_id, team_id, meeting_id, agenda_item_id, kind)
  values (v_m.org_id, v_m.team_id, v_m.id, v_m.current_item_id, p_kind);
  update app.meeting_signal
  set version = version + 1, comment_kind = p_kind, comment_item = v_m.current_item_id, comment_seq = comment_seq + 1
  where meeting_id = v_m.id;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.send_process_comment(uuid, text) is
  'A participant sends a process comment on the current item, with no name: refused while fewer than the group''s threshold are online.';

-- the heartbeat: the caller is online in the live meeting; answers how many are
create function app.meeting_here(p_meeting uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_m app.meeting%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select * into v_m from app.meeting m where m.id = p_meeting;
  if v_m.id is null or not app.is_team_member(v_m.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  if v_m.status <> 'live' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into app.meeting_presence (meeting_id, person_id, seen_at) values (v_m.id, v_uid, now())
  on conflict (meeting_id, person_id) do update set seen_at = excluded.seen_at;
  return jsonb_build_object('ok', true, 'online', app.online_count(v_m.id));
end $$;
comment on function app.meeting_here(uuid) is 'The caller''s heartbeat in a live meeting: {ok, online}. Presence shares no key with the process comments.';

-- ---------------------------------------------------------------- actions from meetings, for the plan
create function app.get_meeting_actions(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', a.id, 'title', a.title, 'owner', a.owner_id, 'owner_name', p.display_name,
        'owner_current', app.is_current_member(p_team, a.owner_id),
        'due_on', a.due_on, 'status', a.status, 'done_at', a.done_at,
        'mine', a.owner_id = auth.uid(),
        'can_edit', (a.owner_id = auth.uid() or app.is_team_leader(p_team)) and app.plan_writable(p_team),
        'meeting', mt.title, 'item', i.title)
      order by a.status = 'done', a.due_on, a.created_at, a.id)
    from app.action a join app.person p on p.id = a.owner_id
    left join app.agenda_item i on i.id = a.agenda_item_id left join app.meeting mt on mt.id = i.meeting_id
    where a.team_id = p_team and a.focus_area_id is null), '[]'::jsonb) end
$$;
comment on function app.get_meeting_actions(uuid) is
  'For the group''s current members: the actions made in its meetings, with owner, date and the item they came from. No count per person.';

-- ---------------------------------------------------------------- 0018's readers: "next" is false, never null
-- With no next meeting at all, 0018 compared each meeting with nothing and answered null. The replies keep
-- their keys, so the pages already deployed read them unchanged.
create or replace function app.get_meetings(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then jsonb_build_object(
    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', m.id, 'title', m.title, 'meets_on', m.meets_on, 'starts_at', to_char(m.starts_at, 'HH24:MI'), 'minutes', m.minutes,
          'status', m.status, 'next', coalesce(m.id = app.next_meeting(p_team), false))
        order by m.meets_on desc, m.starts_at desc, m.id)
      from app.meeting m where m.team_id = p_team and m.status <> 'cancelled'), '[]'::jsonb),
    'next', app.next_meeting(p_team),
    'meeting_minutes', (select t.meeting_minutes from app.agenda_template t where t.valid_from <= now() order by t.version desc limit 1),
    'leader', app.is_team_leader(p_team),
    'can_plan', app.is_team_leader(p_team) and app.meetings_writable(p_team)) end
$$;
comment on function app.get_meetings(uuid) is 'For the group''s current members: its meetings, the next one marked, and whether the caller may plan one.';

create or replace function app.get_agenda(p_meeting uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  with m as (select * from app.meeting x where x.id = p_meeting and x.status <> 'cancelled' and app.is_team_member(x.team_id)),
       tasks as (select t.id, t.title, t.ordinal from app.team_task t join app.charter_version v on v.id = t.version_id
                 join m on v.team_id = m.team_id where v.status = 'in_force'),
       w as (select app.meetings_writable(m.team_id) as writable, app.is_team_leader(m.team_id) as leader, m.team_id from m)
  select jsonb_build_object(
    'meeting', jsonb_build_object('id', m.id, 'title', m.title, 'meets_on', m.meets_on, 'starts_at', to_char(m.starts_at, 'HH24:MI'),
                                  'minutes', m.minutes, 'status', m.status, 'next', coalesce(m.id = app.next_meeting(m.team_id), false)),
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

-- ---------------------------------------------------------------- planning picks up what was carried over
create or replace function app.plan_meeting(p_team uuid, p_title text, p_on date, p_at time, p_minutes int) returns jsonb
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
  -- items carried over from a held meeting, if this is now the next one (0019)
  perform app.carry_items(p_team);
  return jsonb_build_object('ok', true, 'meeting', v_id);
end $$;

-- ---------------------------------------------------------------- access
alter table app.feature_flag enable row level security;
alter table app.decision enable row level security;
alter table app.parked_topic enable row level security;
alter table app.process_comment enable row level security;
alter table app.meeting_presence enable row level security;
alter table app.meeting_signal enable row level security;
revoke all on app.feature_flag, app.decision, app.parked_topic, app.process_comment, app.meeting_presence, app.meeting_signal
  from anon, authenticated, service_role;

-- the signal is the one row a client reads directly: Realtime delivers it under this policy, to the meeting's
-- current members only, and it holds a version and the last comment's kind and item
grant select on app.meeting_signal to authenticated;
create policy meeting_signal_members on app.meeting_signal for select to authenticated using (app.is_team_member(team_id));

-- Realtime sends the signal's changes, where the project runs Realtime (hosted, and the local Supabase stack)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table app.meeting_signal;
  end if;
end $$;

grant execute on function app.get_live(uuid), app.start_meeting(uuid), app.run_meeting(uuid, text, uuid),
  app.end_meeting(uuid), app.save_decision(uuid, text), app.add_item_action(uuid, text, uuid, date), app.park_topic(uuid, text),
  app.send_process_comment(uuid, text), app.meeting_here(uuid), app.get_meeting_actions(uuid)
  to authenticated;
