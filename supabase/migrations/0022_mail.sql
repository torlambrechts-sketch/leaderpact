-- 0022_mail.sql — the outbox: invitations, round invitations, the export's link and each person's summary, sent
-- by the dispatcher through Brevo (handoff 6.18 and 8; milestone 16; REUSE 4.8; D-26; D-53).
--
-- 1. **One outbox, four kinds**: `member_invite` (a leader's invitation, now also by mail), `round_invite` (a
--    diagnostic or pulse opens), `export_ready` (a person's data export) and `summary` (each person's own,
--    as often as they choose). The round reminders keep their own ledger (0015); the dispatcher drains both.
-- 2. **A row names no recipient it does not need.** A round's invitation is one row per round, its recipients
--    decided when it is sent: the invited members who are still members and have not answered (none at
--    opening). Who was mailed is not stored. Person rows name the person they are for.
-- 3. **Links are minted when a mail is claimed**, and only their SHA-256 is kept: a member invitation's
--    (beside the leader's own copy of the link, which still works) and the export's (valid 24 hours).
-- 4. **50 invitations per group per day** (handoff 8): the claim counts a group's invitation mail per day and
--    moves the rest to the next day, so nothing is refused.
-- 5. **Suppression.** An address with a hard bounce, a spam report or an unsubscription gets nothing more
--    until the address changes. Only the address's SHA-256 is kept.
-- 6. **Summaries** (handoff 6.18, "each person sets how often summaries arrive"): weekly on Monday morning, every
--    four weeks, or never, in the person's time zone. A summary lists what waits for the person — questionnaires
--    to answer, their open actions, the next meeting — and never who has or has not answered.
-- 7. **The dispatcher** claims with a 10-minute lease and reports each row sent or not; after five tries a row
--    is given up. It is the `leaderpact-dispatch` function, called every five minutes through pg_net with a
--    secret from Vault; with no secret in Vault, nothing calls it.

-- ---------------------------------------------------------------- suppression
create table app.mail_suppression (
  email_hash bytea primary key check (length(email_hash) = 32),
  reason text not null check (reason in ('hard_bounce', 'spam', 'unsubscribed')),
  at timestamptz not null default now()
);
comment on table app.mail_suppression is
  'Addresses that get no more mail: a hard bounce, a spam report or an unsubscription. Only the SHA-256 of the address. No client reads it.';

create function app.mail_hash(p_email text) returns bytea
  language sql immutable set search_path = ''
as $$ select pg_catalog.sha256(convert_to(lower(btrim(p_email)), 'UTF8')) $$;

create function app.mail_suppressed(p_email text) returns boolean
  language sql stable security definer set search_path = ''
as $$ select p_email is null or exists (select 1 from app.mail_suppression s where s.email_hash = app.mail_hash(p_email)) $$;
comment on function app.mail_suppressed(text) is 'Whether an address gets no mail. Internal.';

-- ---------------------------------------------------------------- each person's summary and time zone
create table app.notification_preference (
  person_id uuid primary key references app.person (id) on delete cascade,
  summary text not null default 'weekly' check (summary in ('weekly', 'monthly', 'off')),
  -- an IANA zone; null reads as UTC
  time_zone text check (time_zone is null or length(time_zone) between 1 and 64),
  -- the person's local day of the last summary queued, so one period gets one
  last_summary_on date,
  updated_at timestamptz not null default now()
);
comment on table app.notification_preference is
  'How often a person''s summary arrives (handoff 6.18), and their time zone. No client reads it; get_notifications answers its person.';

-- ---------------------------------------------------------------- the outbox
create table app.outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('member_invite', 'round_invite', 'export_ready', 'summary')),
  org_id uuid references app.organisation (id) on delete cascade,
  team_id uuid references app.team (id) on delete cascade,
  -- the person a person's mail is for: the export's and the summary's
  person_id uuid references app.person (id) on delete cascade,
  -- what it is about: the invitation, the round or the export
  ref_id uuid,
  due_at timestamptz not null default now(),
  state text not null default 'due' check (state in ('due', 'sending', 'sent', 'skipped', 'failed')),
  lease_until timestamptz,
  attempts int not null default 0 check (attempts between 0 and 5),
  -- a code, never a message: a provider's text can quote an address
  last_error text check (last_error ~ '^[a-z0-9_]{1,40}$'),
  created_at timestamptz not null default now(),
  check ((state = 'sending') = (lease_until is not null)),
  check ((kind in ('export_ready', 'summary')) = (person_id is not null)),
  check ((kind in ('member_invite', 'round_invite', 'export_ready')) = (ref_id is not null))
);
create index outbox_due_idx on app.outbox (due_at) where state in ('due', 'sending');
comment on table app.outbox is
  'Mail waiting to go (handoff 8): its kind, what it is about and when; recipients are decided when it is sent. No client reads it.';

-- a group's invitation mail per day, for the 50 a day (handoff 8)
create table app.mail_day (
  team_id uuid not null references app.team (id) on delete cascade,
  day date not null,
  invitations int not null default 0 check (invitations >= 0),
  primary key (team_id, day)
);
comment on table app.mail_day is 'Invitation mail a group sent per day, a count only. No client reads it.';

alter table app.mail_suppression enable row level security;
alter table app.notification_preference enable row level security;
alter table app.outbox enable row level security;
alter table app.mail_day enable row level security;
revoke all on app.mail_suppression, app.notification_preference, app.outbox, app.mail_day from anon, authenticated, service_role;

-- ---------------------------------------------------------------- invitations, also by mail
alter table app.invitation add column mail_token_hash bytea unique check (mail_token_hash is null or length(mail_token_hash) = 32);
comment on column app.invitation.mail_token_hash is
  'The SHA-256 of the mailed link''s token, minted when the mail is claimed; the leader''s own link keeps working beside it.';

-- the invitation a link names: the leader's copy or the mailed one
create function app.invitation_for(p_token text) returns uuid
  language sql stable security definer set search_path = ''
as $$
  select i.id from app.invitation i
  where p_token is not null and length(p_token) between 16 and 64
    and (i.token_hash = pg_catalog.sha256(convert_to(p_token, 'UTF8')) or i.mail_token_hash = pg_catalog.sha256(convert_to(p_token, 'UTF8')))
$$;
comment on function app.invitation_for(text) is 'The invitation a link''s token names, either copy. Internal.';

create or replace function app.get_invitation(p_token text) returns jsonb
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
  where i.id = app.invitation_for(p_token)
$$;

create or replace function app.invitation_matches(p_token text, p_email text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app.invitation i
    where i.id = app.invitation_for(p_token)
      and i.email = lower(btrim(coalesce(p_email, '')))
      and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
$$;

create or replace function app.accept_invitation(p_token text) returns jsonb
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
  select * into v_i from app.invitation i where i.id = app.invitation_for(p_token) for update;
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

-- an invitation goes by mail as well: the leader's copy of the link is still theirs to send
create function app.invitation_mail() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  insert into app.outbox (kind, org_id, team_id, ref_id) values ('member_invite', new.org_id, new.team_id, new.id);
  return new;
end $$;
create trigger invitation_mail after insert on app.invitation for each row execute function app.invitation_mail();

-- a round's invitation goes when it opens: one row for the round, its recipients decided when it is sent
create function app.round_invite_mail() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if new.phase = 'answering' and old.phase = 'scheduled' then
    insert into app.outbox (kind, org_id, team_id, ref_id) values ('round_invite', new.org_id, new.team_id, new.id);
  end if;
  return new;
end $$;
create trigger round_invite_mail after update of phase on app.assessment_round for each row execute function app.round_invite_mail();

-- ---------------------------------------------------------------- the person's own settings
create function app.get_notifications() returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when auth.uid() is not null then jsonb_build_object(
    'email', (select u.email from auth.users u where u.id = auth.uid()),
    'summary', coalesce((select n.summary from app.notification_preference n where n.person_id = auth.uid()), 'weekly'),
    'time_zone', (select n.time_zone from app.notification_preference n where n.person_id = auth.uid())) end
$$;
comment on function app.get_notifications() is 'The caller''s own: their address, how often their summary arrives and their time zone.';

create function app.set_notifications(p_summary text, p_time_zone text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (select 1 from app.person p where p.id = auth.uid()) then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_summary is null or p_summary not in ('weekly', 'monthly', 'off')
     or (p_time_zone is not null and not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_time_zone)) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into app.notification_preference as n (person_id, summary, time_zone) values (auth.uid(), p_summary, p_time_zone)
  on conflict (person_id) do update set summary = excluded.summary, time_zone = excluded.time_zone, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
comment on function app.set_notifications(text, text) is 'The caller sets how often their summary arrives and their time zone. {ok} or a reason.';

-- ---------------------------------------------------------------- summaries, queued by the job
-- Monday from 08:00 in the person's zone: weekly every Monday, monthly on the first Monday of the month. One
-- per period, for people in at least one group.
create function app.queue_summaries(p_now timestamptz default now()) returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_p record;
  v_n int := 0;
begin
  for v_p in
    select p.id, coalesce(n.summary, 'weekly') as summary, n.last_summary_on,
           (p_now at time zone coalesce(n.time_zone, 'UTC')) as local_now
    from app.person p
    left join app.notification_preference n on n.person_id = p.id
    where coalesce(n.summary, 'weekly') <> 'off'
      and exists (select 1 from app.membership m where m.person_id = p.id and m.valid_from <= p_now and (m.valid_to is null or m.valid_to > p_now))
  loop
    continue when extract(isodow from v_p.local_now) <> 1 or extract(hour from v_p.local_now) < 8;
    continue when v_p.summary = 'monthly' and extract(day from v_p.local_now) > 7;
    continue when v_p.last_summary_on is not null and v_p.last_summary_on >= v_p.local_now::date;
    insert into app.notification_preference as n (person_id, last_summary_on) values (v_p.id, v_p.local_now::date)
    on conflict (person_id) do update set last_summary_on = excluded.last_summary_on;
    insert into app.outbox (kind, person_id) values ('summary', v_p.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
comment on function app.queue_summaries(timestamptz) is 'The scheduled job: queues each person''s summary when it is due in their time zone. Returns how many.';

-- what waits for one person, for their summary: never who has or has not answered
create function app.summary_facts(p_person uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(g.facts order by g.name), '[]'::jsonb) from (
    select t.name, jsonb_build_object(
      'group', t.name,
      'team', t.id,
      'to_answer', coalesce((
        select jsonb_agg(jsonb_build_object('round', r.id, 'kind', r.kind, 'closes_at', r.closes_at) order by r.closes_at)
        from app.assessment_round r join app.participation pa on pa.round_id = r.id and pa.person_id = p_person
        where r.team_id = t.id and r.phase = 'answering' and r.closes_at > now() and not pa.answered), '[]'::jsonb),
      'actions', coalesce((
        select jsonb_agg(jsonb_build_object('title', a.title, 'due_on', a.due_on) order by a.due_on, a.title)
        from app.action a where a.team_id = t.id and a.owner_id = p_person and a.status = 'open'), '[]'::jsonb),
      'meeting', (select jsonb_build_object('title', mt.title, 'meets_on', mt.meets_on, 'starts_at', mt.starts_at)
                  from app.meeting mt where mt.id = app.next_meeting(t.id))) as facts
    from app.membership m join app.team t on t.id = m.team_id
    where m.person_id = p_person and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())) g
$$;
comment on function app.summary_facts(uuid) is 'One person''s summary: per group, the questionnaires they have to answer, their open actions and the next meeting. Internal.';

-- ---------------------------------------------------------------- the dispatcher's claim
-- Due mail with each row's recipients and facts, decided now. A row whose subject has gone, or that has nobody
-- to go to, is skipped. Invitation mail past a group's 50 for the day moves to the next day. Links are minted
-- here; only their hashes are kept. A 10-minute lease; after five tries a row is given up.
create function app.claim_mail(p_limit int default 25) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_o app.outbox;
  v_r app.assessment_round;
  v_i app.invitation;
  v_to jsonb;
  v_facts jsonb;
  v_token text;
  v_count int;
  v_cap constant int := 50;
  v_out jsonb := '[]'::jsonb;
begin
  for v_o in
    select o.* from app.outbox o
    where (o.state = 'due' and o.due_at <= now()) or (o.state = 'sending' and o.lease_until <= now())
    order by o.due_at
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  loop
    v_to := null;
    v_facts := null;
    v_token := null;

    if v_o.kind = 'round_invite' then
      select * into v_r from app.assessment_round r where r.id = v_o.ref_id;
      if v_r.id is not null and v_r.phase = 'answering' and now() < v_r.closes_at then
        select jsonb_agg(jsonb_build_object('email', u.email, 'name', pe.display_name) order by random()) into v_to
        from app.participation p
        join app.membership m on m.team_id = v_r.team_id and m.person_id = p.person_id
          and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())
        join app.person pe on pe.id = p.person_id
        join auth.users u on u.id = p.person_id
        where p.round_id = v_r.id and not p.answered and not app.mail_suppressed(u.email);
        v_facts := jsonb_build_object(
          'group', (select t.name from app.team t where t.id = v_r.team_id), 'round', v_r.id, 'team', v_r.team_id,
          'round_kind', v_r.kind,
          'number', (select count(*)::int from app.assessment_round x
                     where x.team_id = v_r.team_id and x.kind = v_r.kind and (x.opens_at, x.id) <= (v_r.opens_at, v_r.id)),
          'closes_at', v_r.closes_at);
      end if;
    elsif v_o.kind = 'member_invite' then
      select * into v_i from app.invitation i where i.id = v_o.ref_id;
      if v_i.id is not null and v_i.accepted_at is null and v_i.revoked_at is null and v_i.expires_at > now()
         and not app.mail_suppressed(v_i.email) then
        v_to := jsonb_build_array(jsonb_build_object('email', v_i.email, 'name', v_i.display_name));
        v_facts := jsonb_build_object(
          'group', (select t.name from app.team t where t.id = v_i.team_id),
          'leader', (select p.display_name from app.membership m join app.person p on p.id = m.person_id
                     where m.team_id = v_i.team_id and m.role = 'leader' and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())),
          'expires_at', v_i.expires_at);
      end if;
    elsif v_o.kind = 'export_ready' then
      if exists (select 1 from app.export_request e where e.id = v_o.ref_id and e.person_id = v_o.person_id and e.state = 'ready') then
        select jsonb_build_array(jsonb_build_object('email', u.email, 'name', pe.display_name)) into v_to
        from auth.users u join app.person pe on pe.id = u.id
        where u.id = v_o.person_id and not app.mail_suppressed(u.email);
      end if;
    elsif v_o.kind = 'summary' then
      v_facts := app.summary_facts(v_o.person_id);
      -- nothing waits for them: no mail
      if exists (select 1 from jsonb_array_elements(v_facts) g
                 where jsonb_array_length(g -> 'to_answer') > 0 or jsonb_array_length(g -> 'actions') > 0 or g -> 'meeting' <> 'null'::jsonb) then
        select jsonb_build_array(jsonb_build_object('email', u.email, 'name', pe.display_name)) into v_to
        from auth.users u join app.person pe on pe.id = u.id
        where u.id = v_o.person_id and not app.mail_suppressed(u.email);
      end if;
    end if;

    if v_to is null or jsonb_array_length(v_to) = 0 then
      update app.outbox o set state = 'skipped', lease_until = null where o.id = v_o.id;
      continue;
    end if;
    if v_o.attempts >= 5 then
      update app.outbox o set state = 'failed', lease_until = null where o.id = v_o.id;
      continue;
    end if;
    -- invitations: 50 a group a day; the rest waits for the next day
    if v_o.kind in ('member_invite', 'round_invite') then
      v_count := jsonb_array_length(v_to);
      insert into app.mail_day as d (team_id, day, invitations) values (v_o.team_id, current_date, 0)
      on conflict (team_id, day) do nothing;
      if (select d.invitations from app.mail_day d where d.team_id = v_o.team_id and d.day = current_date for update) + v_count > v_cap then
        update app.outbox o set due_at = (current_date + 1)::timestamptz, state = 'due', lease_until = null where o.id = v_o.id;
        continue;
      end if;
      update app.mail_day d set invitations = d.invitations + v_count where d.team_id = v_o.team_id and d.day = current_date;
    end if;
    -- the links, minted now; their hashes kept
    if v_o.kind = 'member_invite' then
      v_token := app.new_link_code();
      update app.invitation i set mail_token_hash = pg_catalog.sha256(convert_to(v_token, 'UTF8')) where i.id = v_i.id;
      v_facts := v_facts || jsonb_build_object('path', '/join/' || v_token);
    elsif v_o.kind = 'export_ready' then
      v_token := app.new_link_code() || app.new_link_code();
      update app.export_request e set token_hash = pg_catalog.sha256(convert_to(v_token, 'UTF8')), link_expires_at = now() + interval '24 hours'
      where e.id = v_o.ref_id;
      v_facts := jsonb_build_object('path', '/export/' || v_token, 'expires_at', now() + interval '24 hours');
    end if;

    update app.outbox o set state = 'sending', lease_until = now() + interval '10 minutes', attempts = o.attempts + 1
    where o.id = v_o.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_o.id, 'kind', v_o.kind, 'to', v_to, 'facts', v_facts));
  end loop;
  return v_out;
end $$;
comment on function app.claim_mail(int) is
  'The dispatcher''s claim: due mail with its recipients and facts, decided now, links minted with only their hashes kept. Granted to service_role alone.';

create function app.finish_mail(p_id uuid, p_sent boolean, p_error text default null) returns text
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_o app.outbox;
begin
  select * into v_o from app.outbox o where o.id = p_id for update;
  if not found then
    return 'none';
  end if;
  if v_o.state <> 'sending' then
    return v_o.state;
  end if;
  if p_sent then
    update app.outbox o set state = 'sent', lease_until = null, last_error = null where o.id = p_id;
    return 'sent';
  end if;
  update app.outbox o
  set state = case when o.attempts >= 5 then 'failed' else 'due' end, lease_until = null,
      last_error = case when p_error ~ '^[a-z0-9_]{1,40}$' then p_error else 'unknown' end
  where o.id = p_id;
  return case when v_o.attempts >= 5 then 'failed' else 'due' end;
end $$;
comment on function app.finish_mail(uuid, boolean, text) is
  'The dispatcher reports a claimed mail sent, or not with a code (tried again later). Granted to service_role alone.';

-- The round reminders' claim (0015), now with what a reminder's link and words need (the group and the round's
-- kind and number) and without a suppressed address. The same recipients: the invited members who are still
-- members and have not answered, decided now, never stored.
create or replace function app.claim_reminders(p_limit int default 20) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_rr app.round_reminder;
  v_r app.assessment_round;
  v_to jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  for v_rr in
    select rr.* from app.round_reminder rr
    where (rr.state = 'due' and rr.due_at <= now()) or (rr.state = 'sending' and rr.lease_until <= now())
    order by rr.due_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  loop
    select * into v_r from app.assessment_round r where r.id = v_rr.round_id;
    select jsonb_agg(jsonb_build_object('email', u.email, 'name', pe.display_name) order by random()) into v_to
    from app.participation p
    join app.membership m on m.team_id = v_r.team_id and m.person_id = p.person_id
      and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())
    join app.person pe on pe.id = p.person_id
    join auth.users u on u.id = p.person_id
    where p.round_id = v_r.id and not p.answered and u.email is not null and not app.mail_suppressed(u.email);

    if v_r.phase <> 'answering' or now() >= v_r.closes_at or v_to is null then
      update app.round_reminder rr set state = 'skipped', lease_until = null where rr.round_id = v_rr.round_id and rr.day = v_rr.day;
    elsif v_rr.attempts >= 5 then
      update app.round_reminder rr set state = 'failed', lease_until = null where rr.round_id = v_rr.round_id and rr.day = v_rr.day;
    else
      update app.round_reminder rr set state = 'sending', lease_until = now() + interval '10 minutes', attempts = rr.attempts + 1
      where rr.round_id = v_rr.round_id and rr.day = v_rr.day;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'round', v_r.id, 'day', v_rr.day, 'team', v_r.team_id, 'group', (select t.name from app.team t where t.id = v_r.team_id),
        'round_kind', v_r.kind,
        'number', (select count(*)::int from app.assessment_round x
                   where x.team_id = v_r.team_id and x.kind = v_r.kind and (x.opens_at, x.id) <= (v_r.opens_at, v_r.id)),
        'closes_at', v_r.closes_at, 'recipients', v_to));
    end if;
  end loop;
  return v_out;
end $$;
comment on function app.claim_reminders(int) is
  'The dispatcher''s claim: due reminders, each to the invited members who have not answered and whose address takes mail, decided now. Granted to service_role alone.';

-- Brevo's delivery events, through the mail-events function: a hard bounce, a spam report or an unsubscription
create function app.suppress_address(p_email text, p_reason text) returns boolean
  language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_email is null or p_reason not in ('hard_bounce', 'spam', 'unsubscribed') then
    return false;
  end if;
  insert into app.mail_suppression (email_hash, reason) values (app.mail_hash(p_email), p_reason)
  on conflict (email_hash) do update set reason = excluded.reason, at = now();
  return true;
end $$;
comment on function app.suppress_address(text, text) is 'Records an address that gets no more mail, by its hash only. Granted to service_role alone.';

-- ---------------------------------------------------------------- grants
grant execute on function app.get_notifications(), app.set_notifications(text, text) to authenticated;
grant execute on function app.claim_mail(int), app.finish_mail(uuid, boolean, text), app.suppress_address(text, text),
  app.queue_summaries(timestamptz) to service_role;

-- ---------------------------------------------------------------- the schedule
-- Summaries are queued hourly. The dispatcher is called every five minutes through pg_net, inert until Vault
-- holds its URL and secret (set on the hosted project only), so a local stack or CI never calls out.
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('leaderpact-queue-summaries', '7 * * * *', 'select app.queue_summaries()');
    if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_net')
       and to_regclass('vault.decrypted_secrets') is not null then
      create extension if not exists pg_net;
      perform cron.schedule('leaderpact-dispatch', '*/5 * * * *', $job$
        select net.http_post(
                 url := s.url,
                 headers := jsonb_build_object('content-type', 'application/json', 'x-dispatch-secret', s.secret),
                 body := '{}'::jsonb,
                 timeout_milliseconds := 55000)
        from (select
                (select decrypted_secret from vault.decrypted_secrets where name = 'leaderpact_dispatch_url') as url,
                (select decrypted_secret from vault.decrypted_secrets where name = 'leaderpact_dispatch_secret') as secret) s
        where s.url is not null and s.secret is not null
      $job$);
    end if;
  end if;
end $do$;
