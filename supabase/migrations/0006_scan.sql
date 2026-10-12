-- 0006_scan.sql — the Leadership Team Scan: one link for the group, answers stored under no person,
-- a team view computed once at close (handoff 6.4-6.6; REUSE 4.4).
--
-- 1. **A scan session belongs to a group** and carries its link's code, the declared member count (4 to
--    15, the leader included, owner C4), the threshold frozen when it was made, and a window of 2 to 14
--    days fixed from the start. The leader's own scan stays on their device until the group exists
--    (REUSE 4.7), so no session, and no answer, exists before sign-up (D-15).
-- 2. **Answers are unreadable.** `scan_response_set` carries an id, its organisation, its session and its
--    instrument version: no person, and no time at all (CLAUDE.md invariant 2). It and `scan_response` and
--    `scan_replace_key` have row-level security, no policy and no grant to any role, `service_role`
--    included (invariant 3).
-- 3. **One write path**, `submit_scan`, in one transaction, returning `{ok, replace_key}` or a reason and
--    never an id (invariant 4). Responses are capped at the member count (owner C1: padding is accepted
--    on the open link and the copy promises nothing more). The session's row lock serialises submissions,
--    so the cap holds under concurrency.
-- 4. **Replacement from the same browser** (handoff 6.5, owner C2). The browser holds a random key; the
--    database holds only its SHA-256, in a table no role can read. A second submission with the key
--    replaces the first and takes its slot. Every key is deleted when the scan closes, and no function
--    reads answers by key.
-- 5. **Closing** (`close_scan`, run by the scheduled job; the leader cannot close early, handoff 6.4). At
--    or above the threshold: the snapshot is written once, then, in the same transaction, the response
--    sets are re-inserted in random order with new ids and the originals deleted, so no transaction id or
--    row order links a set to the moment it was written (owner C3). Below it: one 7-day extension while
--    seats are left, then no team view, and the answers are deleted (owner C9).
-- 6. **Reading** (`get_team_view`, `get_team_view_by_code`): levels and agreement labels per theme, only
--    for a released session, only at or above its threshold. Members without an account read through the
--    link; members of the group through their membership. The count and the closing date read the same
--    two ways, and never a score while the scan is open (handoff 6.4).

-- ---------------------------------------------------------------- shared by both write paths
create function app.setting_int(p_key text) returns int
  language sql stable security definer set search_path = ''
as $$ select (s.default_value #>> '{}')::int from app.setting s where s.key = p_key $$;

-- The answers of a submission, checked against the version it answers: a JSON array of
-- {"item": <uuid>, "value": 1..5}, every item of the version exactly once. Raises with a fixed message
-- that names no value, so nothing an answer holds reaches an error or a log (CLAUDE.md invariant 10).
create function app.checked_answers(p_answers jsonb, p_version uuid)
  returns table (item_id uuid, value smallint)
  language plpgsql stable security definer set search_path = ''
as $$
declare
  v_e jsonb;
  v_items uuid[] := '{}';
  v_values smallint[] := '{}';
  v_value numeric;
  v_expected int;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'answers: not a list' using errcode = 'invalid_parameter_value';
  end if;
  for v_e in select e from jsonb_array_elements(p_answers) e loop
    if jsonb_typeof(v_e) <> 'object' or jsonb_typeof(v_e -> 'item') <> 'string' or jsonb_typeof(v_e -> 'value') <> 'number' then
      raise exception 'answers: an entry is malformed' using errcode = 'invalid_parameter_value';
    end if;
    v_value := (v_e ->> 'value')::numeric;
    if v_value not in (1, 2, 3, 4, 5) then
      raise exception 'answers: a value is out of range' using errcode = 'invalid_parameter_value';
    end if;
    begin
      v_items := v_items || (v_e ->> 'item')::uuid;
    exception when invalid_text_representation then
      raise exception 'answers: an item is malformed' using errcode = 'invalid_parameter_value';
    end;
    v_values := v_values || v_value::smallint;
  end loop;
  select count(*) into v_expected from app.instrument_version_item vi where vi.instrument_version_id = p_version;
  if cardinality(v_items) <> v_expected
     or (select count(distinct x) from unnest(v_items) x) <> v_expected
     or exists (select 1 from unnest(v_items) x
                where not exists (select 1 from app.instrument_version_item vi
                                  where vi.instrument_version_id = p_version and vi.item_id = x)) then
    raise exception 'answers: not every item of the version exactly once' using errcode = 'invalid_parameter_value';
  end if;
  return query select x.item_id, x.value from unnest(v_items, v_values) as x (item_id, value);
end $$;

-- a key the browser keeps: 32 random bytes, base64url
create function app.new_replace_key() returns text
  language sql volatile set search_path = ''
as $$ select translate(rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='), '+/', '-_') $$;

-- ---------------------------------------------------------------- the session
create table app.scan_session (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  instrument_version_id uuid not null references app.instrument_version (id),
  -- the invite link's capability: /j/<code>. Readable by the group's current members (get_scan_link).
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{22,64}$'),
  member_count int not null check (member_count between 4 and 15),
  k int not null check (k between app.k_floor() and app.k_max()),
  window_days int not null check (window_days between 2 and 14),
  phase text not null default 'open' check (phase in ('open', 'closed', 'released')),
  -- how many have answered: a count, never who (handoff 6.4)
  answered int not null default 0 check (answered >= 0 and answered <= member_count),
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  extended boolean not null default false,
  check (closes_at > opens_at),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade
);
create index scan_session_team_idx on app.scan_session (team_id);
create index scan_session_due_idx on app.scan_session (closes_at) where phase = 'open';
comment on table app.scan_session is
  'A group''s Leadership Team Scan: the link, the member count, the frozen threshold, the count of answers. Never a score until released.';

-- what is fixed once the session exists, and the phase that only moves forward
create function app.scan_session_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.org_id, old.team_id, old.instrument_version_id, old.code, old.member_count, old.k, old.window_days, old.opens_at)
     is distinct from (new.org_id, new.team_id, new.instrument_version_id, new.code, new.member_count, new.k, new.window_days, new.opens_at) then
    raise exception 'a scan session''s link, size, threshold and window are fixed once it opens' using errcode = 'check_violation';
  end if;
  if old.phase <> 'open' and new.phase is distinct from old.phase then
    raise exception 'a closed scan is not reopened' using errcode = 'check_violation';
  end if;
  if new.closes_at <> old.closes_at and (old.extended or not new.extended) then
    raise exception 'a scan''s closing date moves once, by its one extension' using errcode = 'check_violation';
  end if;
  if old.extended and not new.extended then
    raise exception 'an extension is not undone' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger scan_session_fixed before update on app.scan_session for each row execute function app.scan_session_fixed();

alter table app.scan_session enable row level security;
create policy scan_session_read on app.scan_session for select to authenticated using (app.is_team_member(team_id));
-- every column but the code, which a member reads through get_scan_link
grant select (id, org_id, team_id, instrument_version_id, member_count, k, window_days, phase, answered, opens_at, closes_at, extended)
  on app.scan_session to authenticated;

-- ---------------------------------------------------------------- answers: unreadable by every role
create table app.scan_response_set (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references app.organisation (id) on delete cascade,
  scan_session_id uuid not null references app.scan_session (id) on delete cascade,
  instrument_version_id uuid not null references app.instrument_version (id)
);
create index scan_response_set_session_idx on app.scan_response_set (scan_session_id);
comment on table app.scan_response_set is
  'One anonymous submission. No person and no time (CLAUDE.md invariant 2). No policy, no grant.';

create table app.scan_response (
  scan_response_set_id uuid not null references app.scan_response_set (id) on delete cascade,
  item_id uuid not null references app.item (id),
  value smallint not null check (value between 1 and 5),
  primary key (scan_response_set_id, item_id)
);

-- the sealed replace key (owner C2): a hash only, deleted at close
create table app.scan_replace_key (
  key_hash bytea primary key check (length(key_hash) = 32),
  scan_session_id uuid not null references app.scan_session (id) on delete cascade,
  scan_response_set_id uuid not null unique references app.scan_response_set (id) on delete cascade
);
create index scan_replace_key_session_idx on app.scan_replace_key (scan_session_id);

alter table app.scan_response_set enable row level security;
alter table app.scan_response enable row level security;
alter table app.scan_replace_key enable row level security;
revoke all on app.scan_response_set, app.scan_response, app.scan_replace_key from anon, authenticated, service_role;

-- nobody may change an answer: a set is replaced whole, never edited
create function app.forbid_answer_change() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  raise exception 'an answer is never changed' using errcode = 'check_violation';
end $$;
create trigger scan_response_set_fixed before update on app.scan_response_set for each row execute function app.forbid_answer_change();
create trigger scan_response_fixed before update on app.scan_response for each row execute function app.forbid_answer_change();

-- ---------------------------------------------------------------- the snapshot, written once at close
create table app.scan_theme_score (
  scan_session_id uuid not null references app.scan_session (id) on delete cascade,
  theme_id uuid not null references app.scan_theme (id),
  org_id uuid not null references app.organisation (id) on delete cascade,
  n int not null check (n >= app.k_floor()),
  level numeric(2, 1) not null check (level between 1 and 5),
  -- never shown: readers return the label only (handoff 7)
  agreement numeric(5, 4) not null check (agreement between 0 and 1),
  agreement_label text not null check (agreement_label in ('high', 'medium', 'low')),
  cutoff_version int not null references app.cutoff_set (version),
  instrument_version_id uuid not null references app.instrument_version (id),
  primary key (scan_session_id, theme_id)
);
alter table app.scan_theme_score enable row level security;
revoke all on app.scan_theme_score from anon, authenticated, service_role;
create trigger scan_theme_score_fixed before update on app.scan_theme_score for each row execute function app.forbid_answer_change();
comment on table app.scan_theme_score is 'The team view, computed once at close (handoff 6.6). Read only by get_team_view.';

-- ---------------------------------------------------------------- the one write path
create function app.submit_scan(p_code text, p_answers jsonb, p_replace_key text default null) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s app.scan_session;
  v_set uuid;
  v_key text;
  v_replaced boolean := false;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{22,64}$' then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  -- the row lock serialises every submission to this scan, so the cap and the close hold under load
  select * into v_s from app.scan_session s where s.code = p_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_s.phase <> 'open' or now() >= v_s.closes_at then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  -- check every answer before anything is written
  begin
    perform 1 from app.checked_answers(p_answers, v_s.instrument_version_id);
  exception when invalid_parameter_value then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end;

  -- the same browser again: its earlier set goes, and its slot is reused (owner C2)
  if p_replace_key is not null and length(p_replace_key) between 1 and 128 then
    delete from app.scan_response_set rs
    using app.scan_replace_key k
    where k.key_hash = pg_catalog.sha256(convert_to(p_replace_key, 'UTF8'))
      and k.scan_session_id = v_s.id and rs.id = k.scan_response_set_id;
    v_replaced := found;
  end if;

  if not v_replaced then
    if v_s.answered >= v_s.member_count then
      return jsonb_build_object('ok', false, 'reason', 'full');
    end if;
    update app.scan_session set answered = answered + 1 where id = v_s.id returning * into v_s;
  end if;

  insert into app.scan_response_set (org_id, scan_session_id, instrument_version_id)
  values (v_s.org_id, v_s.id, v_s.instrument_version_id)
  returning id into v_set;
  insert into app.scan_response (scan_response_set_id, item_id, value)
  select v_set, a.item_id, a.value from app.checked_answers(p_answers, v_s.instrument_version_id) a;

  v_key := app.new_replace_key();
  insert into app.scan_replace_key (key_hash, scan_session_id, scan_response_set_id)
  values (pg_catalog.sha256(convert_to(v_key, 'UTF8')), v_s.id, v_set);

  -- every member has answered: the scan closes now, in this transaction (handoff 6.4)
  if v_s.answered >= v_s.member_count then
    perform app.close_scan(v_s.id);
    return jsonb_build_object('ok', true, 'replace_key', null);
  end if;
  return jsonb_build_object('ok', true, 'replace_key', v_key);
end $$;
comment on function app.submit_scan(text, jsonb, text) is
  'The scan''s one write path: {ok, replace_key} or {ok: false, reason}; never an id (CLAUDE.md invariant 4).';

-- ---------------------------------------------------------------- closing
create function app.close_scan(p_scan uuid) returns text
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s app.scan_session;
  v_cut int := app.cutoff_version();
  v_old uuid;
  v_new uuid;
begin
  select * into v_s from app.scan_session s where s.id = p_scan for update;
  if not found or v_s.phase <> 'open' then
    return v_s.phase;
  end if;
  -- due when every seat is taken or the window has ended; otherwise nothing happens
  if v_s.answered < v_s.member_count and now() < v_s.closes_at then
    return 'open';
  end if;

  if v_s.answered >= v_s.k then
    -- the snapshot, once: per theme, each set's sum over the theme's two items
    insert into app.scan_theme_score
      (scan_session_id, theme_id, org_id, n, level, agreement, agreement_label, cutoff_version, instrument_version_id)
    select v_s.id, t.theme_id, v_s.org_id, count(*)::int, app.level(sum(t.s), count(*) * max(t.items)),
           app.agreement_value(array_agg(t.s), max(t.items)), app.agreement_label(array_agg(t.s), max(t.items), v_cut),
           v_cut, v_s.instrument_version_id
    from (
      select vi.theme_id, r.scan_response_set_id, sum(r.value)::int as s, count(*)::int as items
      from app.scan_response r
      join app.scan_response_set rs on rs.id = r.scan_response_set_id
      join app.instrument_version_item vi on vi.instrument_version_id = rs.instrument_version_id and vi.item_id = r.item_id
      where rs.scan_session_id = v_s.id
      group by vi.theme_id, r.scan_response_set_id) t
    group by t.theme_id;

    -- the reshuffle (owner C3): new ids, random order, originals gone, keys gone
    for v_old in select rs.id from app.scan_response_set rs where rs.scan_session_id = v_s.id order by random() loop
      v_new := gen_random_uuid();
      insert into app.scan_response_set (id, org_id, scan_session_id, instrument_version_id)
      select v_new, rs.org_id, rs.scan_session_id, rs.instrument_version_id from app.scan_response_set rs where rs.id = v_old;
      insert into app.scan_response (scan_response_set_id, item_id, value)
      select v_new, r.item_id, r.value from app.scan_response r where r.scan_response_set_id = v_old order by random();
      delete from app.scan_response_set rs where rs.id = v_old;
    end loop;
    delete from app.scan_replace_key k where k.scan_session_id = v_s.id;

    update app.scan_session set phase = 'released' where id = v_s.id;
    insert into app.audit_event (org_id, kind, detail) values
      (v_s.org_id, 'round_closed', jsonb_build_object('scan', v_s.id)),
      (v_s.org_id, 'results_released', jsonb_build_object('scan', v_s.id));
    return 'released';
  end if;

  -- below the threshold: one extension while seats are left (handoff 6.6)
  if not v_s.extended and v_s.answered < v_s.member_count then
    update app.scan_session
    set extended = true, closes_at = greatest(closes_at, now()) + make_interval(days => app.setting_int('extension_days'))
    where id = v_s.id;
    insert into app.audit_event (org_id, kind, detail) values (v_s.org_id, 'round_extended', jsonb_build_object('scan', v_s.id));
    return 'open';
  end if;

  -- then no team view, and the answers go (owner C9)
  delete from app.scan_response_set rs where rs.scan_session_id = v_s.id;
  delete from app.scan_replace_key k where k.scan_session_id = v_s.id;
  update app.scan_session set phase = 'closed' where id = v_s.id;
  insert into app.audit_event (org_id, kind, detail) values (v_s.org_id, 'round_closed', jsonb_build_object('scan', v_s.id));
  return 'closed';
end $$;
comment on function app.close_scan(uuid) is
  'Closes a scan that is due: snapshot and reshuffle at or above k; else one extension; else no team view. Run by the scheduled job.';

-- ---------------------------------------------------------------- reading
create function app.team_view(p_scan uuid)
  returns table (theme_key text, theme_name jsonb, ordinal int, level numeric, agreement text, n int)
  language sql stable security definer set search_path = ''
as $$
  select t.key, t.name, t.ordinal, s.level, s.agreement_label, s.n
  from app.scan_session ss
  join app.scan_theme_score s on s.scan_session_id = ss.id
  join app.scan_theme t on t.id = s.theme_id
  where ss.id = p_scan and ss.phase = 'released' and s.n >= ss.k
  order by t.ordinal
$$;

create function app.get_team_view(p_scan uuid)
  returns table (theme_key text, theme_name jsonb, ordinal int, level numeric, agreement text, n int)
  language sql stable security definer set search_path = ''
as $$
  select v.* from app.scan_session ss cross join lateral app.team_view(ss.id) v
  where ss.id = p_scan and app.is_team_member(ss.team_id)
$$;

create function app.get_team_view_by_code(p_code text)
  returns table (theme_key text, theme_name jsonb, ordinal int, level numeric, agreement text, n int)
  language sql stable security definer set search_path = ''
as $$
  select v.* from app.scan_session ss cross join lateral app.team_view(ss.id) v where ss.code = p_code
$$;

-- the count and the closing date, for the link's page: never a score, never a name
create function app.get_scan_status_by_code(p_code text)
  returns table (phase text, answered int, member_count int, closes_at timestamptz)
  language sql stable security definer set search_path = ''
as $$ select ss.phase, ss.answered, ss.member_count, ss.closes_at from app.scan_session ss where ss.code = p_code $$;

create function app.get_scan_link(p_scan uuid) returns text
  language sql stable security definer set search_path = ''
as $$ select ss.code from app.scan_session ss where ss.id = p_scan and app.is_team_member(ss.team_id) $$;

grant execute on function app.submit_scan(text, jsonb, text), app.get_team_view_by_code(text), app.get_scan_status_by_code(text)
  to anon, authenticated;
grant execute on function app.get_team_view(uuid), app.get_scan_link(uuid) to authenticated;
-- the scheduled job closes scans; nobody else, and the leader cannot close early
grant execute on function app.close_scan(uuid) to service_role;
