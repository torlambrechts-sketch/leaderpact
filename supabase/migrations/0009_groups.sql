-- 0009_groups.sql — a signed-in leader starts a group: the organisation, the group, their leader
-- membership and the group's Leadership Team Scan with its one link (handoff 6.3 and 6.4, milestone 4).
--
-- 1. **One function makes a group** (`start_group`), in one transaction, for the signed-in caller only:
--    the person row if it is their first group, an organisation and a group of the same name, the leader
--    membership, and a scan session with a fresh link code, the declared member count (4 to 15, the
--    leader included, owner C4), the threshold frozen from the organisation and the group's scan window.
--    It returns the group's id and the link's code, which the leader is entitled to read anyway
--    (`get_scan_link`). It writes no answer: the leader's own scan goes through `submit_scan` like every
--    other, so the scan keeps its one write path (CLAUDE.md invariant 4).
-- 2. **A repeated request makes no second group.** The browser sends a random request id with the
--    start; the same id from the same person returns the group it made. Starts by one person are
--    serialised, so a double press cannot race. The id is kept in the audit row, the one place the start
--    is recorded anyway.
-- 3. **Every group starts in an organisation of its own.** The Free plan is one group (handoff 1), and
--    an existing person who saves another scan adds a group (handoff 6.3); a new organisation per group
--    keeps both true until milestone 8 brings plans. The organisation takes the group's name.
-- 4. **The link's page reads one row by code** (`get_scan_invite`): the group's name, the phase, the
--    count, the closing date and the version to answer. Never a score and never a name (handoff 6.4).
--    It reads no answer table, so the anonymity firewall's rule 6 does not list it.
-- 5. **The display name** is the part of the email before the @ until the person sets one: `person`
--    requires a name, the save card asks for none (handoff 6.3), and nothing else is known.
--
-- Pattern origin: none in Orgpuls, which creates organisations from its admin screens.

-- the link's code: 16 random bytes, base64url, 22 characters (scan_session.code allows 22 to 64)
create function app.new_link_code() returns text
  language sql volatile set search_path = ''
as $$ select translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_') $$;

create function app.start_group(p_name text, p_member_count int, p_request uuid) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text := btrim(coalesce(p_name, ''));
  v_version uuid;
  v_org uuid;
  v_team uuid;
  v_code text;
  v_window int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is null or position('@' in v_email) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_request is null or length(v_name) not between 1 and 120
     or p_member_count is null or p_member_count < app.k_floor() or p_member_count > app.setting_int('members_per_group') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- one start at a time per person, so a double press makes one group
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('start_group:' || v_uid::text, 0));

  -- the same request again: the group it made, if the caller still leads it
  select (a.detail ->> 'team')::uuid into v_team
  from app.audit_event a
  where a.kind = 'group_created' and a.actor = v_uid and a.detail ->> 'request' = p_request::text
  limit 1;
  if v_team is not null then
    select ss.code into v_code
    from app.scan_session ss
    where ss.team_id = v_team and app.is_team_leader(v_team)
    order by ss.opens_at desc
    limit 1;
    if v_code is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    return jsonb_build_object('ok', true, 'team', v_team, 'code', v_code);
  end if;

  select v.id into v_version
  from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'scan' and v.status = 'published'
  order by v.version desc
  limit 1;
  if v_version is null then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  insert into app.person (id, display_name)
  values (v_uid, left(btrim(split_part(v_email, '@', 1)), 120))
  on conflict (id) do nothing;

  insert into app.organisation (name) values (v_name) returning id into v_org;
  insert into app.team (org_id, name) values (v_org, v_name) returning id into v_team;
  insert into app.membership (org_id, team_id, person_id, role) values (v_org, v_team, v_uid, 'leader');

  v_window := app.setting_int('scan_window_days');
  v_code := app.new_link_code();
  insert into app.scan_session (org_id, team_id, instrument_version_id, code, member_count, k, window_days, closes_at)
  values (v_org, v_team, v_version, v_code, p_member_count, app.k_threshold(v_org), v_window,
          now() + make_interval(days => v_window));

  -- ids and a count only (CLAUDE.md invariant 10)
  insert into app.audit_event (org_id, kind, actor, detail)
  values (v_org, 'group_created', v_uid, jsonb_build_object('team', v_team, 'request', p_request, 'members', p_member_count));

  return jsonb_build_object('ok', true, 'team', v_team, 'code', v_code);
end $$;
comment on function app.start_group(text, int, uuid) is
  'A signed-in leader starts a group and its scan: {ok, team, code} or {ok: false, reason}. Writes no answer.';

-- the link's page: what a person with the link may know before answering (handoff 6.4 and 6.5)
create function app.get_scan_invite(p_code text)
  returns table (group_name text, phase text, answered int, member_count int, closes_at timestamptz, instrument_version_id uuid)
  language sql stable security definer set search_path = ''
as $$
  select t.name, ss.phase, ss.answered, ss.member_count, ss.closes_at, ss.instrument_version_id
  from app.scan_session ss join app.team t on t.id = ss.team_id
  where p_code ~ '^[A-Za-z0-9_-]{22,64}$' and ss.code = p_code
$$;
comment on function app.get_scan_invite(text) is
  'The invite link''s page: group name, phase, count, closing date and version. Never a score, never a name.';

grant execute on function app.start_group(text, int, uuid) to authenticated;
grant execute on function app.get_scan_invite(text) to anon, authenticated;
