-- 0021_limits.sql — rate limits that answer 429 (handoff 8, Rate limits; milestone 16: "Limits return 429";
-- REUSE 4.18; D-53).
--
-- 1. **The limits are rows** (`rate_limit`): a bucket, how many in how many seconds. Handoff 8's table:
--    the public scan 60 an hour per network, sign-in links 5 an hour per address, the authenticated API 120 a
--    minute per person, live meeting events 10 a second per person, and the data export 5 a day per person.
--    Invitation mail (50 a group a day) waits for the next day instead, in the mail claim (0022).
-- 2. **No address is stored.** A counter is keyed by a SHA-256: of a person's id, or, for the scan and
--    sign-in, of a network or an address the app keys with a secret of its own before it reaches the
--    database, so no row names a person, an address or an IP (REUSE 5: no whole IP address is stored).
-- 3. **One counter** (`take_rate`): a fixed window per bucket and key, counted in one statement. It answers 0
--    when a request may go on, or the seconds until it may.
-- 4. **The API's own limits** (`pre_request`): PostgREST runs it before every request (`db-pre-request`). For a
--    signed-in caller it counts every request that writes, which is every RPC the app makes, and answers
--    HTTP 429 with the seconds to wait past the limit; a live meeting's events have their own, per second. A
--    read-only request (a GET) cannot write its count and is not counted.
-- 5. **Clients reach the counter only for the scan and sign-in**, through the app, which keys them; the
--    export counts in its own function (0023). Old windows are pruned by the job.

-- ---------------------------------------------------------------- the limits, as rows (handoff 8)
create table app.rate_limit (
  bucket text primary key check (bucket ~ '^[a-z][a-z_]*[a-z]$'),
  max_hits int not null check (max_hits > 0),
  window_seconds int not null check (window_seconds > 0)
);
comment on table app.rate_limit is
  'Handoff 8''s rate limits: how many requests per bucket in how many seconds. A breach answers 429.';
insert into app.rate_limit (bucket, max_hits, window_seconds) values
  ('scan_submit', 60, 3600),
  ('sign_in', 5, 3600),
  ('api', 120, 60),
  ('live_event', 10, 1),
  ('export', 5, 86400);

-- ---------------------------------------------------------------- the counter: a hash, a window, a count
create table app.rate_window (
  bucket text not null references app.rate_limit (bucket) on delete cascade,
  -- SHA-256 of the key: a person's id, or the app's keyed hash of a network or an address
  key_hash bytea not null check (length(key_hash) = 32),
  window_start timestamptz not null,
  hits int not null check (hits > 0),
  primary key (bucket, key_hash)
);
comment on table app.rate_window is
  'Rate counters: a bucket, a hash and a window. No address, no IP and no person. No client reads it.';

alter table app.rate_limit enable row level security;
alter table app.rate_window enable row level security;
revoke all on app.rate_limit, app.rate_window from anon, authenticated, service_role;

-- One hit on a bucket for a key. Answers 0 when the request may go on, or the whole seconds until the window
-- ends. The upsert counts under the row's lock, so two requests at once are counted as two.
create function app.take_rate(p_bucket text, p_key text) returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_l app.rate_limit;
  v_w app.rate_window;
begin
  select * into v_l from app.rate_limit l where l.bucket = p_bucket;
  if not found or p_key is null or length(p_key) not between 1 and 200 then
    raise exception 'rate: no such bucket or key' using errcode = 'invalid_parameter_value';
  end if;
  insert into app.rate_window as w (bucket, key_hash, window_start, hits)
  values (p_bucket, pg_catalog.sha256(convert_to(p_key, 'UTF8')), now(), 1)
  on conflict (bucket, key_hash) do update
    set hits = case when w.window_start + make_interval(secs => v_l.window_seconds) <= now() then 1 else w.hits + 1 end,
        window_start = case when w.window_start + make_interval(secs => v_l.window_seconds) <= now() then now() else w.window_start end
  returning * into v_w;
  if v_w.hits <= v_l.max_hits then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (v_w.window_start + make_interval(secs => v_l.window_seconds) - now())))::int);
end $$;
comment on function app.take_rate(text, text) is
  'One request on a bucket for a key: 0 to go on, or the seconds until the window ends. Internal.';

-- The scan and sign-in limits, for the app: their keys are the app's keyed hashes of a network or an address
-- (64 hex characters), so a caller who does not hold the app's secret cannot spend another network's count.
create function app.take_public_rate(p_bucket text, p_key text) returns int
  language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_bucket not in ('scan_submit', 'sign_in') or p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'rate: not a public bucket or key' using errcode = 'invalid_parameter_value';
  end if;
  return app.take_rate(p_bucket, p_key);
end $$;
comment on function app.take_public_rate(text, text) is
  'The app''s count for the public scan and sign-in links, by its keyed hash: 0 to go on, or the seconds to wait (handoff 8).';

-- ---------------------------------------------------------------- the API's own limits (PostgREST pre-request)
-- Every request that writes counts for its signed-in caller: 120 a minute. The live meeting's events count
-- again, 10 a second. Past either, HTTP 429 with the seconds to wait; the request does nothing.
create function app.pre_request() returns void
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_sub text := v_claims ->> 'sub';
  v_path text := coalesce(current_setting('request.path', true), '');
  v_wait int;
begin
  if v_sub is null or coalesce(v_claims ->> 'role', '') <> 'authenticated' or current_setting('transaction_read_only') = 'on' then
    return;
  end if;
  v_wait := app.take_rate('api', v_sub);
  if v_wait = 0 and v_path ~ '^/rpc/(run_meeting|start_meeting|end_meeting|save_decision|add_item_action|park_topic|send_process_comment|meeting_here)$' then
    v_wait := app.take_rate('live_event', v_sub);
  end if;
  if v_wait > 0 then
    -- PostgREST answers PTxyz with HTTP xyz; the detail is the seconds to wait, for Retry-After
    raise sqlstate 'PT429' using message = 'rate_limited', detail = v_wait::text;
  end if;
end $$;
comment on function app.pre_request() is
  'PostgREST''s pre-request: 120 writes a minute per signed-in person, 10 live meeting events a second; past either, HTTP 429.';

-- ---------------------------------------------------------------- pruning (the job)
create function app.prune_rate_windows() returns int
  language sql volatile security definer set search_path = ''
as $$
  with gone as (
    delete from app.rate_window w using app.rate_limit l
    where l.bucket = w.bucket and w.window_start + make_interval(secs => l.window_seconds) < now() - interval '1 hour'
    returning 1)
  select count(*)::int from gone
$$;
comment on function app.prune_rate_windows() is 'Removes counters whose window ended over an hour ago. The scheduled job.';

-- ---------------------------------------------------------------- grants and PostgREST
grant execute on function app.take_public_rate(text, text) to anon, authenticated;
grant execute on function app.pre_request() to anon, authenticated;
grant execute on function app.prune_rate_windows() to service_role;

do $$
begin
  -- PostgREST reads its pre-request from the authenticator role's settings, then reloads
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request = ''app.pre_request''';
    perform pg_notify('pgrst', 'reload config');
  end if;
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('leaderpact-prune-rate-windows', '17 * * * *', 'select app.prune_rate_windows()');
  end if;
end $$;
