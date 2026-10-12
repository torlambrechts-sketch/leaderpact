-- 0007_rounds.sql — diagnostic and pulse rounds: who was asked, whether they answered, the answers under
-- no person, and the results computed once at close (handoff 6.10-6.12, 7 and 8; REUSE 4.4-4.6).
--
-- 1. **A round** belongs to a group and moves scheduled → answering → closed or released (owner C11:
--    closed means the window has ended; released means the snapshot exists and is shown). When it opens
--    it freezes the threshold, fixes its window, and invites every current member, who are its
--    denominator (owner C7). Nothing about it changes after that but the phase and the one extension.
-- 2. **Participation says whether, never when.** One row per invited person: round, person, answered.
--    No time column, so it cannot be matched to a response set by when (CLAUDE.md invariant 2).
-- 3. **Answers are unreadable.** `response_set` carries an id, its organisation, its round and its
--    instrument version, nothing else. It, `response`, `participation`, `factor_score` and `item_score`
--    have row-level security, no policy and no grant to any role, `service_role` included (invariant 3).
-- 4. **One write path,** `submit_response`, for a signed-in member: it finds the caller's own
--    participation by auth.uid(), refuses a second submission, a closed round or a missing item (owner
--    C8), marks the person as answered and stores the set under a random id, in one transaction, and
--    returns `{ok}` or a reason, never an id (invariant 4). The round's row lock serialises it with the
--    close, which happens in the same transaction when the last invited person answers.
-- 5. **Closing** (`close_round`, run by the scheduled job; there is no early close). At or above the
--    round's threshold the snapshot is written once — level, agreement label and standing per scale, with
--    the instrument and cut-off versions (owner C6), and the level per item — and then the response sets
--    are re-inserted in random order with new ids and every participation row is rewritten, so neither a
--    transaction id nor a row's position links a person to a set (owner C3). Below it: a pulse is missed;
--    a diagnostic gets one 7-day extension, then no result. Either way its answers are deleted (owner C9).
-- 6. **Reading** (`get_results`, `get_item_results`, `get_participation_count`): for current members of
--    the group only; results only for a released round at or above its threshold; labels only, never the
--    agreement number; counts only, never who (handoff 7, What a result may show).

-- ---------------------------------------------------------------- the round
create table app.assessment_round (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  kind text not null check (kind in ('diagnostic', 'pulse')),
  instrument_version_id uuid not null references app.instrument_version (id),
  phase text not null default 'scheduled' check (phase in ('scheduled', 'answering', 'closed', 'released')),
  -- frozen when the round opens (CLAUDE.md invariant 1)
  k int check (k between app.k_floor() and app.k_max()),
  window_days int not null check (window_days between 3 and 30),
  opens_at timestamptz not null,
  closes_at timestamptz,
  extended boolean not null default false,
  -- the members invited at opening: the denominator (owner C7)
  invited int check (invited >= 0),
  check ((phase = 'scheduled') = (k is null)),
  check (phase = 'scheduled' or (closes_at is not null and invited is not null)),
  foreign key (team_id, org_id) references app.team (id, org_id) on delete cascade
);
create index assessment_round_team_idx on app.assessment_round (team_id);
create index assessment_round_due_idx on app.assessment_round (closes_at) where phase = 'answering';
-- one round answering per group at a time
create unique index assessment_round_one_open_uidx on app.assessment_round (team_id) where phase = 'answering';

create function app.assessment_round_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
declare
  v_rank constant jsonb := '{"scheduled": 0, "answering": 1, "closed": 2, "released": 2}';
begin
  if (old.org_id, old.team_id, old.kind) is distinct from (new.org_id, new.team_id, new.kind) then
    raise exception 'a round''s group and kind are fixed' using errcode = 'check_violation';
  end if;
  if old.phase <> 'scheduled' then
    if (old.instrument_version_id, old.k, old.window_days, old.opens_at, old.invited)
       is distinct from (new.instrument_version_id, new.k, new.window_days, new.opens_at, new.invited) then
      raise exception 'an open round''s version, threshold, window and denominator are fixed' using errcode = 'check_violation';
    end if;
    if new.closes_at is distinct from old.closes_at and (old.extended or not new.extended) then
      raise exception 'a round''s closing date moves once, by its one extension' using errcode = 'check_violation';
    end if;
  end if;
  if old.extended and not new.extended then
    raise exception 'an extension is not undone' using errcode = 'check_violation';
  end if;
  if (v_rank ->> new.phase)::int < (v_rank ->> old.phase)::int
     or (old.phase in ('closed', 'released') and new.phase <> old.phase) then
    raise exception 'a round moves only forward, and a closed round is not reopened' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger assessment_round_fixed before update on app.assessment_round for each row execute function app.assessment_round_fixed();

alter table app.assessment_round enable row level security;
create policy assessment_round_read on app.assessment_round for select to authenticated using (app.is_team_member(team_id));
grant select on app.assessment_round to authenticated;

-- ---------------------------------------------------------------- who was asked, and whether they answered
create table app.participation (
  round_id uuid not null references app.assessment_round (id) on delete cascade,
  person_id uuid not null references app.person (id) on delete cascade,
  org_id uuid not null references app.organisation (id) on delete cascade,
  answered boolean not null default false,
  primary key (round_id, person_id)
);
create index participation_person_idx on app.participation (person_id);
comment on table app.participation is
  'Whether an invited member has answered, never when (handoff 8). No policy, no grant.';

-- ---------------------------------------------------------------- answers: unreadable by every role
create table app.response_set (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references app.organisation (id) on delete cascade,
  round_id uuid not null references app.assessment_round (id) on delete cascade,
  instrument_version_id uuid not null references app.instrument_version (id)
);
create index response_set_round_idx on app.response_set (round_id);
comment on table app.response_set is
  'One anonymous submission. No person and no time (CLAUDE.md invariant 2). No policy, no grant.';

create table app.response (
  response_set_id uuid not null references app.response_set (id) on delete cascade,
  item_id uuid not null references app.item (id),
  value smallint not null check (value between 1 and 5),
  primary key (response_set_id, item_id)
);

create trigger response_set_fixed before update on app.response_set for each row execute function app.forbid_answer_change();
create trigger response_fixed before update on app.response for each row execute function app.forbid_answer_change();

-- ---------------------------------------------------------------- the snapshot, written once at close
create table app.factor_score (
  round_id uuid not null references app.assessment_round (id) on delete cascade,
  factor_id uuid not null references app.factor (id),
  org_id uuid not null references app.organisation (id) on delete cascade,
  n int not null check (n >= app.k_floor()),
  level numeric(2, 1) not null check (level between 1 and 5),
  -- never shown: readers return the label only (handoff 7)
  agreement numeric(5, 4) not null check (agreement between 0 and 1),
  agreement_label text not null check (agreement_label in ('high', 'medium', 'low')),
  standing text not null check (standing in ('priority', 'watch', 'strength', 'views_differ', 'fact', 'read_with')),
  cutoff_version int not null references app.cutoff_set (version),
  instrument_version_id uuid not null references app.instrument_version (id),
  -- the charter in force at close; the charter tables, and this key's reference, come in milestone 9
  charter_version_id uuid,
  primary key (round_id, factor_id)
);

create table app.item_score (
  round_id uuid not null references app.assessment_round (id) on delete cascade,
  item_id uuid not null references app.item (id),
  org_id uuid not null references app.organisation (id) on delete cascade,
  n int not null check (n >= app.k_floor()),
  level numeric(2, 1) not null check (level between 1 and 5),
  primary key (round_id, item_id)
);

create trigger factor_score_fixed before update on app.factor_score for each row execute function app.forbid_answer_change();
create trigger item_score_fixed before update on app.item_score for each row execute function app.forbid_answer_change();

alter table app.participation enable row level security;
alter table app.response_set enable row level security;
alter table app.response enable row level security;
alter table app.factor_score enable row level security;
alter table app.item_score enable row level security;
revoke all on app.participation, app.response_set, app.response, app.factor_score, app.item_score
  from anon, authenticated, service_role;

-- ---------------------------------------------------------------- opening (the scheduled job)
create function app.open_round(p_round uuid) returns int
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_r app.assessment_round;
  v_invited int;
begin
  select * into v_r from app.assessment_round r where r.id = p_round for update;
  if not found or v_r.phase <> 'scheduled' or v_r.opens_at > now() then
    return null;
  end if;
  -- one round answering per group: a due round waits until the open one has closed
  if exists (select 1 from app.assessment_round r where r.team_id = v_r.team_id and r.phase = 'answering') then
    return null;
  end if;
  insert into app.participation (round_id, person_id, org_id)
  select v_r.id, m.person_id, v_r.org_id
  from app.membership m
  where m.team_id = v_r.team_id and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())
  order by random();
  get diagnostics v_invited = row_count;
  update app.assessment_round
  set phase = 'answering', k = app.k_threshold(v_r.org_id), invited = v_invited,
      closes_at = now() + make_interval(days => v_r.window_days)
  where id = v_r.id;
  insert into app.audit_event (org_id, kind, detail)
  values (v_r.org_id, 'round_opened', jsonb_build_object('round', v_r.id, 'kind', v_r.kind, 'invited', v_invited));
  return v_invited;
end $$;
comment on function app.open_round(uuid) is
  'Opens a scheduled round that is due: freezes k, fixes the window, invites every current member (owner C7).';

-- ---------------------------------------------------------------- the one write path
create function app.submit_response(p_round uuid, p_answers jsonb) returns jsonb
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
  if not found then
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
  'The diagnostic''s and the pulse''s one write path: {ok} or {ok: false, reason}; never an id (CLAUDE.md invariant 4).';

-- ---------------------------------------------------------------- closing
-- every participation row of a round written again, in random order: none keeps the transaction id or
-- the place of the submission that marked it
create function app.rewrite_participation(p_round uuid) returns void
  language sql volatile security definer set search_path = ''
as $$
  with gone as (delete from app.participation p where p.round_id = p_round returning p.*)
  insert into app.participation (round_id, person_id, org_id, answered)
  select g.round_id, g.person_id, g.org_id, g.answered from gone g order by random()
$$;

create function app.close_round(p_round uuid) returns text
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
    -- the snapshot, once: per scale, each set's sum over the scale's items in this version
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
        group by i.factor_id, r.response_set_id) x
      group by x.factor_id) t
    join app.factor f on f.id = t.factor_id;

    insert into app.item_score (round_id, item_id, org_id, n, level)
    select v_r.id, r.item_id, v_r.org_id, count(*)::int, app.level(sum(r.value), count(*))
    from app.response r join app.response_set rs on rs.id = r.response_set_id
    where rs.round_id = v_r.id
    group by r.item_id;

    -- the reshuffle (owner C3)
    for v_old in select rs.id from app.response_set rs where rs.round_id = v_r.id order by random() loop
      v_new := gen_random_uuid();
      insert into app.response_set (id, org_id, round_id, instrument_version_id)
      select v_new, rs.org_id, rs.round_id, rs.instrument_version_id from app.response_set rs where rs.id = v_old;
      insert into app.response (response_set_id, item_id, value)
      select v_new, r.item_id, r.value from app.response r where r.response_set_id = v_old order by random();
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

  -- then no result (a pulse: missed), and the answers go (owner C9)
  delete from app.response_set rs where rs.round_id = v_r.id;
  perform app.rewrite_participation(v_r.id);
  update app.assessment_round set phase = 'closed' where id = v_r.id;
  insert into app.audit_event (org_id, kind, detail)
  values (v_r.org_id, 'round_closed', jsonb_build_object('round', v_r.id, 'kind', v_r.kind, 'result', false));
  return 'closed';
end $$;
comment on function app.close_round(uuid) is
  'Closes a round that is due: snapshot and reshuffle at or above k; else one extension (diagnostic); else no result. Run by the scheduled job.';

-- ---------------------------------------------------------------- reading
create function app.get_results(p_round uuid)
  returns table (factor_key text, factor_name jsonb, layer text, reading_type text, evidence text, ordinal int,
                 level numeric, agreement text, standing text, n int)
  language sql stable security definer set search_path = ''
as $$
  select f.key, f.name, f.layer, f.reading_type, f.evidence, f.ordinal, s.level, s.agreement_label, s.standing, s.n
  from app.assessment_round r
  join app.factor_score s on s.round_id = r.id
  join app.factor f on f.id = s.factor_id
  where r.id = p_round and r.phase = 'released' and s.n >= r.k and app.is_team_member(r.team_id)
  order by f.ordinal
$$;

create function app.get_item_results(p_round uuid)
  returns table (item_code text, item_text jsonb, factor_key text, level numeric, n int)
  language sql stable security definer set search_path = ''
as $$
  select i.code, i.text, f.key, s.level, s.n
  from app.assessment_round r
  join app.item_score s on s.round_id = r.id
  join app.item i on i.id = s.item_id
  join app.factor f on f.id = i.factor_id
  where r.id = p_round and r.phase = 'released' and s.n >= r.k and app.is_team_member(r.team_id)
  order by f.ordinal, i.code
$$;

-- "5 of 8 answered": a count, never who (handoff 6.10)
create function app.get_participation_count(p_round uuid) returns table (invited int, answered int)
  language sql stable security definer set search_path = ''
as $$
  select r.invited, (select count(*)::int from app.participation p where p.round_id = r.id and p.answered)
  from app.assessment_round r
  where r.id = p_round and r.phase <> 'scheduled' and app.is_team_member(r.team_id)
$$;

grant execute on function app.submit_response(uuid, jsonb), app.get_results(uuid), app.get_item_results(uuid),
  app.get_participation_count(uuid) to authenticated;
-- the scheduled job opens and closes rounds; nobody else
grant execute on function app.open_round(uuid), app.close_round(uuid) to service_role;
