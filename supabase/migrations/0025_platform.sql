-- 0025_platform.sql — the Sentral connection: events out, commands in, the audit and a resync (handoff A.3 and
-- 13; milestone 17: "An event arrives at Sentral and a command round-trips. A replayed token is refused. The
-- suite proves no answer field can leave"; REUSE 6; owner E1 to E8; D-54).
--
-- Ported from Orgpuls 0205 and 0207 at 6f5d441, with the two defects REUSE 6.1 found fixed: every claim check
-- is null-safe (a token with no audience or no lifetime is refused), and a refused command leaves its audit row.
--
-- 1. **Secrets live in Vault and nowhere else.** The token secret (Sentral signs commands with it) and the
--    webhook secret (LeaderPact signs events with it) are made here, at random, and handed to Sentral by the
--    database itself (`platform_hand_over`, through pg_net, with a one-time number Sentral's owner opens), so
--    no person and no log ever holds them. The dispatcher's own secret is made here too: pg_cron sends it, and
--    the dispatcher checks it against Vault (`dispatch_authorised`).
-- 2. **Events.** `platform_emit` is the only writer of `platform_events`, and refuses any field its kind does
--    not list (`platform_event_kinds`). The kinds are the ones Sentral projects (its ingest_events): org.created,
--    org.deleted, member.invited, member.joined, member.left, billing.changed and usage.daily (owner E3, E4).
--    None lists an answer, a score, a standing, a profile, a comment, a participation, or a count or date tied
--    to a named round (CLAUDE.md invariant 12); the suite proves the registry. A demo organisation emits nothing.
--    An organisation is one tenant; its groups' plans are summed into one subscription (E6). No organisation
--    number is sent (E5).
-- 3. **Commands.** `public.platform_command(token, command, args)` is the one way in, callable with the public
--    key: the token is the credential, an HS256 JWT for audience `leaderpact`, at most five minutes long, with
--    the actor, the scope and an id never seen before. Each command is a row of `platform_command_map` naming
--    one function and its scope. Every call whose signature passes is written to `platform_commands` before any
--    other check, so a refusal is recorded too; a replayed id is refused.
-- 4. **No command reads an answer** or adds anyone to a group: membership gates results, so a command that
--    invited, added or promoted would let Sentral's staff read them (REUSE 6.1). orgs.get returns no round
--    and no person's sign-in time (E4). There is no erasure command (E8).

-- ---------------------------------------------------------------- the secrets (Vault only)
do $$
begin
  if to_regclass('vault.secrets') is null then
    return;
  end if;
  if not exists (select 1 from vault.secrets where name = 'leaderpact_platform_token_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'leaderpact_platform_token_secret',
                                'Verifies Sentral''s command tokens (HS256, 0025). Shared with Sentral only, by platform_hand_over.');
  end if;
  if not exists (select 1 from vault.secrets where name = 'leaderpact_platform_webhook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'leaderpact_platform_webhook_secret',
                                'Signs events to Sentral (HMAC-SHA256, 0025). Shared with Sentral only, by platform_hand_over.');
  end if;
  if not exists (select 1 from vault.secrets where name = 'leaderpact_dispatch_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'leaderpact_dispatch_secret',
                                'Sent by pg_cron to the dispatcher, which checks it here (0022, 0025).');
  end if;
end $$;

create function app.platform_secret(p_name text) returns text
  language sql stable security definer set search_path = ''
as $$
  select s.decrypted_secret from vault.decrypted_secrets s
  where s.name = case p_name when 'token' then 'leaderpact_platform_token_secret'
                             when 'webhook' then 'leaderpact_platform_webhook_secret'
                             when 'dispatch' then 'leaderpact_dispatch_secret' end
$$;
comment on function app.platform_secret(text) is 'A platform secret from Vault. Internal: no role may call it.';

-- the dispatcher asks whether the caller sent pg_cron's secret
create function app.dispatch_authorised(p_secret text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select coalesce(length(p_secret) between 32 and 256 and p_secret = app.platform_secret('dispatch'), false)
$$;
comment on function app.dispatch_authorised(text) is 'Whether a dispatcher call carries pg_cron''s secret (0025). Granted to service_role alone.';

-- Sentral's owner opens a one-time number in Sentral; the database sends both secrets to Sentral's secret-intake
-- with it. Nobody reads them on the way. Run by the owner in the SQL editor; no role may call it.
create function app.platform_hand_over(p_nonce text, p_include_webhook boolean default true) returns bigint
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_secrets jsonb := jsonb_build_object('leaderpact_token_secret', app.platform_secret('token'));
begin
  if p_nonce is null or length(p_nonce) not between 16 and 256 then
    raise exception 'a one-time number from Sentral is needed' using errcode = 'invalid_parameter_value';
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'pg_net is not here' using errcode = 'feature_not_supported';
  end if;
  if p_include_webhook then
    v_secrets := v_secrets || jsonb_build_object('leaderpact_webhook_secret', app.platform_secret('webhook'));
  end if;
  return net.http_post(
    url := 'https://zuvqbaejoktpekfsiyyr.supabase.co/functions/v1/secret-intake',
    body := jsonb_build_object('nonce', p_nonce, 'secrets', v_secrets),
    headers := jsonb_build_object('content-type', 'application/json'),
    timeout_milliseconds := 20000);
end $$;
comment on function app.platform_hand_over(text, boolean) is
  'Sends the token secret, and the webhook secret unless Sentral holds one already, to Sentral''s secret-intake with a one-time number (0025). The owner runs it; no role may call it.';

-- where the webhook secret already lives in Sentral (and in the app's PLATFORM_WEBHOOK_SECRET), Vault takes that one
create function app.platform_set_webhook_secret(p_value text) returns void
  language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_value is null or length(p_value) not between 32 and 256 then
    raise exception 'a secret of 32 to 256 characters' using errcode = 'invalid_parameter_value';
  end if;
  perform vault.update_secret((select s.id from vault.secrets s where s.name = 'leaderpact_platform_webhook_secret'), p_value);
end $$;
comment on function app.platform_set_webhook_secret(text) is
  'Replaces the webhook secret with the one Sentral already holds (0025). The owner runs it; no role may call it.';

-- ---------------------------------------------------------------- where events go: one installation, off until set
create table app.platform_installation (
  id boolean primary key default true check (id),
  webhook_url text check (webhook_url is null or (webhook_url ~ '^https://[^\s/]+(/[^\s]*)?$' and length(webhook_url) <= 500)),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into app.platform_installation (id) values (true);
comment on table app.platform_installation is
  'Where events go (0025): Sentral''s product-events address and whether delivery is on. Set by SQL. No client reads it.';

-- ---------------------------------------------------------------- 1 · events
create table app.platform_event_kinds (
  kind text primary key check (kind ~ '^[a-z]+\.[a-z_]+$'),
  fields text[] not null,
  note text not null
);
comment on table app.platform_event_kinds is
  'The events LeaderPact sends Sentral and the only fields each may carry (0025). Adding a field is a migration. No client reads it.';

insert into app.platform_event_kinds (kind, fields, note) values
  ('org.created', array['name', 'group_size', 'created_at'],
   'an organisation started: its name, the size its first group gave, and when'),
  ('org.deleted', array[]::text[],
   'an organisation and everything in it is gone'),
  ('member.invited', array['invitation_id', 'role'],
   'a leader invited someone to a group: no address until they join'),
  ('member.joined', array['user_id', 'role', 'email', 'name'],
   'an account holder is in at least one of the organisation''s groups: a customer contact; never what they answered'),
  ('member.left', array['user_id'],
   'an account holder is in none of the organisation''s groups any more'),
  ('billing.changed', array['plan', 'billing_interval', 'trial_started_at', 'trial_ends_at', 'confirmed_at', 'free_from',
                            'cancelled_at', 'cancel_effective_at', 'deletion_due_at', 'price', 'currency', 'seats', 'payment_state'],
   'the organisation''s plan, its groups summed: seats are paid groups, price the total per interval'),
  ('usage.daily', array['members', 'groups', 'rounds_started', 'meetings_held', 'last_sign_in_on'],
   'counts per organisation, once a day: no open or closed count and no date of any round');

create table app.platform_events (
  id bigint generated always as identity primary key,
  kind text not null references app.platform_event_kinds (kind),
  -- no foreign key: an org.deleted event outlives its organisation
  org_id uuid,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  attempts int not null default 0 check (attempts between 0 and 20),
  last_error text check (last_error ~ '^[a-z0-9_]{1,40}$')
);
create index platform_events_pending_idx on app.platform_events (id) where delivered_at is null;
create index platform_events_org_idx on app.platform_events (org_id);
comment on table app.platform_events is
  'Events waiting for, or delivered to, Sentral (0025). Written only by platform_emit; delivered by the dispatcher; kept 30 days. No client reads it.';

-- the one writer: a field its kind does not list is refused; empty values are dropped; a demo emits nothing
create function app.platform_emit(p_kind text, p_org uuid, p_payload jsonb) returns void
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_fields text[];
  v_bad text;
  v_clean jsonb;
begin
  select k.fields into v_fields from app.platform_event_kinds k where k.kind = p_kind;
  if v_fields is null then
    raise exception 'platform event % is not registered', p_kind using errcode = 'invalid_parameter_value';
  end if;
  if p_payload is not null and jsonb_typeof(p_payload) <> 'object' then
    raise exception 'platform event % carries no object', p_kind using errcode = 'invalid_parameter_value';
  end if;
  select string_agg(key, ', ') into v_bad from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) key where key <> all (v_fields);
  if v_bad is not null then
    raise exception 'platform event % may not carry %', p_kind, v_bad using errcode = 'invalid_parameter_value';
  end if;
  if p_org is not null and exists (select 1 from app.organisation o where o.id = p_org and o.is_demo) then
    return;
  end if;
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_clean
  from jsonb_each(coalesce(p_payload, '{}'::jsonb)) e where e.value <> 'null'::jsonb and e.value <> '""'::jsonb;
  insert into app.platform_events (kind, org_id, payload) values (p_kind, p_org, v_clean);
end $$;
comment on function app.platform_emit(text, uuid, jsonb) is 'The only writer of platform_events (0025): refuses a field its kind does not list. Internal.';

-- what an organisation's groups add up to, as Sentral keeps one subscription per tenant (E6)
create function app.platform_billing(p_org uuid) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
declare
  v_paid int;
  v_trial boolean;
  v_currency text;
  v_yearly boolean;
  v_price numeric;
  v_ever boolean;
  v_all_cancelled boolean;
begin
  -- a group pays while its subscription runs: active, in grace, read-only, or cancelled but not yet ended
  select count(*), bool_and(s.state = 'cancelled')
    into v_paid, v_all_cancelled
  from app.subscription s
  where s.org_id = p_org and (s.state in ('active', 'past_due', 'read_only') or (s.state = 'cancelled' and s.cancel_effective_at > now()));
  select exists (select 1 from app.trial t where t.org_id = p_org and t.ends_at > now()
                 and not exists (select 1 from app.subscription s where s.team_id = t.team_id)) into v_trial;
  select exists (select 1 from app.subscription s where s.org_id = p_org) into v_ever;
  -- the currency most of its paying groups pay in; the price is the total per interval, in a year if any is yearly
  select s.currency into v_currency
  from app.subscription s
  where s.org_id = p_org and (s.state in ('active', 'past_due', 'read_only') or (s.state = 'cancelled' and s.cancel_effective_at > now()))
  group by s.currency order by count(*) desc, s.currency limit 1;
  select coalesce(bool_or(s.interval = 'year'), false) into v_yearly
  from app.subscription s
  where s.org_id = p_org and s.currency = v_currency
    and (s.state in ('active', 'past_due', 'read_only') or (s.state = 'cancelled' and s.cancel_effective_at > now()));
  select round(sum(case when v_yearly and s.interval = 'month' then s.amount_minor * 12 else s.amount_minor end) / 100.0, 2) into v_price
  from app.subscription s
  where s.org_id = p_org and s.currency = v_currency
    and (s.state in ('active', 'past_due', 'read_only') or (s.state = 'cancelled' and s.cancel_effective_at > now()));

  return jsonb_build_object(
    'plan', case when v_paid > 0 then 'team' when v_trial then 'trial' else 'free' end,
    'billing_interval', case when v_paid > 0 then case when v_yearly then 'year' else 'month' end end,
    'trial_started_at', (select min(t.started_at) from app.trial t where t.org_id = p_org),
    'trial_ends_at', (select max(t.ends_at) from app.trial t where t.org_id = p_org),
    'confirmed_at', (select min(s.started_at) from app.subscription s where s.org_id = p_org),
    'free_from', case when v_paid = 0 and v_ever then (select max(s.cancel_effective_at) from app.subscription s where s.org_id = p_org) end,
    'cancelled_at', case when v_paid > 0 and v_all_cancelled then (select max(s.cancelled_at) from app.subscription s where s.org_id = p_org and s.state = 'cancelled') end,
    'cancel_effective_at', case when v_paid > 0 and v_all_cancelled then (select max(s.cancel_effective_at) from app.subscription s where s.org_id = p_org and s.state = 'cancelled') end,
    'deletion_due_at', (select max(s.deletion_due_at) from app.subscription s where s.org_id = p_org and s.state = 'cancelled'),
    'price', case when v_paid > 0 then v_price end,
    'currency', v_currency,
    'seats', v_paid,
    'payment_state', case when exists (select 1 from app.subscription s where s.org_id = p_org and s.state = 'read_only') then 'suspended'
                          when exists (select 1 from app.subscription s where s.org_id = p_org and s.state = 'past_due') then 'past_due'
                          else 'ok' end);
end $$;
comment on function app.platform_billing(uuid) is 'An organisation''s groups'' plans as one subscription for Sentral (0025, E6). Internal.';

-- an organisation's counts for usage.daily: never an open or closed count, never a date of a round (E4)
create function app.platform_usage(p_org uuid) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
declare
  v_last date;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'last_sign_in_at') then
    execute 'select max(u.last_sign_in_at)::date from app.membership m join auth.users u on u.id = m.person_id
             where m.org_id = $1 and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())'
      into v_last using p_org;
  end if;
  return jsonb_build_object(
    'members', (select count(distinct m.person_id) from app.membership m
                where m.org_id = p_org and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())),
    'groups', (select count(*) from app.team t where t.org_id = p_org),
    'rounds_started', (select count(*) from app.assessment_round r where r.org_id = p_org and r.phase <> 'scheduled'),
    'meetings_held', (select count(*) from app.meeting mt join app.team t on t.id = mt.team_id where t.org_id = p_org and mt.status = 'held'),
    'last_sign_in_on', v_last);
end $$;
comment on function app.platform_usage(uuid) is 'An organisation''s counts for usage.daily (0025, E4). Internal.';

-- a person's standing in an organisation: in at least one of its groups (joined, as leader if they lead one) or none (left)
create function app.platform_member_state(p_org uuid, p_person uuid) returns void
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n int;
  v_leads boolean;
begin
  if p_org is null or p_person is null or not exists (select 1 from app.organisation o where o.id = p_org) then
    return;
  end if;
  select count(*), coalesce(bool_or(m.role = 'leader'), false) into v_n, v_leads
  from app.membership m
  where m.org_id = p_org and m.person_id = p_person and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now());
  if v_n = 0 then
    perform app.platform_emit('member.left', p_org, jsonb_build_object('user_id', p_person));
  else
    perform app.platform_emit('member.joined', p_org, jsonb_build_object(
      'user_id', p_person, 'role', case when v_leads then 'leader' else 'member' end,
      'email', (select u.email from auth.users u where u.id = p_person),
      'name', (select p.display_name from app.person p where p.id = p_person)));
  end if;
end $$;
comment on function app.platform_member_state(uuid, uuid) is 'Emits member.joined or member.left for one person in one organisation (0025). Internal.';

-- ---------------------------------------------------------------- what emits
create function app.platform_on_org() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.platform_emit('org.created', new.id, jsonb_build_object('name', new.name, 'created_at', new.created_at));
    return new;
  end if;
  if old.is_demo then
    return old;
  end if;
  -- what was queued about it goes with it (its members' addresses among it); Sentral is told once
  delete from app.platform_events e where e.org_id = old.id;
  perform app.platform_emit('org.deleted', old.id, '{}'::jsonb);
  return old;
end $$;
create trigger platform_org_created after insert on app.organisation for each row execute function app.platform_on_org();
create trigger platform_org_deleted after delete on app.organisation for each row execute function app.platform_on_org();

-- the size the organisation's first group gave, when its scan starts (start_group, 0009)
create function app.platform_on_first_scan() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from app.scan_session s where s.org_id = new.org_id and s.id <> new.id) then
    perform app.platform_emit('org.created', new.org_id, jsonb_build_object(
      'name', (select o.name from app.organisation o where o.id = new.org_id), 'group_size', new.member_count,
      'created_at', (select o.created_at from app.organisation o where o.id = new.org_id)));
  end if;
  return new;
end $$;
create trigger platform_first_scan after insert on app.scan_session for each row execute function app.platform_on_first_scan();

create function app.platform_on_membership() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform app.platform_member_state(coalesce(new.org_id, old.org_id), coalesce(new.person_id, old.person_id));
  if tg_op = 'UPDATE' and (old.org_id, old.person_id) is distinct from (new.org_id, new.person_id) then
    perform app.platform_member_state(old.org_id, old.person_id);
  end if;
  return null;
end $$;
create trigger platform_membership after insert or delete or update of role, valid_from, valid_to, person_id, org_id on app.membership
  for each row execute function app.platform_on_membership();

create function app.platform_on_invitation() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform app.platform_emit('member.invited', new.org_id, jsonb_build_object('invitation_id', new.id, 'role', 'member'));
  return new;
end $$;
create trigger platform_invitation after insert on app.invitation for each row execute function app.platform_on_invitation();

create function app.platform_on_billing() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid := coalesce(new.org_id, old.org_id);
begin
  if exists (select 1 from app.organisation o where o.id = v_org) then
    perform app.platform_emit('billing.changed', v_org, app.platform_billing(v_org));
  end if;
  return null;
end $$;
create trigger platform_subscription after insert or update or delete on app.subscription
  for each row execute function app.platform_on_billing();
create trigger platform_trial after insert or update or delete on app.trial
  for each row execute function app.platform_on_billing();

-- a person deleted: what is queued with their address goes first; member.left follows from their memberships
create function app.platform_on_person_deleted() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  delete from app.platform_events e where e.payload ->> 'user_id' = old.id::text;
  return old;
end $$;
create trigger platform_person_deleted before delete on app.person for each row execute function app.platform_on_person_deleted();

-- once a day, per organisation
create function app.platform_usage_tick() returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in select o.id from app.organisation o where not o.is_demo order by o.created_at loop
    perform app.platform_emit('usage.daily', r.id, app.platform_usage(r.id));
    n := n + 1;
  end loop;
  return n;
end $$;
comment on function app.platform_usage_tick() is 'Queues usage.daily for every organisation (0025). The scheduled job.';

-- ---------------------------------------------------------------- the dispatcher's side
-- Due events with the installation's address and the webhook secret to sign with, or none while delivery is off.
-- Events older than 30 days go, delivered or not: Sentral re-syncs from usage.daily and orgs.resync.
create function app.platform_events_claim(p_batch int default 50) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_url text;
  v_rows jsonb;
begin
  delete from app.platform_events e where e.created_at < now() - interval '30 days';
  select i.webhook_url into v_url from app.platform_installation i where i.enabled and i.webhook_url is not null;
  if v_url is null or app.platform_secret('webhook') is null then
    return jsonb_build_object('url', null, 'events', '[]'::jsonb);
  end if;
  with picked as (
    select e.id from app.platform_events e
    where e.delivered_at is null and (e.claimed_at is null or e.claimed_at < now() - interval '10 minutes') and e.attempts < 20
    order by e.id
    limit greatest(1, least(coalesce(p_batch, 50), 200))
    for update skip locked)
  , claimed as (
    update app.platform_events e set claimed_at = now(), attempts = e.attempts + 1
    from picked where e.id = picked.id
    returning e.id, e.kind, e.org_id, e.payload, e.created_at)
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'org_id', c.org_id,
                                               'payload', c.payload, 'created_at', c.created_at) order by c.id), '[]'::jsonb)
    into v_rows from claimed c;
  return jsonb_build_object('url', v_url, 'secret', app.platform_secret('webhook'), 'events', v_rows);
end $$;
comment on function app.platform_events_claim(int) is
  'The dispatcher''s claim of due events, with where to send them and the secret to sign with (0025). Granted to service_role alone.';

create function app.platform_events_done(p_ids bigint[], p_ok boolean, p_error text default null) returns int
  language sql volatile security definer set search_path = ''
as $$
  with done as (
    update app.platform_events e set
      delivered_at = case when p_ok then now() end,
      claimed_at = case when p_ok then e.claimed_at end,
      last_error = case when p_ok then null when p_error ~ '^[a-z0-9_]{1,40}$' then p_error else 'unknown' end
    where e.id = any (p_ids) and e.delivered_at is null
    returning 1)
  select count(*)::int from done
$$;
comment on function app.platform_events_done(bigint[], boolean, text) is
  'The dispatcher reports claimed events delivered, or not with a code (0025). Granted to service_role alone.';

-- ---------------------------------------------------------------- 2 · commands
create table app.platform_command_map (
  command text primary key check (command ~ '^[a-z]+\.[a-z_]+$'),
  scope text not null check (scope ~ '^[a-z]+:(read|write)$'),
  fn text not null,
  note text not null
);
comment on table app.platform_command_map is
  'What Sentral may ask LeaderPact to do (0025): a command, the scope it needs and the one function it calls. No client reads it.';

create table app.platform_commands (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  jti text not null unique check (length(jti) between 8 and 128),
  actor text not null check (length(actor) between 1 and 254),
  command text not null check (length(command) between 1 and 80),
  scope text not null check (length(scope) <= 200),
  arg_names text[] not null,
  ok boolean,
  error text check (length(error) <= 240)
);
comment on table app.platform_commands is
  'Every command Sentral sent with a valid signature (0025): who, what, which argument names (never values), the outcome, refusals included. No client reads it.';

-- nobody changes what a row says; its outcome is written once; a row goes only when 24 months old (handoff 8)
create function app.platform_commands_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.at < now() - interval '24 months' then
      return old;
    end if;
    raise exception 'platform commands are kept 24 months' using errcode = 'restrict_violation';
  end if;
  if (new.id, new.at, new.jti, new.actor, new.command, new.scope, new.arg_names)
     is distinct from (old.id, old.at, old.jti, old.actor, old.command, old.scope, old.arg_names)
     or old.ok is not null then
    raise exception 'a platform command''s record is fixed' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
create trigger platform_commands_fixed before update or delete on app.platform_commands
  for each row execute function app.platform_commands_fixed();

-- An HS256 JWT checked against Vault; its claims, or null. Every check is null-safe (REUSE 6.1, defect 1).
create function app.platform_jwt_claims(p_token text) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(coalesce(p_token, ''), '.');
  v_secret text := app.platform_secret('token');
  v_sig text;
  v_head jsonb;
  v_claims jsonb;
  v_now numeric := extract(epoch from now());
  b64 text;
begin
  if v_secret is null or length(coalesce(p_token, '')) > 4096 or coalesce(array_length(v_parts, 1), 0) <> 3 then
    return null;
  end if;
  v_sig := rtrim(translate(encode(extensions.hmac(v_parts[1] || '.' || v_parts[2], v_secret, 'sha256'), 'base64'), E'+/\n', '-_'), '=');
  if v_sig <> v_parts[3] then
    return null;
  end if;
  b64 := translate(v_parts[1], '-_', '+/');
  v_head := convert_from(decode(b64 || repeat('=', (4 - length(b64) % 4) % 4), 'base64'), 'UTF8')::jsonb;
  b64 := translate(v_parts[2], '-_', '+/');
  v_claims := convert_from(decode(b64 || repeat('=', (4 - length(b64) % 4) % 4), 'base64'), 'UTF8')::jsonb;
  if jsonb_typeof(v_head) = 'object' and jsonb_typeof(v_claims) = 'object'
     and coalesce(v_head ->> 'alg', '') = 'HS256'
     and coalesce(v_claims ->> 'aud', '') = 'leaderpact'
     and length(coalesce(v_claims ->> 'sub', '')) between 1 and 254
     and length(coalesce(v_claims ->> 'jti', '')) between 8 and 128
     and jsonb_typeof(v_claims -> 'exp') = 'number' and jsonb_typeof(v_claims -> 'iat') = 'number'
     and (v_claims ->> 'exp')::numeric > v_now
     and (v_claims ->> 'iat')::numeric <= v_now + 30
     and (v_claims ->> 'exp')::numeric > (v_claims ->> 'iat')::numeric
     and (v_claims ->> 'exp')::numeric - (v_claims ->> 'iat')::numeric <= 300 then
    return v_claims;
  end if;
  return null;
exception when others then
  return null;
end $$;
comment on function app.platform_jwt_claims(text) is 'A command token''s claims when its signature and every claim check pass, else null (0025). Internal.';

-- who is acting, inside a command's transaction; only platform_command sets it
create function app.platform_actor() returns text
  language sql stable set search_path = ''
as $$ select nullif(current_setting('app.platform_actor', true), '') $$;

-- Sentral's one way in. The signature first; then the audit row, so every refusal after it is recorded (REUSE 6.1,
-- defect 2) and a replayed id fails on its unique key; then the command, its scope and its arguments; then the call,
-- by parameter name, so no value enters the SQL text.
create function public.platform_command(p_token text, p_command text, p_args jsonb default '{}'::jsonb) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_claims jsonb := app.platform_jwt_claims(p_token);
  v_map app.platform_command_map%rowtype;
  v_proc record;
  v_call text;
  v_id bigint;
  v_result jsonb;
  v_args jsonb := coalesce(p_args, '{}'::jsonb);
begin
  if v_claims is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;
  begin
    insert into app.platform_commands (jti, actor, command, scope, arg_names)
    values (v_claims ->> 'jti', v_claims ->> 'sub', left(coalesce(p_command, ''), 80), left(coalesce(v_claims ->> 'scope', ''), 200),
            case when jsonb_typeof(v_args) = 'object' then array(select left(k, 64) from jsonb_object_keys(v_args) k order by 1) else '{}'::text[] end)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'replay');
  end;

  select * into v_map from app.platform_command_map m where m.command = p_command;
  if not found then
    update app.platform_commands set ok = false, error = 'unknown_command' where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'unknown_command');
  end if;
  if not (v_map.scope = any (string_to_array(coalesce(v_claims ->> 'scope', ''), ' '))) then
    update app.platform_commands set ok = false, error = 'scope' where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'scope');
  end if;
  if jsonb_typeof(v_args) <> 'object' then
    update app.platform_commands set ok = false, error = 'invalid_args' where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'invalid_args');
  end if;

  perform set_config('app.platform_actor', v_claims ->> 'sub', true);

  select p.oid::regprocedure as sig, p.proretset, p.proargnames, p.proargtypes::oid[] as types into v_proc
  from pg_catalog.pg_proc p where p.oid = to_regprocedure(v_map.fn);
  if v_proc.sig is null then
    update app.platform_commands set ok = false, error = 'function missing' where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'unavailable');
  end if;
  -- an argument the function does not take is refused, not dropped
  if exists (select 1 from jsonb_object_keys(v_args) k
             where k <> all (coalesce(v_proc.proargnames[1:coalesce(array_length(v_proc.types, 1), 0)], '{}'::text[]))) then
    update app.platform_commands set ok = false, error = 'invalid_args' where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'invalid_args');
  end if;
  select string_agg(format('%I => %s', a.name,
           case when a.typ = 'jsonb'::regtype then format('$1 -> %L', a.name)
                when a.typ = 'text[]'::regtype then format('array(select jsonb_array_elements_text($1 -> %L))', a.name)
                when a.typ = 'uuid[]'::regtype then format('array(select jsonb_array_elements_text($1 -> %L))::uuid[]', a.name)
                else format('($1 ->> %L)::%s', a.name, a.typ::regtype) end), ', ')
    into v_call
  from unnest(v_proc.proargnames[1:coalesce(array_length(v_proc.types, 1), 0)], v_proc.types) as a(name, typ)
  where v_args ? a.name;
  v_call := format('%s(%s)', regexp_replace(v_map.fn, '\(.*$', ''), coalesce(v_call, ''));

  begin
    if v_proc.proretset then
      execute format('select coalesce(jsonb_agg(x), ''[]''::jsonb) from %s x', v_call) into v_result using v_args;
    else
      execute format('select to_jsonb(%s)', v_call) into v_result using v_args;
    end if;
  exception when others then
    update app.platform_commands set ok = false, error = left(sqlstate || ' ' || sqlerrm, 240) where id = v_id;
    return jsonb_build_object('ok', false, 'error', 'failed', 'sqlstate', sqlstate);
  end;
  update app.platform_commands set ok = true where id = v_id;
  return jsonb_build_object('ok', true, 'result', v_result);
end $$;
comment on function public.platform_command(text, text, jsonb) is
  'Sentral''s one way in (0025): a signed command token, the command and its arguments by name. {ok, result} or {ok: false, error}.';

-- ---------------------------------------------------------------- the commands' functions (callable through platform_command only)
create function app.platform_require_actor() returns void
  language plpgsql stable set search_path = ''
as $$
begin
  if app.platform_actor() is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end $$;

create function app.op_orgs_list(p_search text default null, p_limit int default 200) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app.platform_require_actor();
  return coalesce((
    select jsonb_agg(x order by x.created_at desc) from (
      select o.id, o.name, o.created_at,
             (select count(*) from app.team t where t.org_id = o.id) as groups,
             (select count(distinct m.person_id) from app.membership m
              where m.org_id = o.id and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())) as members,
             app.platform_billing(o.id) as billing
      from app.organisation o
      where not o.is_demo and (coalesce(p_search, '') = '' or strpos(lower(o.name), lower(p_search)) > 0)
      order by o.created_at desc
      limit greatest(1, least(coalesce(p_limit, 200), 1000))) x), '[]'::jsonb);
end $$;

create function app.op_org_get(p_org uuid) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app.platform_require_actor();
  return (
    select jsonb_build_object(
      'id', o.id, 'name', o.name, 'created_at', o.created_at, 'threshold', o.threshold, 'retention_days', o.retention_days,
      'billing', app.platform_billing(o.id),
      'usage', app.platform_usage(o.id),
      'groups', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'name', t.name, 'created_at', t.created_at, 'access', app.group_access(t.id),
                 'members', (select count(*) from app.membership m
                             where m.team_id = t.id and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())),
                 'subscription', (select jsonb_build_object('plan', s.plan_key, 'interval', s.interval, 'state', s.state, 'currency', s.currency,
                                                            'price', round(s.amount_minor / 100.0, 2), 'method', s.method,
                                                            'current_period_end', s.current_period_end, 'cancel_effective_at', s.cancel_effective_at,
                                                            'deletion_due_at', s.deletion_due_at)
                                  from app.subscription s where s.team_id = t.id),
                 'trial_ends_at', (select tr.ends_at from app.trial tr where tr.team_id = t.id))
               order by t.created_at)
        from app.team t where t.org_id = o.id), '[]'::jsonb),
      'members', coalesce((
        select jsonb_agg(jsonb_build_object('user_id', x.person_id, 'role', x.role, 'email', u.email, 'name', p.display_name, 'groups', x.groups)
                         order by p.display_name)
        from (select m.person_id, case when bool_or(m.role = 'leader') then 'leader' else 'member' end as role, count(*) as groups
              from app.membership m
              where m.org_id = o.id and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())
              group by m.person_id) x
        join app.person p on p.id = x.person_id
        left join auth.users u on u.id = x.person_id), '[]'::jsonb),
      'invitations_open', (select count(*) from app.invitation i
                           where i.org_id = o.id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()))
    from app.organisation o where o.id = p_org and not o.is_demo);
end $$;

-- orgs.resync (Orgpuls 0207): what the triggers would have said, again, for one organisation or all
create function app.op_platform_resync(p_org uuid default null) returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  r record;
  m record;
  n int := 0;
begin
  perform app.platform_require_actor();
  for r in select o.* from app.organisation o where (p_org is null or o.id = p_org) and not o.is_demo order by o.created_at loop
    perform app.platform_emit('org.created', r.id, jsonb_build_object(
      'name', r.name, 'created_at', r.created_at,
      'group_size', (select s.member_count from app.scan_session s where s.org_id = r.id order by s.opens_at, s.id limit 1)));
    perform app.platform_emit('billing.changed', r.id, app.platform_billing(r.id));
    n := n + 2;
    for m in select distinct x.person_id from app.membership x
             where x.org_id = r.id and x.valid_from <= now() and (x.valid_to is null or x.valid_to > now()) loop
      perform app.platform_member_state(r.id, m.person_id);
      n := n + 1;
    end loop;
    perform app.platform_emit('usage.daily', r.id, app.platform_usage(r.id));
    n := n + 1;
  end loop;
  return n;
end $$;

-- billing: a group's subscription, by Sentral; the triggers tell Sentral what it became
create function app.platform_audit(p_org uuid, p_kind text, p_detail jsonb) returns void
  language sql volatile security definer set search_path = ''
as $$
  insert into app.audit_event (org_id, kind, actor, detail) values (p_org, p_kind, null, p_detail || jsonb_build_object('by', 'platform'))
$$;

create function app.op_billing_cancel(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s app.subscription%rowtype;
begin
  perform app.platform_require_actor();
  select * into v_s from app.subscription s where s.team_id = p_team for update;
  if v_s.team_id is null or v_s.state not in ('active', 'past_due') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.subscription
  set state = 'cancelled', cancelled_at = now(), past_due_since = null,
      cancel_effective_at = greatest(current_period_end, now()),
      deletion_due_at = greatest(current_period_end, now()) + make_interval(days => app.setting_int('retention_after_cancel_days'))
  where team_id = p_team;
  perform app.platform_audit(v_s.org_id, 'plan_changed', jsonb_build_object('team', p_team, 'plan', v_s.plan_key, 'state', 'cancelled'));
  return jsonb_build_object('ok', true);
end $$;

create function app.op_billing_cancel_withdraw(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s app.subscription%rowtype;
begin
  perform app.platform_require_actor();
  select * into v_s from app.subscription s where s.team_id = p_team for update;
  if v_s.team_id is null or v_s.state <> 'cancelled' or now() >= v_s.cancel_effective_at then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.subscription set state = 'active', cancelled_at = null, cancel_effective_at = null, deletion_due_at = null
  where team_id = p_team;
  perform app.platform_audit(v_s.org_id, 'plan_changed', jsonb_build_object('team', p_team, 'plan', v_s.plan_key, 'state', 'active'));
  return jsonb_build_object('ok', true);
end $$;

-- to Free now: the plan ends today, and the Team data is kept for the retention, as after a cancel
create function app.op_billing_move_to_free(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s app.subscription%rowtype;
begin
  perform app.platform_require_actor();
  select * into v_s from app.subscription s where s.team_id = p_team for update;
  if v_s.team_id is null or (v_s.state = 'cancelled' and v_s.cancel_effective_at <= now()) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.subscription
  set state = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), past_due_since = null, cancel_effective_at = now(),
      current_period_end = least(current_period_end, now()),
      deletion_due_at = now() + make_interval(days => app.setting_int('retention_after_cancel_days'))
  where team_id = p_team;
  perform app.platform_audit(v_s.org_id, 'plan_changed', jsonb_build_object('team', p_team, 'plan', 'free', 'state', 'cancelled'));
  return jsonb_build_object('ok', true);
end $$;

-- an invoice paid, or a payment failed (owner D1): paid renews the period (and ends a grace or read-only state);
-- failed starts the grace
create function app.op_billing_set_status(p_team uuid, p_status text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s app.subscription%rowtype;
begin
  perform app.platform_require_actor();
  select * into v_s from app.subscription s where s.team_id = p_team for update;
  if v_s.team_id is null or p_status is null or p_status not in ('paid', 'failed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_status = 'paid' and v_s.state in ('active', 'past_due', 'read_only') then
    update app.subscription s set state = 'active', past_due_since = null,
      current_period_end = greatest(s.current_period_end, now()) + case when s.interval = 'year' then interval '1 year' else interval '1 month' end
    where s.team_id = p_team;
    perform app.platform_audit(v_s.org_id, 'plan_changed', jsonb_build_object('team', p_team, 'plan', v_s.plan_key, 'state', 'active'));
  elsif p_status = 'failed' and v_s.state = 'active' then
    update app.subscription set state = 'past_due', past_due_since = now(), current_period_end = least(current_period_end, now())
    where team_id = p_team;
    perform app.platform_audit(v_s.org_id, 'payment_failed', jsonb_build_object('team', p_team));
  else
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- users: deactivate (out of every group of the organisation) and resend an invitation; never add, invite or promote
create function app.op_users_deactivate(p_org uuid, p_user uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform app.platform_require_actor();
  if not exists (select 1 from app.membership m where m.org_id = p_org and m.person_id = p_user
                 and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;
  -- the only leader of a group with others stays until another member leads it (handoff 6.8)
  if exists (select 1 from app.membership m
             where m.org_id = p_org and m.person_id = p_user and m.role = 'leader' and m.valid_to is null
               and exists (select 1 from app.membership o where o.team_id = m.team_id and o.person_id <> p_user
                           and o.valid_from <= now() and (o.valid_to is null or o.valid_to > now()))) then
    return jsonb_build_object('ok', false, 'reason', 'sole_leader');
  end if;
  update app.membership m set valid_to = now()
  where m.org_id = p_org and m.person_id = p_user and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now());
  return jsonb_build_object('ok', true);
end $$;

create function app.op_users_resend_invite(p_invitation uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_i app.invitation%rowtype;
begin
  perform app.platform_require_actor();
  select * into v_i from app.invitation i where i.id = p_invitation;
  if v_i.id is null or v_i.accepted_at is not null or v_i.revoked_at is not null or v_i.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into app.outbox (kind, org_id, team_id, ref_id) values ('member_invite', v_i.org_id, v_i.team_id, v_i.id);
  return jsonb_build_object('ok', true);
end $$;

-- modules: the instruments' versions, in the reply Sentral's modules screen reads (Orgpuls admin_modules)
create function app.op_modules_list() returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app.platform_require_actor();
  return jsonb_build_object('ok', true, 'modules', coalesce((
    select jsonb_agg(jsonb_build_object(
             'key', i.key, 'version', v.version::text, 'name', i.name ->> 'en', 'status', v.status, 'body_hash', v.body_hash,
             'published_at', null, 'retired_at', null, 'validation_status', 'not_validated',
             'items', (select count(*) from app.instrument_version_item vi where vi.instrument_version_id = v.id),
             'rounds', (select count(*) from app.assessment_round r where r.instrument_version_id = v.id),
             'variants', '[]'::jsonb)
           order by i.key, v.version)
    from app.instrument_version v join app.instrument i on i.id = v.instrument_id), '[]'::jsonb));
end $$;

-- publish or withdraw a version; versions move only forward (0003)
create function app.op_modules_set_status(p_key text, p_version int, p_status text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_status text;
begin
  perform app.platform_require_actor();
  select v.id, v.status into v_id, v_status
  from app.instrument_version v join app.instrument i on i.id = v.instrument_id where i.key = p_key and v.version = p_version for update;
  if v_id is null or p_status is null or p_status not in ('published', 'retired')
     or (p_status = 'published' and v_status <> 'draft') or (p_status = 'retired' and v_status <> 'published') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.instrument_version set status = p_status where id = v_id;
  return jsonb_build_object('ok', true);
end $$;

insert into app.platform_command_map (command, scope, fn, note) values
  ('orgs.list', 'orgs:read', 'app.op_orgs_list(text,integer)', 'organisations: name, groups, members, billing'),
  ('orgs.get', 'orgs:read', 'app.op_org_get(uuid)', 'one organisation: groups and their plans, members, usage; no round, no answer'),
  ('orgs.resync', 'orgs:read', 'app.op_platform_resync(uuid)', 'tell Sentral again what it should know about one organisation, or all'),
  ('billing.cancel', 'billing:write', 'app.op_billing_cancel(uuid)', 'cancel a group''s plan at the end of its period'),
  ('billing.cancel_withdraw', 'billing:write', 'app.op_billing_cancel_withdraw(uuid)', 'withdraw a cancel before it takes effect'),
  ('billing.move_to_free', 'billing:write', 'app.op_billing_move_to_free(uuid)', 'end a group''s plan now; its Team data is kept for the retention'),
  ('billing.set_status', 'billing:write', 'app.op_billing_set_status(uuid,text)', 'an invoice paid, or a payment failed'),
  ('users.deactivate', 'users:write', 'app.op_users_deactivate(uuid,uuid)', 'take an account holder out of every group of an organisation'),
  ('users.resend_invite', 'users:write', 'app.op_users_resend_invite(uuid)', 'send an open invitation''s mail again'),
  ('modules.list', 'modules:read', 'app.op_modules_list()', 'the instruments'' versions'),
  ('modules.set_status', 'modules:write', 'app.op_modules_set_status(text,integer,text)', 'publish or withdraw a version');

-- ---------------------------------------------------------------- the export and access
insert into app.export_coverage (table_name, treatment, reason) values
  ('platform_installation', 'excluded', 'where events to Sentral go; names nobody'),
  ('platform_event_kinds', 'excluded', 'the registry of events to Sentral; names nobody'),
  ('platform_events', 'excluded', 'a delivery queue to Sentral, emptied within 30 days, and of the person''s rows when they leave'),
  ('platform_command_map', 'excluded', 'the commands Sentral may send; names nobody'),
  ('platform_commands', 'excluded', 'Sentral''s staff''s commands, by staff address; names no person of the product');

alter table app.platform_installation enable row level security;
alter table app.platform_event_kinds enable row level security;
alter table app.platform_events enable row level security;
alter table app.platform_command_map enable row level security;
alter table app.platform_commands enable row level security;

grant execute on function public.platform_command(text, text, jsonb) to anon, authenticated, service_role;
grant execute on function app.platform_events_claim(int), app.platform_events_done(bigint[], boolean, text),
  app.dispatch_authorised(text) to service_role;

-- ---------------------------------------------------------------- the schedule
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('leaderpact-platform-usage', '35 3 * * *', 'select app.platform_usage_tick()');
  end if;
end $do$;
