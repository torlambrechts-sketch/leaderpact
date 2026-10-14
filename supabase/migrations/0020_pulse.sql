-- 0020_pulse.sql — pulses: a short check on the focus areas and working agreements between diagnostics (handoff
-- 6.16, 7 and 8; milestone 15: "A pulse assembles in the right order, closes after 7 days and shows change only
-- from 0.6"; D-52).
--
-- 1. **The leader starts the rhythm** (`start_pulses`): every 4 weeks unless set from 2 to 8, open for 7 days
--    unless set from 3 to 14 (the `pulse_rhythm_weeks` and `pulse_window_days` settings), and a pulse closes
--    before the next one is due. The first opens at once; then the scheduled job (`open_due_pulses`) opens each
--    one on its date. A due pulse is skipped, never queued, while another round is answering, while the group is
--    off the Team plan or read-only, or while it has fewer members than its threshold. The leader changes the
--    rhythm or stops it; a pulse that is open runs to its close.
-- 2. **Built in the handoff's order, at most 10 questions** (`pulse_template`, versioned): the core items of
--    each active focus area's scale, in the order the focus areas were chosen; then one question per working
--    agreement of the charter in force; then up to 2 rotating items, each from another scale. Agreements that do
--    not fit rotate: those asked longest ago, or never, come first. Rotating items go to the scales asked longest
--    ago. The questions are written when the pulse opens and never change (`pulse_question`), so a pulse always
--    says what it asked.
-- 3. **The agreement question's wording is a row**, the handoff's proposal and not yet confirmed: "In the last
--    {weeks} weeks we kept this agreement: «text»". Each pulse keeps it with its agreement's text filled in.
-- 4. **Answering stays `submit_response`**, the one write path. A pulse's answers are checked against its own
--    questions; an item's answer goes to `response` and an agreement's to `agreement_response`, under the one
--    random set id. Neither holds a person or a time. `agreement_response` and its snapshot `agreement_score`
--    join the answer tables: row-level security on, no policy and no grant to any role, and the firewall lists
--    them (CLAUDE.md invariant 3).
-- 5. **Closing stays `close_round`** (0007): after the window, or at 100%. At or above the round's threshold the
--    snapshot is written once: each focus scale's level, agreement label and standing, each item's level and
--    each agreement's level. The sets are then reshuffled with their agreement answers. Below it the pulse is
--    missed: no result, the answers deleted, audited as closed without a result (handoff 7).
-- 6. **Change shows only from 0.6** (handoff 7). `get_pulse_result` returns, beside each focus scale and each
--    agreement, its level in the latest earlier released pulse that asked the same thing: the same core items,
--    or the same agreement in the same words. The page shows it only at the margin of the cut-offs the pulse
--    closed with; a first pulse shows none. Items show their mean only. The reader joins the firewall's
--    reviewed list on purpose.

-- ---------------------------------------------------------------- how a pulse is built, versioned
create table app.pulse_template (
  version int primary key check (version > 0),
  -- handoff 6.16: at most 10 questions, up to 2 of them rotating
  max_questions int not null check (max_questions between 1 and 30),
  max_rotating int not null check (max_rotating between 0 and 10),
  -- the question asked per working agreement; {weeks} and {agreement} are filled in when a pulse opens
  agreement_wording jsonb not null check (jsonb_typeof(agreement_wording) = 'object' and agreement_wording ->> 'en' like '%{agreement}%'),
  -- handoff 6.16: "The wording of the working-agreement item is not set ... Confirm before launch."
  wording_confirmed boolean not null default false,
  valid_from timestamptz not null,
  check (max_rotating <= max_questions)
);
comment on table app.pulse_template is
  'How a pulse is built (handoff 6.16): its most questions, its rotating items and the agreement question''s wording. A row never changes.';

create function app.pulse_template_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  raise exception 'a pulse template version never changes: add a version instead' using errcode = 'check_violation';
end $$;
create trigger pulse_template_fixed before update on app.pulse_template for each row execute function app.pulse_template_fixed();

-- TODO(owner): the agreement question is the handoff's proposed wording, to confirm before launch (handoff 6.16, 14)
insert into app.pulse_template (version, max_questions, max_rotating, agreement_wording, wording_confirmed, valid_from) values
  (1, 10, 2, '{"en": "In the last {weeks} weeks we kept this agreement: «{agreement}»"}', false, '2026-01-01T00:00:00Z');

-- the version in force: the newest that has started
create function app.pulse_template_version() returns int
  language sql stable security definer set search_path = ''
as $$ select max(t.version) from app.pulse_template t where t.valid_from <= now() $$;
comment on function app.pulse_template_version() is 'The pulse template in force. Internal.';

-- ---------------------------------------------------------------- the group's rhythm
create table app.pulse_schedule (
  team_id uuid primary key,
  org_id uuid not null,
  weeks int not null check (weeks between 1 and 52),
  window_days int not null check (window_days between 1 and 30),
  -- when the next pulse is due; null while pulses are stopped
  next_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade,
  -- a pulse closes before the next one is due
  check (window_days < weeks * 7)
);
comment on table app.pulse_schedule is
  'A group''s pulse rhythm (handoff 6.16 and 8): every so many weeks, open for so many days, and when the next is due. No client reads it.';

-- whether a value lies in a setting's range (handoff 8, Configuration)
create function app.setting_allows(p_key text, p_value int) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_value is not null and exists (
    select 1 from app.setting s
    where s.key = p_key and (s.min_value is null or p_value >= s.min_value) and (s.max_value is null or p_value <= s.max_value))
$$;
comment on function app.setting_allows(text, int) is 'Whether a value lies within a setting''s range. Internal.';

-- ---------------------------------------------------------------- what a pulse asked, written when it opens
create table app.pulse_question (
  round_id uuid not null references app.assessment_round (id) on delete cascade,
  org_id uuid not null references app.organisation (id) on delete cascade,
  ordinal int not null check (ordinal between 1 and 30),
  source text not null check (source in ('focus', 'agreement', 'rotating')),
  item_id uuid references app.item (id),
  agreement_id uuid references app.working_agreement (id) on delete cascade,
  -- the scale a focus or rotating item belongs to
  factor_id uuid references app.factor (id),
  -- an agreement question's words, as asked
  text jsonb check (text is null or (jsonb_typeof(text) = 'object' and text ? 'en')),
  primary key (round_id, ordinal),
  unique (round_id, item_id),
  unique (round_id, agreement_id),
  check ((source = 'agreement') = (agreement_id is not null)),
  check ((agreement_id is null) = (item_id is not null)),
  check ((agreement_id is null) = (factor_id is not null)),
  check ((agreement_id is null) = (text is null))
);
create index pulse_question_agreement_idx on app.pulse_question (agreement_id) where agreement_id is not null;
comment on table app.pulse_question is
  'A pulse''s questions in the order they were built (handoff 6.16), written before it opens. No answer and no person. No client reads it.';

-- written once, before the pulse opens; nobody changes it. Deletes come only from its round's or its agreement's removal.
create function app.pulse_question_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from app.assessment_round r where r.id = new.round_id and r.kind = 'pulse' and r.phase = 'scheduled') then
      raise exception 'a pulse''s questions are written before it opens' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  raise exception 'a pulse''s questions never change' using errcode = 'check_violation';
end $$;
create trigger pulse_question_fixed before insert or update on app.pulse_question for each row execute function app.pulse_question_fixed();

-- ---------------------------------------------------------------- agreement answers: unreadable by every role
create table app.agreement_response (
  response_set_id uuid not null references app.response_set (id) on delete cascade,
  agreement_id uuid not null references app.working_agreement (id) on delete cascade,
  value smallint not null check (value between 1 and 5),
  primary key (response_set_id, agreement_id)
);
comment on table app.agreement_response is
  'An answer to a pulse''s agreement question, under its set''s random id. No person and no time. No policy, no grant.';

create table app.agreement_score (
  round_id uuid not null references app.assessment_round (id) on delete cascade,
  agreement_id uuid not null references app.working_agreement (id) on delete cascade,
  org_id uuid not null references app.organisation (id) on delete cascade,
  n int not null check (n >= app.k_floor()),
  level numeric(2, 1) not null check (level between 1 and 5),
  primary key (round_id, agreement_id)
);
comment on table app.agreement_score is
  'A released pulse''s level per agreement, written once at close. No policy, no grant.';

create trigger agreement_response_fixed before update on app.agreement_response for each row execute function app.forbid_answer_change();
create trigger agreement_score_fixed before update on app.agreement_score for each row execute function app.forbid_answer_change();

alter table app.pulse_template enable row level security;
alter table app.pulse_schedule enable row level security;
alter table app.pulse_question enable row level security;
alter table app.agreement_response enable row level security;
alter table app.agreement_score enable row level security;
-- no policy and no grant: the functions below alone read and write them
revoke all on app.pulse_template, app.pulse_schedule, app.pulse_question, app.agreement_response, app.agreement_score
  from anon, authenticated, service_role;

-- ---------------------------------------------------------------- building a pulse
-- The questions the group's next pulse asks, if it opened now, in the handoff's order. The seed that breaks
-- ties is the group and the number of pulses it has opened, so what the page previews is what opens.
create function app.pulse_questions(p_team uuid)
  returns table (ordinal int, source text, item_id uuid, agreement_id uuid, factor_id uuid, text jsonb)
  language sql stable security definer set search_path = ''
as $$
  with t as (
    select x.max_questions, x.max_rotating, x.agreement_wording ->> 'en' as wording
    from app.pulse_template x where x.version = app.pulse_template_version()),
  ver as (select app.diagnostic_version() as id),
  rhythm as (
    select coalesce((select s.weeks from app.pulse_schedule s where s.team_id = p_team), app.setting_int('pulse_rhythm_weeks')) as weeks),
  seed as (
    select p_team::text || ':' || (select count(*) from app.assessment_round r
                                   where r.team_id = p_team and r.kind = 'pulse' and r.phase <> 'scheduled') as val),
  -- what the group's pulses asked before, and when
  asked as (
    select q.source, q.item_id, q.agreement_id, q.factor_id, r.opens_at
    from app.pulse_question q join app.assessment_round r on r.id = q.round_id
    where r.team_id = p_team and r.phase <> 'scheduled'),
  -- 1. the core items of each active focus area's scale, in the order the focus areas were chosen
  focus as (
    select fa.factor_id, row_number() over (order by fa.created_at, fa.id) as rank
    from app.focus_area fa where fa.team_id = p_team and fa.status = 'active'),
  focus_items as (
    select 1 as part, row_number() over (order by f.rank, vi.ordinal) as n, 'focus'::text as source,
           i.id as item_id, null::uuid as agreement_id, i.factor_id, null::jsonb as text
    from focus f
    join app.item i on i.factor_id = f.factor_id and i.use = 'core'
    join app.instrument_version_item vi on vi.item_id = i.id and vi.instrument_version_id = (select ver.id from ver)),
  -- 2. one question per working agreement in force: those asked longest ago, or never, first
  agreement_items as (
    select 2 as part,
           row_number() over (order by (select max(a2.opens_at) from asked a2 where a2.agreement_id = a.id) nulls first, a.ordinal) as n,
           'agreement'::text as source, null::uuid as item_id, a.id as agreement_id, null::uuid as factor_id,
           jsonb_build_object('en', replace(replace((select t.wording from t), '{weeks}', (select rhythm.weeks::text from rhythm)),
                                            '{agreement}', a.text)) as text
    from app.working_agreement a join app.charter_version cv on cv.id = a.version_id
    where cv.team_id = p_team and cv.status = 'in_force'),
  -- 3. rotating items: one item from each of the other scales asked longest ago, or never
  scales as (
    select f.id,
           row_number() over (order by (select max(a2.opens_at) from asked a2 where a2.source = 'rotating' and a2.factor_id = f.id) nulls first,
                                       md5((select seed.val from seed) || f.id::text)) as n
    from app.factor f
    where f.layer <> 'outcomes' and f.id not in (select focus.factor_id from focus)
      and exists (select 1 from app.item i join app.instrument_version_item vi on vi.item_id = i.id
                  where i.factor_id = f.id and i.use = 'core' and vi.instrument_version_id = (select ver.id from ver))),
  rotating_items as (
    select 3 as part, sc.n, 'rotating'::text as source, pick.item_id, null::uuid as agreement_id, sc.id as factor_id, null::jsonb as text
    from scales sc
    cross join lateral (
      select i.id as item_id from app.item i
      join app.instrument_version_item vi on vi.item_id = i.id and vi.instrument_version_id = (select ver.id from ver)
      where i.factor_id = sc.id and i.use = 'core'
      order by (select max(a2.opens_at) from asked a2 where a2.item_id = i.id) nulls first, md5((select seed.val from seed) || i.id::text)
      limit 1) pick),
  room as (
    select t.max_questions as total, t.max_rotating as rotating,
           least((select count(*) from focus_items), t.max_questions) as focus,
           (select count(*) from agreement_items) as agreements
    from t),
  kept as (
    select * from focus_items where n <= (select room.total from room)
    union all
    select * from agreement_items where n <= (select greatest(0, room.total - room.focus) from room)
    union all
    select * from rotating_items
    where n <= (select least(room.rotating, greatest(0, room.total - room.focus - least(room.agreements, greatest(0, room.total - room.focus)))) from room))
  select (row_number() over (order by k.part, k.n))::int, k.source, k.item_id, k.agreement_id, k.factor_id, k.text
  from kept k
  order by k.part, k.n
$$;
comment on function app.pulse_questions(uuid) is
  'The next pulse''s questions in the handoff''s order: focus items, one per agreement (rotating when they do not fit), up to 2 rotating items; at most 10. Internal.';

-- Opens the group's pulse now, when it may: the Team plan, writable, at least the threshold of current members,
-- no round answering. Writes its questions, then opens it through open_round (0007) and queues its reminders.
-- Returns the round, or null when it may not open.
create function app.open_pulse(p_team uuid) returns uuid
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_days int;
  v_version uuid := app.diagnostic_version();
  v_members int;
  v_round uuid;
  v_n int;
begin
  -- the group's row lock: the job, the leader and a diagnostic opening never open two rounds at once
  select t.org_id into v_org from app.team t where t.id = p_team for update;
  if not found or v_version is null
     or not (app.team_plan_writable(p_team) and app.plan_allows(p_team, 'pulse'))
     or exists (select 1 from app.assessment_round r where r.team_id = p_team and r.phase = 'answering') then
    return null;
  end if;
  select s.window_days into v_days from app.pulse_schedule s where s.team_id = p_team;
  select count(*) into v_members from app.membership m
  where m.team_id = p_team and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now());
  if v_days is null or v_members < app.k_threshold(v_org) then
    return null;
  end if;

  insert into app.assessment_round (org_id, team_id, kind, instrument_version_id, window_days, opens_at)
  values (v_org, p_team, 'pulse', v_version, v_days, now())
  returning id into v_round;
  insert into app.pulse_question (round_id, org_id, ordinal, source, item_id, agreement_id, factor_id, text)
  select v_round, v_org, q.ordinal, q.source, q.item_id, q.agreement_id, q.factor_id, q.text from app.pulse_questions(p_team) q;
  get diagnostics v_n = row_count;
  if v_n = 0 or app.open_round(v_round) is null then
    raise exception 'the pulse could not open' using errcode = 'internal_error';
  end if;
  insert into app.round_reminder (round_id, org_id, day, due_at)
  select v_round, v_org, d.day, now() + make_interval(days => d.day)
  from (select distinct (e.value #>> '{}')::int as day
        from app.setting s cross join jsonb_array_elements(s.default_value) e
        where s.key = 'reminder_days' and jsonb_typeof(s.default_value) = 'array') d
  where d.day between 1 and v_days - 1;
  return v_round;
end $$;
comment on function app.open_pulse(uuid) is
  'Opens the group''s pulse now when it may: its questions written, every current member invited, k frozen, reminders queued. Internal.';

-- ---------------------------------------------------------------- the leader's rhythm
create function app.start_pulses(p_team uuid, p_weeks int, p_days int) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_members int;
  v_k int;
  v_round uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not (app.team_plan_writable(p_team) and app.plan_allows(p_team, 'pulse')) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if not (app.setting_allows('pulse_rhythm_weeks', p_weeks) and app.setting_allows('pulse_window_days', p_days)) or p_days >= p_weeks * 7 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select t.org_id into v_org from app.team t where t.id = p_team for update;
  if exists (select 1 from app.pulse_schedule s where s.team_id = p_team and s.next_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;
  if exists (select 1 from app.assessment_round r where r.team_id = p_team and r.phase = 'answering') then
    return jsonb_build_object('ok', false, 'reason', 'open_round');
  end if;
  select count(*) into v_members from app.membership m
  where m.team_id = p_team and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now());
  v_k := app.k_threshold(v_org);
  if v_members < v_k then
    return jsonb_build_object('ok', false, 'reason', 'too_few', 'members', v_members, 'k', v_k);
  end if;

  insert into app.pulse_schedule (team_id, org_id, weeks, window_days, next_at)
  values (p_team, v_org, p_weeks, p_days, now() + make_interval(weeks => p_weeks))
  on conflict (team_id) do update
    set weeks = excluded.weeks, window_days = excluded.window_days, next_at = excluded.next_at, updated_at = now();
  v_round := app.open_pulse(p_team);
  if v_round is null then
    raise exception 'the pulse could not open' using errcode = 'internal_error';
  end if;
  return jsonb_build_object('ok', true, 'round', v_round);
end $$;
comment on function app.start_pulses(uuid, int, int) is
  'The leader starts the pulse rhythm: the first pulse opens now, the next on the rhythm. {ok, round} or a reason.';

create function app.set_pulse_rhythm(p_team uuid, p_weeks int, p_days int) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_last timestamptz;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not (app.team_plan_writable(p_team) and app.plan_allows(p_team, 'pulse')) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  if not (app.setting_allows('pulse_rhythm_weeks', p_weeks) and app.setting_allows('pulse_window_days', p_days)) or p_days >= p_weeks * 7 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select t.org_id into v_org from app.team t where t.id = p_team for update;
  select max(r.opens_at) into v_last from app.assessment_round r where r.team_id = p_team and r.kind = 'pulse';
  insert into app.pulse_schedule as s (team_id, org_id, weeks, window_days, next_at)
  values (p_team, v_org, p_weeks, p_days, null)
  on conflict (team_id) do update
    set weeks = excluded.weeks, window_days = excluded.window_days, updated_at = now(),
        -- a running rhythm counts from the last pulse; it never falls due in the past
        next_at = case when s.next_at is null then null
                       else greatest(now(), coalesce(v_last, now()) + make_interval(weeks => excluded.weeks)) end;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.set_pulse_rhythm(uuid, int, int) is
  'The leader changes the rhythm and the window for the pulses to come; an open pulse keeps its own. {ok} or a reason.';

create function app.stop_pulses(p_team uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_team is null or not app.is_team_leader(p_team) then
    return jsonb_build_object('ok', false, 'reason', 'not_leader');
  end if;
  if not (app.team_plan_writable(p_team) and app.plan_allows(p_team, 'pulse')) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  perform 1 from app.team t where t.id = p_team for update;
  if not exists (select 1 from app.pulse_schedule s where s.team_id = p_team and s.next_at is not null) then
    return jsonb_build_object('ok', false, 'reason', 'not_running');
  end if;
  update app.pulse_schedule set next_at = null, updated_at = now() where team_id = p_team;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.stop_pulses(uuid) is
  'The leader stops the pulse rhythm; a pulse that is open runs to its close. {ok} or a reason.';

-- ---------------------------------------------------------------- the scheduled job
create function app.open_due_pulses() returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_s app.pulse_schedule;
  v_n int := 0;
begin
  for v_s in
    select s.* from app.pulse_schedule s where s.next_at <= now() order by s.next_at for update skip locked
  loop
    -- the next date first: a pulse that cannot open now is skipped, not queued
    update app.pulse_schedule s
    set next_at = case when v_s.next_at + make_interval(weeks => v_s.weeks) > now() then v_s.next_at + make_interval(weeks => v_s.weeks)
                       else now() + make_interval(weeks => v_s.weeks) end
    where s.team_id = v_s.team_id;
    if app.open_pulse(v_s.team_id) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
comment on function app.open_due_pulses() is
  'The scheduled job: opens each group''s pulse that is due, or skips it; sets the next date. Returns how many opened. No client may run it.';

-- ---------------------------------------------------------------- the one write path, for both kinds
-- A pulse's answers, checked against its own questions: a JSON array of {"item": <uuid>, "value": 1..5}, every
-- question exactly once, where the id is the question's item or agreement. Raises with a fixed message that
-- names no value (CLAUDE.md invariant 10).
create function app.checked_pulse_answers(p_answers jsonb, p_round uuid)
  returns table (question uuid, agreement boolean, value smallint)
  language plpgsql stable security definer set search_path = ''
as $$
declare
  v_e jsonb;
  v_ids uuid[] := '{}';
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
      v_ids := v_ids || (v_e ->> 'item')::uuid;
    exception when invalid_text_representation then
      raise exception 'answers: an item is malformed' using errcode = 'invalid_parameter_value';
    end;
    v_values := v_values || v_value::smallint;
  end loop;
  select count(*) into v_expected from app.pulse_question q where q.round_id = p_round;
  if v_expected = 0
     or cardinality(v_ids) <> v_expected
     or (select count(distinct x) from unnest(v_ids) x) <> v_expected
     or exists (select 1 from unnest(v_ids) x
                where not exists (select 1 from app.pulse_question q
                                  where q.round_id = p_round and (q.item_id = x or q.agreement_id = x))) then
    raise exception 'answers: not every question of the pulse exactly once' using errcode = 'invalid_parameter_value';
  end if;
  return query
    select x.id, exists (select 1 from app.pulse_question q where q.round_id = p_round and q.agreement_id = x.id), x.v
    from unnest(v_ids, v_values) as x (id, v);
end $$;
comment on function app.checked_pulse_answers(jsonb, uuid) is
  'A pulse''s answers checked against its questions, each marked item or agreement. Internal.';

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
    if v_r.kind = 'pulse' then
      perform 1 from app.checked_pulse_answers(p_answers, v_r.id);
    else
      perform 1 from app.checked_answers(p_answers, v_r.instrument_version_id);
    end if;
  exception when invalid_parameter_value then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end;

  update app.participation set answered = true where round_id = v_r.id and person_id = auth.uid();
  insert into app.response_set (org_id, round_id, instrument_version_id)
  values (v_r.org_id, v_r.id, v_r.instrument_version_id)
  returning id into v_set;
  if v_r.kind = 'pulse' then
    insert into app.response (response_set_id, item_id, value)
    select v_set, a.question, a.value from app.checked_pulse_answers(p_answers, v_r.id) a where not a.agreement;
    insert into app.agreement_response (response_set_id, agreement_id, value)
    select v_set, a.question, a.value from app.checked_pulse_answers(p_answers, v_r.id) a where a.agreement;
  else
    insert into app.response (response_set_id, item_id, value)
    select v_set, a.item_id, a.value from app.checked_answers(p_answers, v_r.instrument_version_id) a;
  end if;

  -- everyone asked has answered: the round closes now, in this transaction
  if not exists (select 1 from app.participation p where p.round_id = v_r.id and not p.answered) then
    perform app.close_round(v_r.id);
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.submit_response(uuid, jsonb) is
  'The diagnostic''s and the pulse''s one write path, for invited current members: {ok} or {ok: false, reason}; never an id (CLAUDE.md invariant 4).';

-- ---------------------------------------------------------------- closing, with the pulse's own snapshot
create or replace function app.close_round(p_round uuid) returns text
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_r app.assessment_round;
  v_cut int := app.cutoff_version();
  v_n int;
  v_old uuid;
  v_new uuid;
begin
  select * into v_r from app.assessment_round r where r.id = p_round for update;
  if not found or v_r.phase <> 'answering' then
    return v_r.phase;
  end if;
  if now() < v_r.closes_at and exists (select 1 from app.participation p where p.round_id = v_r.id and not p.answered) then
    return 'answering';
  end if;
  select count(*) into v_n from app.response_set rs where rs.round_id = v_r.id;

  if v_n >= v_r.k then
    -- the snapshot, once: per scale, each set's sum over the scale's items in this version; a pulse's scales are
    -- its focus scales alone, whose core items it asks in full (a rotating item is one item, never a scale)
    insert into app.factor_score
      (round_id, factor_id, org_id, n, level, agreement, agreement_label, standing, cutoff_version, instrument_version_id)
    select v_r.id, f.id, v_r.org_id, t.n, t.level,
           app.agreement_value(t.sums, t.items), t.label,
           app.standing(f.reading_type, t.level, t.label, v_cut), v_cut, v_r.instrument_version_id
    from (
      select x.factor_id, count(*)::int as n, max(x.items) as items, array_agg(x.s) as sums,
             app.level(sum(x.s), count(*) * max(x.items)) as level,
             app.agreement_label(array_agg(x.s), max(x.items), v_cut) as label
      from (
        select i.factor_id, r.response_set_id, sum(r.value)::int as s, count(*)::int as items
        from app.response r
        join app.response_set rs on rs.id = r.response_set_id
        join app.item i on i.id = r.item_id
        where rs.round_id = v_r.id
          and (v_r.kind <> 'pulse'
               or exists (select 1 from app.pulse_question q where q.round_id = v_r.id and q.item_id = r.item_id and q.source = 'focus'))
        group by i.factor_id, r.response_set_id) x
      group by x.factor_id) t
    join app.factor f on f.id = t.factor_id;

    insert into app.item_score (round_id, item_id, org_id, n, level)
    select v_r.id, r.item_id, v_r.org_id, count(*)::int, app.level(sum(r.value), count(*))
    from app.response r join app.response_set rs on rs.id = r.response_set_id
    where rs.round_id = v_r.id
    group by r.item_id;

    -- a pulse's agreements, as items are
    insert into app.agreement_score (round_id, agreement_id, org_id, n, level)
    select v_r.id, a.agreement_id, v_r.org_id, count(*)::int, app.level(sum(a.value), count(*))
    from app.agreement_response a join app.response_set rs on rs.id = a.response_set_id
    where rs.round_id = v_r.id
    group by a.agreement_id;

    -- the reshuffle (owner C3), the agreement answers with their sets
    for v_old in select rs.id from app.response_set rs where rs.round_id = v_r.id order by random() loop
      v_new := gen_random_uuid();
      insert into app.response_set (id, org_id, round_id, instrument_version_id)
      select v_new, rs.org_id, rs.round_id, rs.instrument_version_id from app.response_set rs where rs.id = v_old;
      insert into app.response (response_set_id, item_id, value)
      select v_new, r.item_id, r.value from app.response r where r.response_set_id = v_old order by random();
      insert into app.agreement_response (response_set_id, agreement_id, value)
      select v_new, a.agreement_id, a.value from app.agreement_response a where a.response_set_id = v_old order by random();
      delete from app.response_set rs where rs.id = v_old;
    end loop;
    perform app.rewrite_participation(v_r.id);

    update app.assessment_round set phase = 'released' where id = v_r.id;
    insert into app.audit_event (org_id, kind, detail) values
      (v_r.org_id, 'round_closed', jsonb_build_object('round', v_r.id, 'kind', v_r.kind)),
      (v_r.org_id, 'results_released', jsonb_build_object('round', v_r.id, 'kind', v_r.kind));
    return 'released';
  end if;

  -- a diagnostic below the threshold: one extension while someone has yet to answer (handoff 7)
  if v_r.kind = 'diagnostic' and not v_r.extended
     and exists (select 1 from app.participation p where p.round_id = v_r.id and not p.answered) then
    update app.assessment_round
    set extended = true, closes_at = greatest(closes_at, now()) + make_interval(days => app.setting_int('extension_days'))
    where id = v_r.id;
    insert into app.audit_event (org_id, kind, detail)
    values (v_r.org_id, 'round_extended', jsonb_build_object('round', v_r.id, 'kind', v_r.kind));
    return 'answering';
  end if;

  -- then no result (a pulse: missed), and the answers go with their sets (owner C9)
  delete from app.response_set rs where rs.round_id = v_r.id;
  perform app.rewrite_participation(v_r.id);
  update app.assessment_round set phase = 'closed' where id = v_r.id;
  insert into app.audit_event (org_id, kind, detail)
  values (v_r.org_id, 'round_closed', jsonb_build_object('round', v_r.id, 'kind', v_r.kind, 'result', false));
  return 'closed';
end $$;
comment on function app.close_round(uuid) is
  'Closes a round that is due: snapshot and reshuffle at or above k; else one extension (diagnostic); else no result (a pulse: missed). Run by the scheduled job.';

-- ---------------------------------------------------------------- the questions, for both kinds
create or replace function app.get_round_form(p_round uuid) returns jsonb
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
    'number', (select count(*)::int from app.assessment_round x
               where x.team_id = v_r.team_id and x.kind = v_r.kind and (x.opens_at, x.id) <= (v_r.opens_at, v_r.id)),
    'team', v_r.team_id,
    'group', (select t.name from app.team t where t.id = v_r.team_id),
    'k', v_r.k,
    'closes_at', v_r.closes_at,
    'state', case when v_answered is null then 'not_invited' when not v_open then 'closed'
                  when v_answered then 'answered' else 'open' end,
    'version', v_r.instrument_version_id,
    -- one mixed order per round, the same for everyone in it, never grouped by scale (handoff 6.11); a pulse
    -- asks its own questions, an agreement's in the words it was built with
    'items', case when v_open and v_answered is false then
      case when v_r.kind = 'pulse' then (
        select jsonb_agg(jsonb_build_object('id', coalesce(q.item_id, q.agreement_id), 'text', coalesce(q.text, i.text) ->> 'en',
                                            'kind', case when q.agreement_id is null then 'statement' else 'agreement' end)
                         order by md5(v_r.id::text || coalesce(q.item_id, q.agreement_id)::text))
        from app.pulse_question q left join app.item i on i.id = q.item_id
        where q.round_id = v_r.id)
      else (
        select jsonb_agg(jsonb_build_object('id', i.id, 'text', i.text ->> 'en') order by md5(v_r.id::text || i.id::text))
        from app.instrument_version_item vi join app.item i on i.id = vi.item_id
        where vi.instrument_version_id = v_r.instrument_version_id) end end);
end $$;
comment on function app.get_round_form(uuid) is
  'For a current member: the round''s questions in its mixed order while the caller has yet to answer, and the caller''s own state.';

-- ---------------------------------------------------------------- the group's pulses
create function app.get_pulses(p_team uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when app.is_team_member(p_team) then jsonb_build_object(
    'running', coalesce((select s.next_at is not null from app.pulse_schedule s where s.team_id = p_team), false),
    'next_at', (select s.next_at from app.pulse_schedule s where s.team_id = p_team),
    'weeks', coalesce((select s.weeks from app.pulse_schedule s where s.team_id = p_team), app.setting_int('pulse_rhythm_weeks')),
    'days', coalesce((select s.window_days from app.pulse_schedule s where s.team_id = p_team), app.setting_int('pulse_window_days')),
    'weeks_min', (select s.min_value from app.setting s where s.key = 'pulse_rhythm_weeks'),
    'weeks_max', (select s.max_value from app.setting s where s.key = 'pulse_rhythm_weeks'),
    'days_min', (select s.min_value from app.setting s where s.key = 'pulse_window_days'),
    'days_max', (select s.max_value from app.setting s where s.key = 'pulse_window_days'),
    'max_questions', (select t.max_questions from app.pulse_template t where t.version = app.pulse_template_version()),
    'max_rotating', (select t.max_rotating from app.pulse_template t where t.version = app.pulse_template_version()),
    'wording_confirmed', (select t.wording_confirmed from app.pulse_template t where t.version = app.pulse_template_version()),
    -- what the next pulse would ask if it opened now, in the order it is built
    'next', coalesce((
      select jsonb_agg(jsonb_build_object('source', q.source, 'text', coalesce(q.text, i.text) ->> 'en', 'scale', f.name ->> 'en')
                       order by q.ordinal)
      from app.pulse_questions(p_team) q
      left join app.item i on i.id = q.item_id
      left join app.factor f on f.id = q.factor_id), '[]'::jsonb),
    'focus', (select count(*)::int from app.focus_area fa where fa.team_id = p_team and fa.status = 'active'),
    'agreements', (select count(*)::int from app.working_agreement a join app.charter_version v on v.id = a.version_id
                   where v.team_id = p_team and v.status = 'in_force'),
    'leader', app.is_team_leader(p_team),
    'can_manage', app.is_team_leader(p_team) and app.team_plan_writable(p_team) and app.plan_allows(p_team, 'pulse')) end
$$;
comment on function app.get_pulses(uuid) is
  'For the group''s current members: the pulse rhythm, the next date, and what the next pulse would ask, in order. No answer, no count.';

-- ---------------------------------------------------------------- a pulse's result
create function app.get_pulse_result(p_round uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'round', r.id,
    'team', r.team_id,
    'number', (select count(*)::int from app.assessment_round x
               where x.team_id = r.team_id and x.kind = 'pulse' and (x.opens_at, x.id) <= (r.opens_at, r.id)),
    'opens_at', r.opens_at,
    'closes_at', r.closes_at,
    'k', r.k,
    'invited', r.invited,
    -- a count, never who
    'answered', (select count(*)::int from app.participation p where p.round_id = r.id and p.answered),
    -- the change margin of the cut-offs the pulse closed with (handoff 7: 0.6)
    'margin', (select c.change_margin from app.cutoff_set c where c.version = coalesce(
                 (select min(s.cutoff_version) from app.factor_score s where s.round_id = r.id),
                 (select max(c2.version) from app.cutoff_set c2 where c2.valid_from <= r.closes_at))),
    -- each focus scale: level, agreement label and standing; and its level when a pulse last asked the same items
    'scales', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', f.key, 'name', f.name ->> 'en', 'layer', f.layer, 'reading_type', f.reading_type, 'evidence', f.evidence,
               'level', s.level, 'agreement', s.agreement_label, 'standing', s.standing,
               'before', (select s2.level from app.assessment_round r2
                          join app.factor_score s2 on s2.round_id = r2.id and s2.factor_id = s.factor_id
                          where r2.team_id = r.team_id and r2.kind = 'pulse' and r2.phase = 'released' and s2.n >= r2.k
                            and (r2.opens_at, r2.id) < (r.opens_at, r.id)
                            and app.factor_comparable(r2.instrument_version_id, r.instrument_version_id, s.factor_id)
                          order by r2.opens_at desc, r2.id desc limit 1))
             order by (select min(q.ordinal) from app.pulse_question q where q.round_id = r.id and q.factor_id = s.factor_id))
      from app.factor_score s join app.factor f on f.id = s.factor_id
      where s.round_id = r.id and s.n >= r.k), '[]'::jsonb),
    -- each agreement: its level, and its level when a pulse last asked the same agreement in the same words
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'text', q.text ->> 'en', 'level', a.level,
               'before', (select a2.level from app.pulse_question q2
                          join app.assessment_round r2 on r2.id = q2.round_id
                          join app.agreement_score a2 on a2.round_id = r2.id and a2.agreement_id = q2.agreement_id
                          where r2.team_id = r.team_id and r2.kind = 'pulse' and r2.phase = 'released' and a2.n >= r2.k
                            and (r2.opens_at, r2.id) < (r.opens_at, r.id) and q2.text = q.text
                          order by r2.opens_at desc, r2.id desc limit 1))
             order by q.ordinal)
      from app.pulse_question q join app.agreement_score a on a.round_id = r.id and a.agreement_id = q.agreement_id
      where q.round_id = r.id and a.n >= r.k), '[]'::jsonb),
    -- each item: its text and its mean, nothing else (handoff 6.12)
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('text', i.text ->> 'en', 'scale', f.name ->> 'en', 'source', q.source, 'level', s.level)
             order by q.ordinal)
      from app.pulse_question q
      join app.item_score s on s.round_id = r.id and s.item_id = q.item_id
      join app.item i on i.id = q.item_id
      join app.factor f on f.id = q.factor_id
      where q.round_id = r.id and s.n >= r.k), '[]'::jsonb))
  from app.assessment_round r
  where r.id = p_round and r.kind = 'pulse' and r.phase = 'released' and app.is_team_member(r.team_id)
$$;
comment on function app.get_pulse_result(uuid) is
  'For current members, a released pulse at or above its threshold: focus scales, agreements and items with their levels, and the level last asked for change. Labels only.';

-- ---------------------------------------------------------------- the firewall's reviewed list and answer tables
create or replace function app.anonymity_firewall() returns table (seq int, rule text, pass boolean, evidence jsonb)
  language plpgsql stable security definer set search_path = ''
as $fn$
declare
  -- agreement_response and agreement_score (0020) are answer tables too
  v_answer constant text[] := array['response_set', 'response', 'participation', 'factor_score', 'item_score',
                                    'scan_response_set', 'scan_response', 'scan_replace_key', 'scan_theme_score',
                                    'agreement_response', 'agreement_score'];
  v_sets constant text[] := array['response_set', 'scan_response_set'];
  v_guards constant text[] := array['forbid_answer_change'];
  -- the platform's own roles, which hold every table by design: no client, key or product path reaches them
  v_platform constant text[] := array['pg_read_all_data', 'pg_write_all_data', 'supabase_read_only_user', 'supabase_etl_admin'];
  -- reviewed: the write paths and the readers that return counts, labels and levels only; get_rounds and
  -- get_round_form (0015) read participation for a count and the caller's own state; get_pulse_result (0020)
  -- reads a released pulse's snapshot at or above its threshold
  v_reviewed constant text[] := array['submit_scan', 'submit_response', 'get_team_view', 'get_team_view_by_code',
                                      'get_results', 'get_item_results', 'get_participation_count',
                                      'get_rounds', 'get_round_form', 'get_pulse_result'];
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
grant execute on function app.start_pulses(uuid, int, int), app.set_pulse_rhythm(uuid, int, int), app.stop_pulses(uuid),
  app.get_pulses(uuid), app.get_pulse_result(uuid) to authenticated;
-- the scheduled job; nobody else
grant execute on function app.open_due_pulses() to service_role;

-- ---------------------------------------------------------------- the schedule
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    -- by name, so applying this again replaces the job rather than adding a second
    perform cron.schedule('leaderpact-open-due-pulses', '*/5 * * * *', 'select app.open_due_pulses()');
  end if;
end $$;
