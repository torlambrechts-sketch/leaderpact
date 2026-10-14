-- 0015_diagnostic.sql — the diagnostic round: the leader opens it, every current member is invited and
-- answers, reminders wait for those who have not, and the round closes on its date or at 100% (handoff 6.10,
-- 6.11, 7 and 8; milestone 10: "Reminders go only to people who have not answered. Close computes scores
-- once"; D-43).
--
-- 1. **The leader opens it** (`open_diagnostic`): the group's current leader alone, on the Team plan or its
--    trial and not read-only, one round answering at a time, and only with at least the organisation's
--    threshold of current members, so no count can name anyone (REUSE 4.5: no count for a group asked fewer
--    than k; owner C10). It is the published Full diagnostic, open for the `diagnostic_window_days`
--    setting. `open_round` (0007) does the rest: k frozen, every current member invited, audited.
-- 2. **Answering** stays `submit_response` (0007), now for current members only: a member removed while the
--    round is open answers no more, and stays in the denominator, which is who was invited (owner C7). The
--    questions come from `get_round_form`, in one mixed order per round, never grouped by scale (handoff
--    6.11).
-- 3. **Reminders** (`round_reminder`): one row per round and reminder day (the `reminder_days` setting, 3, 7
--    and 12, inside the window), and no person in it. Who is reminded is decided when the dispatcher claims
--    the row (`claim_reminders`): the invited people who are still members and have not answered, and nobody
--    once the round has closed or all have answered. Nothing stores who was reminded. The dispatcher that
--    sends the mail comes with the outbox (milestone 16, D-26); until then the rows wait.
-- 4. **Closing.** pg_cron hands every answering round past its date to `close_round` (0007) every five
--    minutes (`close_due_rounds`), as 0010 does for scans; the last answer still closes a round at once.
--    The result is computed once, there. At release the round records the charter version in force.
-- 5. **Reading** (`get_rounds`): for the group's current members, its rounds with phase, dates and the
--    count of answers, and whether the caller has answered; never who else has. Both new readers of
--    `participation` join the firewall's reviewed list on purpose (CLAUDE.md invariant 3).
-- 6. **Nothing is removed here.** A reminder keeps its row with a state; a round's removal takes it.

-- ---------------------------------------------------------------- the charter in force, recorded at release
alter table app.assessment_round add column charter_version_id uuid references app.charter_version (id) on delete set null;
alter table app.assessment_round add constraint assessment_round_charter_released check (charter_version_id is null or phase = 'released');
comment on column app.assessment_round.charter_version_id is
  'The charter version in force when the round was released, recorded once (handoff 8: every score stores the charter version in force).';
comment on column app.factor_score.charter_version_id is
  'Not written: the round records the charter version in force at its release (0015).';

-- set once, by the release itself; never by hand. A charter's removal (on delete set null) is allowed.
create function app.assessment_round_charter() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if new.phase = 'released' and old.phase <> 'released' then
    new.charter_version_id := (select v.id from app.charter_version v where v.team_id = new.team_id and v.status = 'in_force');
  elsif new.charter_version_id is distinct from old.charter_version_id
        and not (new.charter_version_id is null
                 and not exists (select 1 from app.charter_version v where v.id = old.charter_version_id)) then
    raise exception 'a round''s charter version is the one in force at its release' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger assessment_round_charter before update on app.assessment_round
  for each row execute function app.assessment_round_charter();

-- ---------------------------------------------------------------- the Full diagnostic in use
create function app.diagnostic_version() returns uuid
  language sql stable security definer set search_path = ''
as $$
  select v.id from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published'
  order by v.version desc limit 1
$$;
comment on function app.diagnostic_version() is 'The newest published version of the Full diagnostic. Internal.';

-- ---------------------------------------------------------------- reminders: per round and day, with no person
create table app.round_reminder (
  round_id uuid not null references app.assessment_round (id) on delete cascade,
  org_id uuid not null references app.organisation (id) on delete cascade,
  day int not null check (day between 1 and 30),
  due_at timestamptz not null,
  state text not null default 'due' check (state in ('due', 'sending', 'sent', 'skipped', 'failed')),
  -- the dispatcher's lease while it sends; a lapsed lease is claimed again
  lease_until timestamptz,
  attempts int not null default 0 check (attempts between 0 and 5),
  primary key (round_id, day),
  check ((state = 'sending') = (lease_until is not null))
);
create index round_reminder_due_idx on app.round_reminder (due_at) where state in ('due', 'sending');
comment on table app.round_reminder is
  'A round''s reminders, one per reminder day: whether and when each went, never to whom. No policy, no grant.';

create function app.round_reminder_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if (old.round_id, old.org_id, old.day) is distinct from (new.round_id, new.org_id, new.day) then
    raise exception 'a reminder''s round and day are fixed' using errcode = 'check_violation';
  end if;
  if old.state in ('sent', 'skipped', 'failed') and new.state is distinct from old.state then
    raise exception 'a reminder that went, was skipped or failed stays so' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger round_reminder_fixed before update on app.round_reminder for each row execute function app.round_reminder_fixed();

alter table app.round_reminder enable row level security;
-- no policy and no grant: the job's functions alone read and write it
revoke all on app.round_reminder from anon, authenticated, service_role;

-- ---------------------------------------------------------------- the leader opens a round
create function app.open_diagnostic(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_version uuid;
  v_members int;
  v_k int;
  v_window int := app.setting_int('diagnostic_window_days');
  v_round uuid;
  v_invited int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not (app.team_plan_writable(p_team) and app.plan_allows(p_team, 'diagnostic')) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  -- the group's row lock: two presses, or two tabs, open one round
  select t.org_id into v_org from app.team t where t.id = p_team for update;
  if exists (select 1 from app.assessment_round r where r.team_id = p_team and r.phase = 'answering') then
    return jsonb_build_object('ok', false, 'reason', 'open_round');
  end if;
  v_version := app.diagnostic_version();
  if v_version is null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  select count(*) into v_members from app.membership m
  where m.team_id = p_team and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now());
  v_k := app.k_threshold(v_org);
  if v_members < v_k then
    return jsonb_build_object('ok', false, 'reason', 'too_few', 'members', v_members, 'k', v_k);
  end if;

  insert into app.assessment_round (org_id, team_id, kind, instrument_version_id, window_days, opens_at)
  values (v_org, p_team, 'diagnostic', v_version, v_window, now())
  returning id into v_round;
  v_invited := app.open_round(v_round);
  if v_invited is null then
    raise exception 'the round could not open' using errcode = 'internal_error';
  end if;
  insert into app.round_reminder (round_id, org_id, day, due_at)
  select v_round, v_org, d.day, now() + make_interval(days => d.day)
  from (select distinct (e.value #>> '{}')::int as day
        from app.setting s cross join jsonb_array_elements(s.default_value) e
        where s.key = 'reminder_days' and jsonb_typeof(s.default_value) = 'array') d
  where d.day between 1 and v_window - 1;
  return jsonb_build_object('ok', true, 'round', v_round, 'invited', v_invited);
end $$;
comment on function app.open_diagnostic(uuid) is
  'The leader opens the Full diagnostic: every current member invited, k frozen, reminders queued per day. {ok, round} or a reason.';

-- ---------------------------------------------------------------- the one write path, for current members
create or replace function app.submit_response(p_round uuid, p_answers jsonb) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_r app.assessment_round;
  v_answered boolean;
  v_set uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_invited');
  end if;
  -- the round's lock first: a submission and the close never interleave
  select * into v_r from app.assessment_round r where r.id = p_round for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_invited');
  end if;
  select p.answered into v_answered from app.participation p
  where p.round_id = v_r.id and p.person_id = auth.uid() for update;
  -- a member removed while the round is open answers no more, and stays in the denominator (owner C7)
  if not found or not app.is_team_member(v_r.team_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_invited');
  end if;
  if v_r.phase <> 'answering' or now() >= v_r.closes_at then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if v_answered then
    return jsonb_build_object('ok', false, 'reason', 'already_answered');
  end if;
  begin
    perform 1 from app.checked_answers(p_answers, v_r.instrument_version_id);
  exception when invalid_parameter_value then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end;

  update app.participation set answered = true where round_id = v_r.id and person_id = auth.uid();
  insert into app.response_set (org_id, round_id, instrument_version_id)
  values (v_r.org_id, v_r.id, v_r.instrument_version_id)
  returning id into v_set;
  insert into app.response (response_set_id, item_id, value)
  select v_set, a.item_id, a.value from app.checked_answers(p_answers, v_r.instrument_version_id) a;

  -- everyone asked has answered: the round closes now, in this transaction
  if not exists (select 1 from app.participation p where p.round_id = v_r.id and not p.answered) then
    perform app.close_round(v_r.id);
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.submit_response(uuid, jsonb) is
  'The diagnostic''s and the pulse''s one write path, for invited current members: {ok} or {ok: false, reason}; never an id (CLAUDE.md invariant 4).';

-- ---------------------------------------------------------------- the questions, in the round's own order
create function app.get_round_form(p_round uuid) returns jsonb
  language plpgsql stable security definer set search_path = ''
as $$
declare
  v_r app.assessment_round;
  v_answered boolean;
  v_open boolean;
begin
  select * into v_r from app.assessment_round r where r.id = p_round;
  if not found or auth.uid() is null or not app.is_team_member(v_r.team_id) then
    return null;
  end if;
  select p.answered into v_answered from app.participation p where p.round_id = v_r.id and p.person_id = auth.uid();
  v_open := v_r.phase = 'answering' and now() < v_r.closes_at;
  return jsonb_build_object(
    'round', v_r.id,
    'kind', v_r.kind,
    'team', v_r.team_id,
    'group', (select t.name from app.team t where t.id = v_r.team_id),
    'k', v_r.k,
    'closes_at', v_r.closes_at,
    'state', case when v_answered is null then 'not_invited' when not v_open then 'closed'
                  when v_answered then 'answered' else 'open' end,
    'version', v_r.instrument_version_id,
    -- one mixed order per round, the same for everyone in it, never grouped by scale (handoff 6.11)
    'items', case when v_open and v_answered is false then (
      select jsonb_agg(jsonb_build_object('id', i.id, 'text', i.text ->> 'en') order by md5(v_r.id::text || i.id::text))
      from app.instrument_version_item vi join app.item i on i.id = vi.item_id
      where vi.instrument_version_id = v_r.instrument_version_id) end);
end $$;
comment on function app.get_round_form(uuid) is
  'For a current member: the round''s questions in its mixed order while the caller has yet to answer, and the caller''s own state.';

-- ---------------------------------------------------------------- the group's rounds
create function app.get_rounds(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then jsonb_build_object(
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id, 'kind', r.kind, 'number', r.number, 'phase', r.phase,
          'opens_at', r.opens_at, 'closes_at', r.closes_at, 'extended', r.extended, 'invited', r.invited, 'k', r.k,
          -- a count, never who; none for a round that asked fewer than its threshold (REUSE 4.5)
          'answered', case when r.phase <> 'scheduled' and r.invited >= r.k then
            (select count(*)::int from app.participation p where p.round_id = r.id and p.answered) end,
          -- the caller's own, while the round is open: to answer, answered, or not asked
          'me', case when r.phase = 'answering' then
            (select case when p.answered then 'answered' else 'to_answer' end
             from app.participation p where p.round_id = r.id and p.person_id = auth.uid()) end)
        order by r.opens_at desc, r.id)
      from (select x.*, row_number() over (partition by x.kind order by x.opens_at, x.id)::int as number
            from app.assessment_round x where x.team_id = p_team) r), '[]'::jsonb),
    'members', (select count(*)::int from app.membership m
                where m.team_id = p_team and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())),
    'k', app.k_threshold((select t.org_id from app.team t where t.id = p_team)),
    'window_days', app.setting_int('diagnostic_window_days'),
    'questions', (select count(*)::int from app.instrument_version_item vi where vi.instrument_version_id = app.diagnostic_version()),
    'leader', app.is_team_leader(p_team),
    'can_open', app.is_team_leader(p_team) and app.team_plan_writable(p_team) and app.plan_allows(p_team, 'diagnostic')
                and not exists (select 1 from app.assessment_round r where r.team_id = p_team and r.phase = 'answering')) end
$$;
comment on function app.get_rounds(uuid) is
  'For the group''s current members: its rounds with phase, dates and the count of answers, and the caller''s own state; never who.';

-- ---------------------------------------------------------------- closing on the date (the scheduled job)
create function app.close_due_rounds() returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_n int := 0;
begin
  for v_id in
    select r.id from app.assessment_round r
    where r.phase = 'answering' and r.closes_at <= now()
    order by r.closes_at
    for update skip locked
  loop
    perform app.close_round(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
comment on function app.close_due_rounds() is
  'The scheduled job: every answering round past its closing date goes to close_round. Returns how many. No client may run it.';

-- ---------------------------------------------------------------- reminders, for the dispatcher alone
-- Claims the reminders that are due, each with whom it goes to, decided now: the invited people who are
-- still members and have not answered. A round that has closed, or that everyone has answered, is skipped.
-- The claim holds a 10-minute lease; after five tries a reminder is given up.
create function app.claim_reminders(p_limit int default 20) returns jsonb
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
    where p.round_id = v_r.id and not p.answered and u.email is not null;

    if v_r.phase <> 'answering' or now() >= v_r.closes_at or v_to is null then
      update app.round_reminder rr set state = 'skipped', lease_until = null where rr.round_id = v_rr.round_id and rr.day = v_rr.day;
    elsif v_rr.attempts >= 5 then
      update app.round_reminder rr set state = 'failed', lease_until = null where rr.round_id = v_rr.round_id and rr.day = v_rr.day;
    else
      update app.round_reminder rr set state = 'sending', lease_until = now() + interval '10 minutes', attempts = rr.attempts + 1
      where rr.round_id = v_rr.round_id and rr.day = v_rr.day;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'round', v_r.id, 'day', v_rr.day, 'group', (select t.name from app.team t where t.id = v_r.team_id),
        'closes_at', v_r.closes_at, 'recipients', v_to));
    end if;
  end loop;
  return v_out;
end $$;
comment on function app.claim_reminders(int) is
  'The dispatcher''s claim: due reminders, each to the invited members who have not answered, decided now. Granted to service_role alone.';

create function app.finish_reminder(p_round uuid, p_day int, p_sent boolean) returns text
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_rr app.round_reminder;
begin
  select * into v_rr from app.round_reminder rr where rr.round_id = p_round and rr.day = p_day for update;
  if not found then
    return 'none';
  end if;
  if v_rr.state <> 'sending' then
    return v_rr.state;
  end if;
  if p_sent then
    update app.round_reminder rr set state = 'sent', lease_until = null where rr.round_id = p_round and rr.day = p_day;
    insert into app.audit_event (org_id, kind, detail)
    values (v_rr.org_id, 'reminder_sent', jsonb_build_object('round', p_round, 'day', p_day));
    return 'sent';
  end if;
  update app.round_reminder rr set state = case when rr.attempts >= 5 then 'failed' else 'due' end, lease_until = null
  where rr.round_id = p_round and rr.day = p_day;
  return case when v_rr.attempts >= 5 then 'failed' else 'due' end;
end $$;
comment on function app.finish_reminder(uuid, int, boolean) is
  'The dispatcher reports a claimed reminder sent (audited with ids) or not (claimed again later). Granted to service_role alone.';

-- ---------------------------------------------------------------- the firewall's reviewed readers, two more
create or replace function app.anonymity_firewall() returns table (seq int, rule text, pass boolean, evidence jsonb)
  language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_answer constant text[] := array['response_set', 'response', 'participation', 'factor_score', 'item_score',
                                    'scan_response_set', 'scan_response', 'scan_replace_key', 'scan_theme_score'];
  v_sets constant text[] := array['response_set', 'scan_response_set'];
  v_guards constant text[] := array['forbid_answer_change'];
  -- the platform's own roles, which hold every table by design: no client, key or product path reaches them
  v_platform constant text[] := array['pg_read_all_data', 'pg_write_all_data', 'supabase_read_only_user', 'supabase_etl_admin'];
  -- reviewed: the write paths and the readers that return counts, labels and levels only; get_rounds and
  -- get_round_form (0015) read participation for a count and the caller's own state
  v_reviewed constant text[] := array['submit_scan', 'submit_response', 'get_team_view', 'get_team_view_by_code',
                                      'get_results', 'get_item_results', 'get_participation_count',
                                      'get_rounds', 'get_round_form'];
  v_names jsonb;
  v_n bigint;
begin
  -- 1
  select coalesce(jsonb_agg(r.rolname || ' on ' || t.relname order by r.rolname, t.relname), '[]') into v_names
  from pg_roles r cross join pg_class t
  where t.relnamespace = 'app'::regnamespace and t.relname = any (v_answer)
    and not r.rolsuper and r.oid <> t.relowner and not (r.rolname = any (v_platform))
    and (has_table_privilege(r.oid, t.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
         or has_any_column_privilege(r.oid, t.oid, 'SELECT,INSERT,UPDATE,REFERENCES'));
  select count(*) into v_n from pg_class t where t.relnamespace = 'app'::regnamespace and t.relname = any (v_answer);
  seq := 1; rule := 'no_role_reads_answers';
  pass := jsonb_array_length(v_names) = 0 and v_n = cardinality(v_answer);
  evidence := jsonb_build_object('tables', v_n, 'held', v_names);
  return next;

  -- 2
  with t as (select c.oid, c.relname from pg_class c where c.relnamespace = 'app'::regnamespace and c.relname = any (v_answer))
  select coalesce(jsonb_agg(x.name order by x.name), '[]') into v_names from (
    select t.relname || ' trigger ' || tg.tgname as name
    from t join pg_trigger tg on tg.tgrelid = t.oid and not tg.tgisinternal
    join pg_proc p on p.oid = tg.tgfoid
    where not (p.proname = any (v_guards) and p.pronamespace = 'app'::regnamespace)
    union all
    select t.relname || ' policy ' || po.polname from t join pg_policy po on po.polrelid = t.oid
    union all
    select t.relname || ' rule ' || r.rulename from t join pg_rewrite r on r.ev_class = t.oid) x;
  seq := 2; rule := 'nothing_attached_to_answers'; pass := jsonb_array_length(v_names) = 0;
  evidence := jsonb_build_object('attached', v_names);
  return next;

  -- 3
  with client_rel as (
    select c.oid, n.nspname || '.' || c.relname as name, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname not in ('pg_catalog', 'information_schema') and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'SELECT')
           or has_any_column_privilege('anon', c.oid, 'SELECT') or has_any_column_privilege('authenticated', c.oid, 'SELECT'))),
  answer as (select c.oid from pg_class c where c.relnamespace = 'app'::regnamespace and c.relname = any (v_answer))
  select coalesce(jsonb_agg(x.name order by x.name), '[]') into v_names from (
    select cr.name || ' references ' || con.confrelid::regclass::text as name
    from client_rel cr join pg_constraint con on con.conrelid = cr.oid and con.contype = 'f'
    where con.confrelid in (select oid from answer)
    union all
    select distinct cr.name || ' reads ' || d.refobjid::regclass::text
    from client_rel cr
    join pg_rewrite rw on rw.ev_class = cr.oid
    join pg_depend d on d.classid = 'pg_rewrite'::regclass and d.objid = rw.oid and d.refclassid = 'pg_class'::regclass
    where cr.relkind in ('v', 'm') and d.refobjid in (select oid from answer)) x;
  seq := 3; rule := 'no_client_path_to_answers'; pass := jsonb_array_length(v_names) = 0;
  evidence := jsonb_build_object('paths', v_names);
  return next;

  -- 4
  select coalesce(jsonb_agg(a.attrelid::regclass::text || '.' || a.attname order by 1), '[]') into v_names
  from pg_attribute a join pg_class c on c.oid = a.attrelid
  where c.relnamespace = 'app'::regnamespace and c.relname = any (v_sets) and a.attnum > 0 and not a.attisdropped
    and a.attname not in ('id', 'org_id', 'instrument_version_id',
                          case c.relname when 'response_set' then 'round_id' else 'scan_session_id' end);
  seq := 4; rule := 'response_set_columns'; pass := jsonb_array_length(v_names) = 0;
  evidence := jsonb_build_object('extra', v_names);
  return next;

  -- 5
  select coalesce(jsonb_agg(a.attname order by a.attnum), '[]') into v_names
  from pg_attribute a
  where a.attrelid = 'app.participation'::regclass and a.attnum > 0 and not a.attisdropped;
  seq := 5; rule := 'participation_columns';
  pass := v_names = '["round_id", "person_id", "org_id", "answered"]'::jsonb;
  evidence := jsonb_build_object('columns', v_names);
  return next;

  -- 6
  select coalesce(jsonb_agg(distinct n.nspname || '.' || p.proname), '[]') into v_names
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('app', 'public') and p.prokind = 'f'
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    and not (p.proname = any (v_reviewed))
    and exists (select 1 from unnest(v_answer) t where p.prosrc ~* ('app\.' || t || '\M'));
  seq := 6; rule := 'client_functions_reviewed'; pass := jsonb_array_length(v_names) = 0;
  evidence := jsonb_build_object('unreviewed', v_names);
  return next;
end $fn$;
comment on function app.anonymity_firewall() is
  'The catalogue''s proof of anonymity (handoff 13). Every row must pass; supabase/tests/anonymity_invariants.sql fails otherwise.';

-- ---------------------------------------------------------------- grants
grant execute on function app.open_diagnostic(uuid), app.get_round_form(uuid), app.get_rounds(uuid) to authenticated;
-- the scheduled job and the dispatcher; nobody else
grant execute on function app.close_due_rounds(), app.claim_reminders(int), app.finish_reminder(uuid, int, boolean) to service_role;

-- ---------------------------------------------------------------- the schedule
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- by name, so applying this again replaces the job rather than adding a second
    perform cron.schedule('leaderpact-close-due-rounds', '*/5 * * * *', 'select app.close_due_rounds()');
  end if;
end $$;
