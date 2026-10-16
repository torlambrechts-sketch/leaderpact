-- 0031_profile_link.sql — a private link to a Leader Profile, made and turned off by its owner (owner, 16 October 2026;
-- D-66). The owner: "Leader Profile as PDF and a private link".
--
-- CLAUDE.md invariant 11 holds: the profile is its owner's alone, and others see it only through a share its owner
-- made, at the level shared. This adds a second kind of share beside a group's: a link.
--
-- - **One link per profile, made by its owner**, at a level: the five domains, or the domains and facets.
--   `make_profile_link` returns the link's token once. Only its SHA-256 is stored, so nobody can read the link
--   back, staff included. A new link replaces the last one.
-- - **Anyone holding the link reads the profile at that level, as bands only:** never a sum, a count or a
--   position, exactly as a group sees it (`get_group_profiles`). Shown alongside: the owner's name, the test with
--   its number of questions, and the day it was taken.
-- - **Turned off at once** by `end_profile_link`. It also ends when the owner retakes a test, as every group share
--   resets then (handoff 6.17). It is gone with the profile, and the account.
-- - **Audited as a sharing change**, with the level only: `sharing_changed`, `{"to": "link", "level": …}`.
-- - **In the export:** whether a link is on, its level and when it was made, never the link itself.
--
-- The table has row-level security on, no policy and no grant. Every read and write goes through these functions.
-- Turning a link off clears its fingerprint and keeps the row.

create table app.profile_link (
  person_id uuid primary key references app.personality_profile (person_id) on delete cascade,
  -- the token's SHA-256, or null when the link is off
  token_hash bytea unique check (token_hash is null or octet_length(token_hash) = 32),
  level text not null check (level in ('domains', 'facets')),
  made_at timestamptz not null default now()
);
comment on table app.profile_link is
  'A private link to a person''s Leader Profile (D-66): its fingerprint, its level and when it was made. Set by its owner only; no client reads it.';

alter table app.profile_link enable row level security;
revoke all on app.profile_link from anon, authenticated, service_role;

-- ---------------------------------------------------------------- the owner makes, reads and ends their link
create function app.make_profile_link(p_level text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if p_level is null or p_level not in ('domains', 'facets') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if not exists (select 1 from app.personality_profile pp where pp.person_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  v_token := app.new_link_code();
  insert into app.profile_link as l (person_id, token_hash, level, made_at)
  values (v_uid, pg_catalog.sha256(convert_to(v_token, 'UTF8')), p_level, now())
  on conflict (person_id) do update set token_hash = excluded.token_hash, level = excluded.level, made_at = excluded.made_at;
  insert into app.audit_event (org_id, kind, actor, detail)
  values (null, 'sharing_changed', v_uid, jsonb_build_object('to', 'link', 'level', p_level));
  return jsonb_build_object('ok', true, 'token', v_token);
end $$;
comment on function app.make_profile_link(text) is
  'The caller makes a private link to their profile at a level, replacing any earlier one; the token is returned once and only its hash kept (D-66).';

create function app.end_profile_link() returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  update app.profile_link l set token_hash = null where l.person_id = v_uid and l.token_hash is not null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into app.audit_event (org_id, kind, actor, detail)
    values (null, 'sharing_changed', v_uid, jsonb_build_object('to', 'link', 'level', 'off'));
  end if;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.end_profile_link() is 'The caller turns their private link off, at once (D-66).';

create function app.get_profile_link() returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select case when auth.uid() is null then jsonb_build_object('ok', false, 'reason', 'signed_out')
         else coalesce(
           (select jsonb_build_object('ok', true, 'on', true, 'level', l.level, 'made_at', l.made_at)
            from app.profile_link l where l.person_id = auth.uid() and l.token_hash is not null),
           jsonb_build_object('ok', true, 'on', false)) end
$$;
comment on function app.get_profile_link() is 'Whether the caller''s private link is on, its level and when it was made; never the link (D-66).';

-- ---------------------------------------------------------------- what the link shows
create function app.get_linked_profile(p_token text) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
       'ok', true,
       'name', p.display_name,
       'test', t.key,
       'test_name', t.name,
       'items', (select count(*)::int from app.profile_item i where i.test_id = pp.test_id),
       'taken_on', (pp.taken_at at time zone 'UTC')::date,
       'level', l.level,
       'traits', (select jsonb_agg(jsonb_build_object(
                           'key', tr.key, 'kind', tr.kind, 'domain', tr.domain, 'name', tr.name ->> 'en',
                           'band', app.profile_band((pp.scores -> tr.key ->> 'sum')::int, (pp.scores -> tr.key ->> 'n')::int, pp.band_set))
                         order by tr.kind <> 'domain', tr.ordinal)
                  from app.profile_trait tr
                  where tr.test_id = pp.test_id and (tr.kind = 'domain' or l.level = 'facets')))
     from app.profile_link l
     join app.personality_profile pp on pp.person_id = l.person_id
     join app.person p on p.id = pp.person_id
     join app.profile_test t on t.id = pp.test_id
     where p_token ~ '^[A-Za-z0-9_-]{22}$'
       and l.token_hash = pg_catalog.sha256(convert_to(p_token, 'UTF8'))),
    jsonb_build_object('ok', false, 'reason', 'not_found'))
$$;
comment on function app.get_linked_profile(text) is
  'A Leader Profile for whoever holds its private link: the owner''s name, the test and its day, and each trait''s band at the link''s level. Bands only (D-66).';

-- ---------------------------------------------------------------- a retake ends the link, as it resets every share
create function app.profile_link_retake() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  v_n int;
begin
  -- save_profile is the profile's only writer, and its only update is a retake: every update ends the link
  update app.profile_link l set token_hash = null where l.person_id = new.person_id and l.token_hash is not null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into app.audit_event (org_id, kind, actor, detail)
    values (null, 'sharing_changed', new.person_id, jsonb_build_object('to', 'link', 'level', 'off', 'reason', 'retake'));
  end if;
  return new;
end $$;
create trigger profile_link_retake after update on app.personality_profile
  for each row execute function app.profile_link_retake();

-- ---------------------------------------------------------------- the export says whether a link is on
create or replace function app.export_person(p_person uuid) returns jsonb
  language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'format', 'leaderpact-export/1',
    'made_at', now(),
    'person', (select jsonb_build_object('id', p.id, 'name', p.display_name, 'email', u.email)
               from app.person p left join auth.users u on u.id = p.id where p.id = p_person),
    'notifications', (select jsonb_build_object('summary', n.summary, 'time_zone', n.time_zone)
                      from app.notification_preference n where n.person_id = p_person),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('group', t.name, 'organisation', o.name, 'role', m.role,
                                                            'from', m.valid_from, 'to', m.valid_to) order by m.valid_from)
                        from app.membership m join app.team t on t.id = m.team_id join app.organisation o on o.id = t.org_id
                        where m.person_id = p_person), '[]'::jsonb),
    'leader_profile', (select jsonb_build_object(
                         'test', pt.key, 'taken_at', pp.taken_at,
                         'bands', (select jsonb_object_agg(tr.key, app.profile_band((pp.scores -> tr.key ->> 'sum')::int, (pp.scores -> tr.key ->> 'n')::int, pp.band_set))
                                   from app.profile_trait tr where tr.test_id = pp.test_id and pp.scores ? tr.key),
                         'shared_with', coalesce((select jsonb_agg(jsonb_build_object('group', t.name, 'level', s.level) order by t.name)
                                                  from app.profile_share s join app.team t on t.id = s.team_id where s.person_id = p_person), '[]'::jsonb),
                         'private_link', (select jsonb_build_object('on', l.token_hash is not null, 'level', l.level, 'made_at', l.made_at)
                                          from app.profile_link l where l.person_id = p_person))
                       from app.personality_profile pp join app.profile_test pt on pt.id = pp.test_id where pp.person_id = p_person),
    'asked', coalesce((select jsonb_agg(jsonb_build_object('group', t.name, 'kind', r.kind, 'opened', r.opens_at, 'answered', pa.answered) order by r.opens_at)
                       from app.participation pa join app.assessment_round r on r.id = pa.round_id join app.team t on t.id = r.team_id
                       where pa.person_id = p_person), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('group', t.name, 'title', a.title, 'due_on', a.due_on, 'status', a.status, 'done_at', a.done_at) order by a.created_at)
                         from app.action a join app.team t on t.id = a.team_id where a.owner_id = p_person), '[]'::jsonb),
    'focus_areas_chosen', coalesce((select jsonb_agg(jsonb_build_object('group', t.name, 'scale', f.name ->> 'en', 'chosen', fa.created_at) order by fa.created_at)
                                    from app.focus_area fa join app.team t on t.id = fa.team_id join app.factor f on f.id = fa.factor_id
                                    where fa.created_by = p_person), '[]'::jsonb),
    'agenda_items_proposed', coalesce((select jsonb_agg(jsonb_build_object('group', t.name, 'meeting', mt.title, 'meets_on', mt.meets_on,
                                                                           'title', ai.title, 'outcome', ai.outcome) order by mt.meets_on, ai.ordinal)
                                       from app.agenda_item ai join app.meeting mt on mt.id = ai.meeting_id join app.team t on t.id = mt.team_id
                                       where ai.proposed_by = p_person), '[]'::jsonb),
    'decisions_recorded', coalesce((select jsonb_agg(jsonb_build_object('group', t.name, 'meeting', mt.title, 'text', d.text) order by mt.meets_on)
                                    from app.decision d join app.agenda_item ai on ai.id = d.agenda_item_id join app.meeting mt on mt.id = ai.meeting_id
                                    join app.team t on t.id = mt.team_id where d.recorded_by = p_person), '[]'::jsonb),
    'charter_versions', coalesce((select jsonb_agg(jsonb_build_object('group', t.name, 'version', v.version, 'drafted', v.created_by = p_person,
                                                                      'put_in_force', v.agreed_by = p_person, 'agreed_at', v.agreed_at) order by v.created_at)
                                  from app.charter_version v join app.team t on t.id = v.team_id
                                  where v.created_by = p_person or v.agreed_by = p_person), '[]'::jsonb),
    'invitations_sent', (select count(*)::int from app.invitation i where i.created_by = p_person),
    'exports', coalesce((select jsonb_agg(e.requested_at order by e.requested_at) from app.export_request e where e.person_id = p_person), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('kind', a.kind, 'at', a.at, 'detail', a.detail) order by a.at)
                       from app.audit_event a where a.actor = p_person), '[]'::jsonb))
$$;
comment on function app.export_person(uuid) is
  'Everything stored about one person, as JSON: never another member''s words, never an answer. Internal; request_export calls it.';

insert into app.export_coverage (table_name, treatment, reason) values
  ('profile_link', 'included', 'whether a private link to the Leader Profile is on, what it shows and when it was made; never the link itself');

-- ---------------------------------------------------------------- access
revoke all on function app.profile_link_retake() from public;
grant execute on function app.make_profile_link(text), app.end_profile_link(), app.get_profile_link() to authenticated;
-- the link is opened by whoever holds it, signed in or not
grant execute on function app.get_linked_profile(text) to anon, authenticated;
