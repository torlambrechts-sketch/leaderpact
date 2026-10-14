-- 0026_retention.sql — the retention jobs of handoff 8, and the Settings Group tab's name and threshold (handoff
-- 6.18 and 8; milestone 18: "The checks of section 13 pass"; D-53 left both for it; D-56).
--
-- 1. **Team data is deleted when its retention runs out** (handoff 8: "while the subscription is active, plus 90
--    days"). The date is the one the leader is shown (`get_group_plan`, 0013): a cancel's `deletion_due_at`, or the
--    end of an unpaid trial plus the retention. On that day `purge_team_data` deletes the group's diagnostic and
--    pulse rounds with their answers, participation and scores, its meetings with their agendas, decisions and
--    parking lots, its focus areas and actions, its pulse rhythm and its charter versions. The group, its members,
--    its scans and team views, its invitations and the Leader Profiles' shares stay: they are the Free plan's.
--    `team_data_deleted_at` records that it ran, so the plan shows no date after it, and a later cancel has a date
--    of its own again.
-- 2. **A Free group with no sign-in for 12 months is deleted** (handoff 8: "deleted after 12 months without a
--    sign-in"), with its organisation when it holds no other group, the way a lone member's group goes with their
--    account (0023). "Without a sign-in" counts every current member's last sign-in and the day the group began.
--    A group with the Team plan, a trial, grace or read-only access is not a Free group. Accounts stay: a person is
--    removed only by their own delete.
-- 3. **The demo organisation is never touched** (REUSE 4.12): Lumio AS powers the demos and the sample pages.
-- 4. **Scan answers before sign-up** need no job: none is stored before the group exists (D-15). The audit trail
--    already has its job (0023), and process comments go when their meeting ends (0019).
-- 5. **The Group tab** (handoff 6.18: "Name, members link, anonymity threshold. The threshold is 4 and can be raised
--    to 8, never lowered"): `get_group_settings` answers a current member, and only the group's leader renames it
--    (`rename_group`) or raises the threshold (`raise_threshold`). The threshold is the organisation's (CLAUDE.md
--    invariant 1), so raising it holds for every group of the organisation, from the next round each opens; an open
--    round keeps the k it froze. The trigger of 0002 refuses a lower value and audits a higher one.
-- 6. **The jobs run once a day**, as the database owner through pg_cron, and no role is granted them.

-- ---------------------------------------------------------------- when the Team data's retention runs out
alter table app.team add column team_data_deleted_at timestamptz;
comment on column app.team.team_data_deleted_at is
  'When the retention job last deleted the group''s Team data (0026): the plan shows no deletion date after it.';

-- the date the leader is shown, from 0013's get_group_plan: a cancel's, or an unpaid trial's end plus the retention
create function app.team_data_due_at(p_team uuid) returns timestamptz
  language sql stable security definer set search_path = ''
as $$
  select case when s.team_id is not null then s.deletion_due_at
              when t.ends_at <= now() then t.ends_at + make_interval(days => app.setting_int('retention_after_cancel_days')) end
  from (select p_team as id) g
  left join app.subscription s on s.team_id = g.id
  left join app.trial t on t.team_id = g.id
$$;
comment on function app.team_data_due_at(uuid) is
  'When a group''s Team data is due for deletion after a cancel or an unpaid trial, or null (handoff 8, Retention).';

-- the same date while the deletion is still to come: none once the job has run on or after it
create function app.team_data_pending_until(p_team uuid) returns timestamptz
  language sql stable security definer set search_path = ''
as $$
  select d.due
  from (select app.team_data_due_at(p_team) as due) d, app.team t
  where t.id = p_team and d.due is not null and (t.team_data_deleted_at is null or t.team_data_deleted_at < d.due)
$$;
comment on function app.team_data_pending_until(uuid) is
  'The deletion date of a group''s Team data while it is still to come; null once deleted, or when nothing is due.';

-- what every current member may know (0013), now with no deletion date once the job has run
create or replace function app.get_group_plan(p_team uuid)
  returns table (plan text, access text, "interval" text, state text, period_end timestamptz, grace_ends_at timestamptz,
                 cancel_effective_at timestamptz, deletion_due_at timestamptz, trial_ends_at timestamptz,
                 trial_available boolean, adapter text)
  language sql stable security definer set search_path = ''
as $$
  select case when app.group_access(p_team) = 'free' then 'free' else coalesce(s.plan_key, 'team') end,
         app.group_access(p_team),
         s.interval, s.state, s.current_period_end,
         case when s.state = 'past_due' then s.past_due_since + make_interval(days => app.payment_grace_days()) end,
         s.cancel_effective_at,
         -- after a cancel, or after a trial that ended unpaid, the Team data is kept for the retention (0026)
         app.team_data_pending_until(p_team),
         case when s.team_id is null then t.ends_at end,
         s.team_id is null and t.team_id is null,
         (select a.adapter from app.payment_adapter a)
  from (select p_team as id) g
  left join app.subscription s on s.team_id = g.id
  left join app.trial t on t.team_id = g.id
  where app.is_team_member(p_team)
$$;

-- ---------------------------------------------------------------- deleting a group's Team data
-- In this order, so no row is first updated by a foreign key's SET NULL and then deleted: actions and focus areas
-- (an action names an agenda item, a focus area a round), then meetings (their items, decisions, parking lots and
-- process comments go with them), the pulse rhythm, the rounds (their answers, participation, scores, reminders and
-- pulse questions go with them), and last the charter versions (their tasks and working agreements).
create function app.purge_team_data(p_team uuid) returns void
  language plpgsql volatile security definer set search_path = ''
as $$
begin
  delete from app.action a where a.team_id = p_team;
  delete from app.focus_area f where f.team_id = p_team;
  delete from app.meeting m where m.team_id = p_team;
  delete from app.pulse_schedule p where p.team_id = p_team;
  delete from app.assessment_round r where r.team_id = p_team;
  delete from app.charter_version c where c.team_id = p_team;
  update app.team t set team_data_deleted_at = now() where t.id = p_team;
end $$;
comment on function app.purge_team_data(uuid) is
  'Deletes a group''s Team data: rounds with their answers and scores, meetings, focus areas, actions, pulses and charter. The retention job''s.';

-- ---------------------------------------------------------------- a Free group's last sign-in
create function app.group_last_seen(p_team uuid) returns timestamptz
  language sql stable security definer set search_path = ''
as $$
  select greatest(t.created_at, (select max(u.last_sign_in_at)
                                 from app.membership m join auth.users u on u.id = m.person_id
                                 where m.team_id = t.id and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())))
  from app.team t where t.id = p_team
$$;
comment on function app.group_last_seen(uuid) is
  'The latest sign-in of a group''s current members, or the day it began if later: a Free group goes after 12 months of none.';

-- ---------------------------------------------------------------- the daily job
create function app.retention_tick() returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_team uuid;
  v_org uuid;
  v_purged int := 0;
  v_groups int := 0;
begin
  for v_team in
    select t.id from app.team t join app.organisation o on o.id = t.org_id
    where not o.is_demo and app.team_data_pending_until(t.id) <= now()
    order by t.id
  loop
    perform app.purge_team_data(v_team);
    v_purged := v_purged + 1;
  end loop;

  for v_team, v_org in
    select t.id, t.org_id from app.team t join app.organisation o on o.id = t.org_id
    where not o.is_demo and app.group_access(t.id) = 'free' and app.group_last_seen(t.id) <= now() - interval '12 months'
    order by t.id
  loop
    delete from app.team t where t.id = v_team;
    delete from app.organisation o where o.id = v_org and not exists (select 1 from app.team t where t.org_id = o.id);
    v_groups := v_groups + 1;
  end loop;

  return jsonb_build_object('team_data', v_purged, 'groups', v_groups);
end $$;
comment on function app.retention_tick() is
  'The daily retention job (handoff 8): Team data past its date, and Free groups with no sign-in for 12 months. Counts only.';

-- ---------------------------------------------------------------- the Group tab
create function app.get_group_settings(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', t.name,
    'organisation', o.name,
    'threshold', o.threshold,
    'threshold_max', app.k_max(),
    'members', (select count(*)::int from app.membership m
                where m.team_id = t.id and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())),
    'members_max', app.setting_int('members_per_group'),
    'can_edit', app.is_team_leader(t.id))
  from app.team t join app.organisation o on o.id = t.org_id
  where t.id = p_team and app.is_team_member(p_team)
$$;
comment on function app.get_group_settings(uuid) is
  'The Group tab (handoff 6.18) for a current member: the name, the organisation, the threshold, the member count, and whether they may edit.';

create function app.rename_group(p_team uuid, p_name text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if length(v_name) not between 1 and 120 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.team t set name = v_name where t.id = p_team;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.rename_group(uuid, text) is 'The group''s leader renames it (handoff 6.18).';

create function app.raise_threshold(p_team uuid, p_threshold int) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_now int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  select t.org_id into v_org from app.team t where t.id = p_team;
  -- one raise at a time: a second waits here, then compares with the first's value
  select o.threshold into v_now from app.organisation o where o.id = v_org for update;
  if p_threshold is null or p_threshold > app.k_max() then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_threshold <= v_now then
    return jsonb_build_object('ok', false, 'reason', 'not_higher', 'threshold', v_now);
  end if;
  -- the trigger of 0002 audits the change; it would refuse a lower value too
  update app.organisation o set threshold = p_threshold where o.id = v_org;
  return jsonb_build_object('ok', true, 'threshold', p_threshold);
end $$;
comment on function app.raise_threshold(uuid, int) is
  'The group''s leader raises its organisation''s threshold, up to k_max(); never lower (handoff 6.18, CLAUDE.md invariant 1).';

-- ---------------------------------------------------------------- grants and schedule
grant execute on function app.get_group_settings(uuid), app.rename_group(uuid, text), app.raise_threshold(uuid, int) to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('leaderpact-retention', '53 3 * * *', 'select app.retention_tick()');
  end if;
end $$;
