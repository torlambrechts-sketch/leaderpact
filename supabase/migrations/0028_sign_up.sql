-- 0028_sign_up.sql — the account's name and company from sign-up, for the sign-up with a password, Google and
-- Microsoft (owner, 15 October 2026; D-57).
--
-- 1. **The name a person gives at sign-up is their display name**, or the name Google or Microsoft holds for them.
--    Auth keeps both in the user's metadata (`full_name`, or `name`); `display_name_for` reads it, strips control
--    characters and keeps 120 characters, and falls back to the part of the email before the @ only when there is
--    none (0009's rule). `ensure_person` makes the person row from it on the first page after signing in, so
--    every later insert of the row (a group, a Leader Profile, an invitation) finds it and keeps it. An existing
--    row is never renamed here.
-- 2. **The company names the organisation** `start_group` makes, from the metadata's `company` (1 to 200
--    characters); without one, the group's name, as before (0009). A sign-up with a password gives it on the
--    form; one through Google or Microsoft gives it on the new-group form, which writes the same metadata.
-- 3. **Metadata is the person's own**: they wrote it, and it goes only into their own rows, length-checked and
--    stripped. No other person's row reads it, and nothing about an answer is near it.

create function app.display_name_for(p_uid uuid) returns text
  language sql stable security definer set search_path = ''
as $$
  select coalesce(
    nullif(left(btrim(regexp_replace(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), '[[:cntrl:]]+', ' ', 'g')), 120), ''),
    nullif(left(btrim(split_part(u.email, '@', 1)), 120), ''))
  from auth.users u where u.id = p_uid
$$;
comment on function app.display_name_for(uuid) is
  'A person''s display name from sign-up: the name they gave, or their provider''s, else the part of the email before the @ (0028).';

create function app.company_for(p_uid uuid) returns text
  language sql stable security definer set search_path = ''
as $$
  select nullif(left(btrim(regexp_replace(coalesce(u.raw_user_meta_data ->> 'company', ''), '[[:cntrl:]]+', ' ', 'g')), 200), '')
  from auth.users u where u.id = p_uid
$$;
comment on function app.company_for(uuid) is 'The company a person gave at sign-up or on the new-group form, if any (0028).';

-- the person row on the first page after signing in, from the name given at sign-up
create function app.ensure_person() returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  v_name := app.display_name_for(v_uid);
  if v_name is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  insert into app.person (id, display_name) values (v_uid, v_name) on conflict (id) do nothing;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.ensure_person() is
  'The signed-in caller''s person row, from the name given at sign-up; an existing row is left as it is (0028).';

-- start_group (0009), with the sign-up's name and the company

create or replace function app.start_group(p_name text, p_member_count int, p_request uuid) returns jsonb
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

  -- the name given at sign-up, or the provider's, else the part of the email before the @ (0028)
  insert into app.person (id, display_name)
  values (v_uid, app.display_name_for(v_uid))
  on conflict (id) do nothing;

  -- the organisation takes the company given at sign-up or on the new-group form; without one, the group's name
  insert into app.organisation (name) values (coalesce(app.company_for(v_uid), v_name)) returning id into v_org;
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

grant execute on function app.ensure_person() to authenticated;
