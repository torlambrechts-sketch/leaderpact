-- 0013_billing.sql — plans and checkout: a group's subscription, the checkout behind a payment adapter,
-- a 14-day trial, access with grace and read-only, and cancel (handoff 1, 3 and 6.18; milestone 8; REUSE 4.9;
-- owner D1, D2).
--
-- 1. **Billed per group.** A group with no subscription row is on the Free plan. Upgrading writes the row;
--    nothing else moves, so the group, its members, its scan and its profiles' shares carry over as they
--    are (handoff 6.18).
-- 2. **A 14-day Team trial, once per group** (owner D2a). The leader starts it with no billing details; the
--    group has the Team plan until it ends. Unpaid at the end, the group is on Free again, and its Team data
--    is kept for the organisation's retention, then deleted unless it subscribes. A group that has had a
--    trial or a subscription has no second trial. The trial-ending mail is milestone 16's notifications.
-- 3. **Access is one function** (`group_access`): free, trial, team, grace or read_only. A failed payment or an
--    overdue invoice gives `payment_grace_days()` of grace (7, handoff 6.18), then the group is read-only:
--    it reads everything and writes nothing of the Team plan's (`group_writable`, for every group write
--    from milestone 9). A cancel keeps the Team plan to the end of the paid period, then the group is
--    on Free again; its Team data is kept for the organisation's retention (90 days by default, handoff 8),
--    then deleted (the deletion job is milestone 16).
-- 4. **No payment vendor yet** (handoff 3, owner D1). A checkout is recorded here and completed by the
--    database's payment adapter: `none` until a vendor is named, so a checkout can be started and never
--    paid; `development` in a local or CI database (set by the fixture), so it succeeds or fails on
--    demand. A vendor's webhook will complete checkouts through a function of its own; tax is computed by
--    the vendor (owner D2c), so no tax rate is held here.
-- 5. **Read-only to clients.** Every write goes through a definer function that checks the caller: only
--    the group's leader starts a trial or a checkout, cancels or withdraws a cancel. The leader reads the billing
--    details; every member reads the plan and its state (`get_group_plan`), never the details.
-- 6. **Audited with ids only** (handoff 8): plan changes and failed payments, never an amount or an address.

-- ---------------------------------------------------------------- the grace period: a fixed rule, not a row
create function app.payment_grace_days() returns int
  language sql immutable set search_path = ''
as $$ select 7 $$;
comment on function app.payment_grace_days() is 'Days of grace after a failed payment or an overdue invoice, then read-only (handoff 6.18).';

-- ---------------------------------------------------------------- the payment adapter of this database
create table app.payment_adapter (
  singleton boolean primary key default true check (singleton),
  adapter text not null check (adapter in ('none', 'development'))
);
insert into app.payment_adapter (adapter) values ('none');
comment on table app.payment_adapter is
  'Which payment adapter completes checkouts here: none until a vendor is named; development in a local or CI database only.';

-- ---------------------------------------------------------------- a group's subscription
create table app.subscription (
  team_id uuid primary key,
  org_id uuid not null,
  plan_key text not null references app.plan (key),
  interval text not null check (interval in ('month', 'year')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  price_version int not null check (price_version > 0),
  method text not null check (method in ('card', 'invoice')),
  state text not null check (state in ('active', 'past_due', 'read_only', 'cancelled')),
  started_at timestamptz not null default now(),
  current_period_end timestamptz not null,
  past_due_since timestamptz,
  cancelled_at timestamptz,
  cancel_effective_at timestamptz,
  deletion_due_at timestamptz,
  company_name text not null check (length(btrim(company_name)) between 1 and 120),
  org_number text check (org_number is null or length(btrim(org_number)) between 1 and 40),
  country text not null check (country ~ '^[A-Z]{2}$'),
  invoice_email text check (invoice_email is null or (length(invoice_email) <= 254 and invoice_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  reference text check (reference is null or length(btrim(reference)) between 1 and 60),
  provider text not null check (provider in ('development')),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  check (state <> 'past_due' or past_due_since is not null),
  check (state <> 'cancelled' or (cancelled_at is not null and cancel_effective_at is not null and deletion_due_at is not null)),
  check (method <> 'invoice' or (org_number is not null and invoice_email is not null))
);
comment on table app.subscription is
  'A group''s paid plan (handoff 6.18): no row is Free. Written only by the billing functions; the leader reads it.';

-- ---------------------------------------------------------------- a checkout, until it is paid or fails
create table app.checkout (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  org_id uuid not null,
  created_by uuid not null references app.person (id) on delete cascade,
  plan_key text not null references app.plan (key),
  interval text not null check (interval in ('month', 'year')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  price_version int not null check (price_version > 0),
  method text not null check (method in ('card', 'invoice')),
  company_name text not null check (length(btrim(company_name)) between 1 and 120),
  org_number text check (org_number is null or length(btrim(org_number)) between 1 and 40),
  country text not null check (country ~ '^[A-Z]{2}$'),
  invoice_email text check (invoice_email is null or (length(invoice_email) <= 254 and invoice_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  reference text check (reference is null or length(btrim(reference)) between 1 and 60),
  status text not null default 'open' check (status in ('open', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  check (method <> 'invoice' or (org_number is not null and invoice_email is not null)),
  check ((status = 'open') = (completed_at is null))
);
create index checkout_team_idx on app.checkout (team_id);
comment on table app.checkout is 'A checkout of the Team plan (handoff 6.18), completed by the payment adapter. No client reads it.';

-- ---------------------------------------------------------------- a group's trial (owner D2a)
insert into app.setting (key, scope, default_value, min_value, max_value, fixed, unit) values
  ('trial_days', 'platform', '14', null, null, true, 'days');

create table app.trial (
  team_id uuid primary key,
  org_id uuid not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  check (ends_at > started_at)
);
comment on table app.trial is
  'A group''s one Team trial (owner D2a): the row stays after it ends, so no group has a second. No client reads it.';

-- ---------------------------------------------------------------- access
create function app.group_access(p_team uuid) returns text
  language sql stable security definer set search_path = ''
as $$
  select case
    when s.state = 'active' then 'team'
    when s.state = 'past_due' and now() < s.past_due_since + make_interval(days => app.payment_grace_days()) then 'grace'
    when s.state in ('past_due', 'read_only') then 'read_only'
    when s.state = 'cancelled' and now() < s.cancel_effective_at then 'team'
    when s.team_id is null and now() < t.ends_at then 'trial'
    else 'free' end
  from (select p_team as id) g
  left join app.subscription s on s.team_id = g.id
  left join app.trial t on t.team_id = g.id
$$;
comment on function app.group_access(uuid) is
  'A group''s access: free, trial, team, grace (a failed payment, still open) or read_only.';

create function app.group_writable(p_team uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$ select app.group_access(p_team) <> 'read_only' $$;
comment on function app.group_writable(uuid) is 'False while the group is read-only. Every group write of the Team plan asks it (milestone 9 on).';

create function app.plan_allows(p_team uuid, p_feature text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from app.plan_feature f
    where f.feature = p_feature
      and f.plan_key = case when app.group_access(p_team) = 'free' then 'free'
                            else coalesce((select s.plan_key from app.subscription s where s.team_id = p_team), 'team') end)
$$;
comment on function app.plan_allows(uuid, text) is 'Whether a group''s plan includes a feature, by its access (read-only still reads).';

-- what every current member may know: the plan and its state, never the billing details
create function app.get_group_plan(p_team uuid)
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
         -- after a cancel, or after a trial that ended unpaid, the Team data is kept for the retention
         case when s.team_id is not null then s.deletion_due_at
              when t.ends_at <= now() then t.ends_at + make_interval(days => app.setting_int('retention_after_cancel_days')) end,
         case when s.team_id is null then t.ends_at end,
         s.team_id is null and t.team_id is null,
         (select a.adapter from app.payment_adapter a)
  from (select p_team as id) g
  left join app.subscription s on s.team_id = g.id
  left join app.trial t on t.team_id = g.id
  where app.is_team_member(p_team)
$$;
comment on function app.get_group_plan(uuid) is
  'A group''s plan, access, dates and whether a trial is open to it, for its current members, and the payment adapter in use.';

-- ---------------------------------------------------------------- the trial
create function app.start_trial(p_team uuid) returns jsonb
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
  -- one trial per group: a second call at the same moment waits here, then finds the first
  perform 1 from app.team t where t.id = p_team for update;
  if app.group_access(p_team) <> 'free' then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  if exists (select 1 from app.trial t where t.team_id = p_team) or exists (select 1 from app.subscription s where s.team_id = p_team) then
    return jsonb_build_object('ok', false, 'reason', 'trial_used');
  end if;
  select t.org_id into v_org from app.team t where t.id = p_team;
  insert into app.trial (team_id, org_id, ends_at) values (p_team, v_org, now() + make_interval(days => app.setting_int('trial_days')));
  insert into app.audit_event (org_id, kind, actor, detail)
  values (v_org, 'plan_changed', v_uid, jsonb_build_object('team', p_team, 'plan', 'team', 'state', 'trial'));
  return jsonb_build_object('ok', true);
end $$;
comment on function app.start_trial(uuid) is
  'The group''s leader starts its one Team trial (owner D2a), with no billing details. Refused once a group has had a trial or a plan.';

-- ---------------------------------------------------------------- checkout
create function app.start_checkout(p_team uuid, p_interval text, p_method text, p_company text, p_org_number text,
                                   p_country text, p_invoice_email text, p_reference text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_price record;
  v_company text := nullif(btrim(coalesce(p_company, '')), '');
  v_number text := nullif(btrim(coalesce(p_org_number, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_invoice_email, ''))), '');
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if app.group_access(p_team) not in ('free', 'trial') then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  if p_interval is null or p_interval not in ('year', 'month') or p_method is null or p_method not in ('card', 'invoice')
     or v_company is null or length(v_company) > 120 or p_country is null or p_country !~ '^[A-Z]{2}$'
     or (v_number is not null and length(v_number) > 40) or (v_reference is not null and length(v_reference) > 60)
     or (v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
     or (p_method = 'invoice' and (v_number is null or v_email is null)) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- the Team plan's price in force for the interval (handoff 1: test prices, held as data)
  select p.currency, p.amount_minor, p.version into v_price
  from app.plan_price p
  where p.plan_key = 'team' and p.interval = p_interval and p.valid_from <= now()
  order by p.version desc
  limit 1;
  if v_price.version is null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  select t.org_id into v_org from app.team t where t.id = p_team;
  insert into app.checkout (team_id, org_id, created_by, plan_key, interval, currency, amount_minor, price_version, method,
                            company_name, org_number, country, invoice_email, reference)
  values (p_team, v_org, v_uid, 'team', p_interval, v_price.currency, v_price.amount_minor, v_price.version, p_method,
          v_company, v_number, p_country, v_email, v_reference)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'checkout', v_id, 'currency', v_price.currency, 'amount_minor', v_price.amount_minor);
end $$;
comment on function app.start_checkout(uuid, text, text, text, text, text, text, text) is
  'The group''s leader starts a checkout of the Team plan, at the price in force: {ok, checkout, currency, amount_minor}.';

-- the development adapter's result; a vendor's webhook will have a function of its own
create function app.complete_checkout(p_checkout uuid, p_outcome text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_c app.checkout%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if (select a.adapter from app.payment_adapter a) <> 'development' then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if p_outcome is null or p_outcome not in ('paid', 'failed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into v_c from app.checkout c where c.id = p_checkout for update;
  if v_c.id is null or v_c.created_by <> v_uid or not app.is_team_leader(v_c.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if v_c.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  if p_outcome = 'failed' then
    update app.checkout set status = 'failed', completed_at = now() where id = v_c.id;
    insert into app.audit_event (org_id, kind, actor, detail)
    values (v_c.org_id, 'payment_failed', v_uid, jsonb_build_object('team', v_c.team_id, 'checkout', v_c.id));
    return jsonb_build_object('ok', true, 'paid', false);
  end if;

  -- a trial ends when the plan is paid for; the paid period starts now (D-33)
  if app.group_access(v_c.team_id) not in ('free', 'trial') then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  -- the group's subscription: a new row, or one whose cancel has ended
  insert into app.subscription (team_id, org_id, plan_key, interval, currency, amount_minor, price_version, method, state,
                                started_at, current_period_end, company_name, org_number, country, invoice_email, reference, provider)
  values (v_c.team_id, v_c.org_id, v_c.plan_key, v_c.interval, v_c.currency, v_c.amount_minor, v_c.price_version, v_c.method, 'active',
          now(), now() + case when v_c.interval = 'year' then interval '1 year' else interval '1 month' end,
          v_c.company_name, v_c.org_number, v_c.country, v_c.invoice_email, v_c.reference, 'development')
  on conflict (team_id) do update set
    plan_key = excluded.plan_key, interval = excluded.interval, currency = excluded.currency, amount_minor = excluded.amount_minor,
    price_version = excluded.price_version, method = excluded.method, state = 'active', started_at = excluded.started_at,
    current_period_end = excluded.current_period_end, past_due_since = null, cancelled_at = null, cancel_effective_at = null,
    deletion_due_at = null, company_name = excluded.company_name, org_number = excluded.org_number, country = excluded.country,
    invoice_email = excluded.invoice_email, reference = excluded.reference, provider = excluded.provider;
  update app.checkout set status = 'paid', completed_at = now() where id = v_c.id;
  insert into app.audit_event (org_id, kind, actor, detail)
  values (v_c.org_id, 'plan_changed', v_uid, jsonb_build_object('team', v_c.team_id, 'plan', v_c.plan_key, 'interval', v_c.interval));
  return jsonb_build_object('ok', true, 'paid', true);
end $$;
comment on function app.complete_checkout(uuid, text) is
  'The development adapter completes the leader''s open checkout, paid or failed. Refused unless this database runs that adapter.';

-- the development adapter's later events: a failed renewal, a payment received, the grace period over
create function app.dev_billing_event(p_team uuid, p_event text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s app.subscription%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if (select a.adapter from app.payment_adapter a) <> 'development' then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if p_event = 'trial_ended' then
    -- the trial, run out at once: for showing a trial that ended unpaid in development
    if app.group_access(p_team) <> 'trial' then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    update app.trial set started_at = now() - make_interval(days => app.setting_int('trial_days'), mins => 1),
                         ends_at = now() - interval '1 minute'
    where team_id = p_team;
    return jsonb_build_object('ok', true);
  end if;
  select * into v_s from app.subscription s where s.team_id = p_team for update;
  if v_s.team_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_subscription');
  end if;

  if p_event = 'payment_failed' and v_s.state = 'active' then
    -- the renewal at the period's end failed: the paid period is over, and the grace runs from now
    update app.subscription set state = 'past_due', past_due_since = now(), current_period_end = least(current_period_end, now())
    where team_id = p_team;
    insert into app.audit_event (org_id, kind, actor, detail)
    values (v_s.org_id, 'payment_failed', v_uid, jsonb_build_object('team', p_team));
  elsif p_event = 'grace_ended' and v_s.state = 'past_due' then
    -- the grace period, run out at once: for showing the read-only state in development
    update app.subscription set past_due_since = now() - make_interval(days => app.payment_grace_days(), mins => 1) where team_id = p_team;
  elsif p_event = 'payment_received' and v_s.state in ('past_due', 'read_only') then
    update app.subscription s set state = 'active', past_due_since = null,
      current_period_end = greatest(s.current_period_end, now()) + case when s.interval = 'year' then interval '1 year' else interval '1 month' end
    where s.team_id = p_team;
    insert into app.audit_event (org_id, kind, actor, detail)
    values (v_s.org_id, 'plan_changed', v_uid, jsonb_build_object('team', p_team, 'plan', v_s.plan_key, 'state', 'active'));
  else
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.dev_billing_event(uuid, text) is
  'Development adapter only: the trial or the grace period run out, a failed renewal, or a payment received, for the group''s leader.';

-- ---------------------------------------------------------------- cancel, and withdraw a cancel
create function app.cancel_subscription(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s app.subscription%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  select * into v_s from app.subscription s where s.team_id = p_team for update;
  if v_s.team_id is null or v_s.state not in ('active', 'past_due') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  -- the plan runs to the end of the paid period; the Team data is kept for the retention, then deleted
  update app.subscription
  set state = 'cancelled', cancelled_at = now(), past_due_since = null,
      cancel_effective_at = greatest(current_period_end, now()),
      deletion_due_at = greatest(current_period_end, now()) + make_interval(days => app.setting_int('retention_after_cancel_days'))
  where team_id = p_team;
  insert into app.audit_event (org_id, kind, actor, detail)
  values (v_s.org_id, 'plan_changed', v_uid, jsonb_build_object('team', p_team, 'plan', v_s.plan_key, 'state', 'cancelled'));
  return jsonb_build_object('ok', true);
end $$;
comment on function app.cancel_subscription(uuid) is
  'The leader cancels: the Team plan runs to the end of the period, then Free; the Team data is kept for the retention.';

create function app.withdraw_cancel(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_s app.subscription%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  select * into v_s from app.subscription s where s.team_id = p_team for update;
  if v_s.team_id is null or v_s.state <> 'cancelled' or now() >= v_s.cancel_effective_at then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  update app.subscription set state = 'active', cancelled_at = null, cancel_effective_at = null, deletion_due_at = null
  where team_id = p_team;
  insert into app.audit_event (org_id, kind, actor, detail)
  values (v_s.org_id, 'plan_changed', v_uid, jsonb_build_object('team', p_team, 'plan', v_s.plan_key, 'state', 'active'));
  return jsonb_build_object('ok', true);
end $$;
comment on function app.withdraw_cancel(uuid) is 'The leader withdraws a cancel before it takes effect.';

-- ---------------------------------------------------------------- access
alter table app.payment_adapter enable row level security;
alter table app.subscription enable row level security;
alter table app.checkout enable row level security;
alter table app.trial enable row level security;
revoke all on app.payment_adapter, app.subscription, app.checkout, app.trial from anon, authenticated, service_role;

-- the leader reads the group's billing details; nobody writes them but the functions
create policy subscription_leader on app.subscription for select to authenticated using (app.is_team_leader(team_id));
grant select on app.subscription to authenticated;

grant execute on function app.get_group_plan(uuid), app.start_trial(uuid), app.start_checkout(uuid, text, text, text, text, text, text, text),
  app.complete_checkout(uuid, text), app.dev_billing_event(uuid, text), app.cancel_subscription(uuid), app.withdraw_cancel(uuid)
  to authenticated;
