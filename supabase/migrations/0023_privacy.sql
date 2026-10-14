-- 0023_privacy.sql — "Download my data", deleting an account, and the audit trail kept 24 months (handoff 6.18
-- and 8; milestone 16: "An export arrives. A delete removes personal data. Limits return 429"; REUSE 4.16;
-- owner D6 and D7; D-53).
--
-- 1. **The export is built when it is asked for** (`request_export`): everything stored about the person, as
--    JSON (`export_person`), at most 5 a day (handoff 8; 0021). It arrives by mail as a one-time link valid 24
--    hours (owner D6; 0022 mints it), and the app serves it as a ZIP. Downloaded or expired, its content is
--    emptied. It cannot hold the person's answers to the scan, the diagnostic or pulses: none is stored with a
--    person (CLAUDE.md invariant 2), and the file says so.
-- 2. **Every table declares whether the export includes it** (`export_coverage`), so a new table without a
--    row fails the suite. Another member's words never go out: an agenda item, a decision or a charter the
--    person did not write is left out, and invitations they sent are counted, not listed.
-- 3. **Deleting an account** (`delete_account`) removes the person and everything that names them: their
--    memberships, Leader Profile, actions, presence, notification settings and exports, their address in the
--    invitations that named them, and their sign-in. What they wrote for a group stays with the group, without
--    their name. A group they are alone in goes with them, and its organisation when it holds no other group.
--    The only leader of a group with other members names another leader first (handoff 6.8). Group answers stay:
--    nothing links them to anyone (owner D7). "Delete my results" is the Leader Profile's own delete (0011).
-- 4. **The audit trail is kept 24 months** (handoff 8, Retention) and nobody changes it: a row is deleted only
--    when it is older than that, or with its organisation; a person's removal clears its actor. Saving a Leader
--    Profile records "consent given", the last of handoff 8's audited events, with the test and never a score.

-- ---------------------------------------------------------------- the export
create table app.export_request (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references app.person (id) on delete cascade,
  requested_at timestamptz not null default now(),
  state text not null default 'ready' check (state in ('ready', 'downloaded', 'expired')),
  -- the file's content until it is downloaded or expires; emptied then
  content jsonb check (content is null or jsonb_typeof(content) = 'object'),
  -- the mailed link's SHA-256, minted when the mail is claimed (0022), and when it stops working
  token_hash bytea unique check (token_hash is null or length(token_hash) = 32),
  link_expires_at timestamptz,
  downloaded_at timestamptz,
  check ((state = 'ready') = (content is not null)),
  check ((state = 'downloaded') = (downloaded_at is not null))
);
create index export_request_person_idx on app.export_request (person_id, requested_at);
comment on table app.export_request is
  'A person''s data export (handoff 6.18): its content until downloaded or expired, and only its link''s hash. No client reads it.';

-- ---------------------------------------------------------------- what the export covers, table by table
create table app.export_coverage (
  table_name text primary key check (table_name ~ '^[a-z][a-z_]*$'),
  treatment text not null check (treatment in ('included', 'excluded')),
  reason text not null check (length(btrim(reason)) between 1 and 300)
);
comment on table app.export_coverage is
  'Whether the data export includes each table, and why; a table with no row fails the suite (REUSE 4.16). No client reads it.';

insert into app.export_coverage (table_name, treatment, reason) values
  ('person', 'included', 'the person''s own name'),
  ('membership', 'included', 'the groups the person is or was in, with role and dates'),
  ('organisation', 'included', 'the name of each organisation of those groups'),
  ('team', 'included', 'the name of each group'),
  ('personality_profile', 'included', 'the person''s Leader Profile: the test, when it was taken, and each trait''s band'),
  ('profile_share', 'included', 'what each group may see of the profile'),
  ('action', 'included', 'actions the person owns'),
  ('agenda_item', 'included', 'agenda items the person proposed, in their own words'),
  ('decision', 'included', 'decisions the person recorded, in their own words'),
  ('charter_version', 'included', 'charter versions the person drafted or put in force: the version and the date'),
  ('invitation', 'included', 'how many invitations the person sent; the invited names and addresses are other people''s'),
  ('participation', 'included', 'the rounds the person was asked in, and whether they answered; never their answers'),
  ('notification_preference', 'included', 'how often the person''s summary arrives, and their time zone'),
  ('export_request', 'included', 'when the person asked for an export'),
  ('audit_event', 'included', 'audited events the person did, as kinds, dates and ids'),
  ('focus_area', 'included', 'focus areas the person chose: the scale and the date'),
  ('meeting', 'excluded', 'the group''s meetings, not the person''s'),
  ('parked_topic', 'excluded', 'stored without a name'),
  ('process_comment', 'excluded', 'stored without a sender (handoff 8)'),
  ('meeting_presence', 'excluded', 'a heartbeat of the last 30 seconds, not kept'),
  ('meeting_signal', 'excluded', 'a version number for sync, with no person'),
  ('response_set', 'excluded', 'answers are stored with no person (CLAUDE.md invariant 2)'),
  ('response', 'excluded', 'answers are stored with no person (CLAUDE.md invariant 2)'),
  ('agreement_response', 'excluded', 'answers are stored with no person (CLAUDE.md invariant 2)'),
  ('scan_response_set', 'excluded', 'answers are stored with no person (CLAUDE.md invariant 2)'),
  ('scan_response', 'excluded', 'answers are stored with no person (CLAUDE.md invariant 2)'),
  ('scan_replace_key', 'excluded', 'a key held by a browser, with no person'),
  ('factor_score', 'excluded', 'a group''s result, not the person''s'),
  ('item_score', 'excluded', 'a group''s result, not the person''s'),
  ('agreement_score', 'excluded', 'a group''s result, not the person''s'),
  ('scan_theme_score', 'excluded', 'a group''s result, not the person''s'),
  ('scan_session', 'excluded', 'the group''s scan, with no person'),
  ('assessment_round', 'excluded', 'the group''s rounds; the person''s part is in participation'),
  ('round_reminder', 'excluded', 'reminders per round and day, with no person'),
  ('pulse_schedule', 'excluded', 'the group''s rhythm'),
  ('pulse_question', 'excluded', 'what a group''s pulse asked'),
  ('team_task', 'excluded', 'the group''s charter'),
  ('working_agreement', 'excluded', 'the group''s charter'),
  ('subscription', 'excluded', 'the group''s plan, not the person''s'),
  ('trial', 'excluded', 'the group''s trial'),
  ('checkout', 'excluded', 'the group''s billing details'),
  ('payment_adapter', 'excluded', 'a platform setting'),
  ('outbox', 'excluded', 'mail waiting to go; sent mail is not kept with its recipients'),
  ('mail_day', 'excluded', 'a group''s count of invitation mail'),
  ('mail_suppression', 'excluded', 'hashes of addresses, with no person'),
  ('rate_window', 'excluded', 'hashes and counts, with no person'),
  ('rate_limit', 'excluded', 'reference data'),
  ('feature_flag', 'excluded', 'reference data'),
  ('factor', 'excluded', 'reference data'),
  ('factor_text', 'excluded', 'reference data'),
  ('instrument', 'excluded', 'reference data'),
  ('instrument_version', 'excluded', 'reference data'),
  ('instrument_version_item', 'excluded', 'reference data'),
  ('item', 'excluded', 'reference data'),
  ('scan_theme', 'excluded', 'reference data'),
  ('cutoff_set', 'excluded', 'reference data'),
  ('setting', 'excluded', 'reference data'),
  ('plan', 'excluded', 'reference data'),
  ('plan_feature', 'excluded', 'reference data'),
  ('plan_price', 'excluded', 'reference data'),
  ('charter_template', 'excluded', 'reference data'),
  ('agenda_template', 'excluded', 'reference data'),
  ('pulse_template', 'excluded', 'reference data'),
  ('profile_test', 'excluded', 'reference data'),
  ('profile_item', 'excluded', 'reference data'),
  ('profile_trait', 'excluded', 'reference data'),
  ('profile_band_set', 'excluded', 'reference data'),
  ('export_coverage', 'excluded', 'reference data');

alter table app.export_request enable row level security;
alter table app.export_coverage enable row level security;
revoke all on app.export_request, app.export_coverage from anon, authenticated, service_role;

-- Everything stored about one person, as JSON: never another member's words, never an answer.
create function app.export_person(p_person uuid) returns jsonb
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
                                                  from app.profile_share s join app.team t on t.id = s.team_id where s.person_id = p_person), '[]'::jsonb))
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

create function app.request_export() returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wait int;
  v_id uuid;
begin
  if v_uid is null or not exists (select 1 from app.person p where p.id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  -- 5 a day (handoff 8)
  v_wait := app.take_rate('export', v_uid::text);
  if v_wait > 0 then
    return jsonb_build_object('ok', false, 'reason', 'too_many', 'retry', v_wait);
  end if;
  insert into app.export_request (person_id, content) values (v_uid, app.export_person(v_uid)) returning id into v_id;
  insert into app.outbox (kind, person_id, ref_id) values ('export_ready', v_uid, v_id);
  return jsonb_build_object('ok', true);
end $$;
comment on function app.request_export() is
  'The caller asks for their data: built now, sent as a one-time link by mail. 5 a day: {ok} or {ok: false, reason, retry}.';

-- the mailed link: the file once, within 24 hours; then its content is emptied
create function app.download_export(p_token text) returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_e app.export_request;
begin
  select * into v_e from app.export_request e
  where p_token is not null and length(p_token) between 32 and 128
    and e.token_hash = pg_catalog.sha256(convert_to(p_token, 'UTF8'))
  for update;
  if v_e.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if v_e.state = 'downloaded' then
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;
  if v_e.state = 'expired' or v_e.link_expires_at <= now() then
    update app.export_request e set state = 'expired', content = null where e.id = v_e.id and e.state = 'ready';
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  update app.export_request e set state = 'downloaded', content = null, downloaded_at = now() where e.id = v_e.id;
  return jsonb_build_object('ok', true, 'content', v_e.content);
end $$;
comment on function app.download_export(text) is
  'The export''s one-time link: its content once, within 24 hours of the mail. {ok, content} or a reason.';

-- the job: an export never downloaded is emptied when its link has lapsed, or a week after it was asked for
create function app.expire_exports() returns int
  language sql volatile security definer set search_path = ''
as $$
  with lapsed as (
    update app.export_request e set state = 'expired', content = null
    where e.state = 'ready' and (e.link_expires_at <= now() or e.requested_at < now() - interval '7 days')
    returning 1)
  select count(*)::int from lapsed
$$;
comment on function app.expire_exports() is 'Empties exports whose link lapsed. The scheduled job.';

-- ---------------------------------------------------------------- deleting an account
create function app.delete_account() returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_blocked jsonb;
  v_alone uuid[];
  v_orgs uuid[];
begin
  if v_uid is null or not exists (select 1 from auth.users u where u.id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;

  -- the only leader of a group with other members names another leader first (handoff 6.8)
  select jsonb_agg(t.name order by t.name) into v_blocked
  from app.membership m join app.team t on t.id = m.team_id
  where m.person_id = v_uid and m.role = 'leader' and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())
    and not exists (select 1 from app.membership o where o.team_id = m.team_id and o.person_id <> v_uid and o.role = 'leader'
                    and o.valid_from <= now() and (o.valid_to is null or o.valid_to > now()))
    and exists (select 1 from app.membership o where o.team_id = m.team_id and o.person_id <> v_uid
                and o.valid_from <= now() and (o.valid_to is null or o.valid_to > now()));
  if v_blocked is not null then
    return jsonb_build_object('ok', false, 'reason', 'sole_leader', 'groups', v_blocked);
  end if;

  -- the groups they are alone in go with them, and an organisation left with no group
  select array_agg(m.team_id), array_agg(distinct t.org_id) into v_alone, v_orgs
  from app.membership m join app.team t on t.id = m.team_id
  where m.person_id = v_uid and m.valid_from <= now() and (m.valid_to is null or m.valid_to > now())
    and not exists (select 1 from app.membership o where o.team_id = m.team_id and o.person_id <> v_uid
                    and o.valid_from <= now() and (o.valid_to is null or o.valid_to > now()));
  if v_alone is not null then
    delete from app.team t where t.id = any (v_alone);
    delete from app.organisation o where o.id = any (v_orgs) and not exists (select 1 from app.team t where t.org_id = o.id);
  end if;

  -- their address in the invitations that named them
  delete from app.invitation i where i.email = v_email or i.accepted_by = v_uid;
  -- Auth's own record of their sign-ins, where this role may reach it
  if to_regclass('auth.audit_log_entries') is not null then
    begin
      delete from auth.audit_log_entries a where a.payload ->> 'actor_id' = v_uid::text;
    exception when insufficient_privilege then
      null;
    end;
  end if;
  -- and the person: every row that names them goes with them, or loses their name (0002 to 0023)
  delete from auth.users u where u.id = v_uid;
  return jsonb_build_object('ok', true);
end $$;
comment on function app.delete_account() is
  'The caller deletes their account and everything that names them; a group they are alone in goes too. The only leader of a group with others names another first.';

-- ---------------------------------------------------------------- the audit trail: 24 months, unchanged
-- Nobody changes an audited event. A person's removal may clear its actor (on delete set null); a row goes only
-- when it is 24 months old, or with its organisation.
create function app.audit_event_fixed() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.id, old.org_id, old.kind, old.at, old.detail) is distinct from (new.id, new.org_id, new.kind, new.at, new.detail)
       or (new.actor is not null and new.actor is distinct from old.actor) then
      raise exception 'an audited event never changes' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.at > now() - interval '24 months'
     and exists (select 1 from app.organisation o where o.id = old.org_id) then
    raise exception 'an audited event is kept 24 months' using errcode = 'check_violation';
  end if;
  return old;
end $$;
create trigger audit_event_fixed before update or delete on app.audit_event for each row execute function app.audit_event_fixed();

-- "Consent given" (handoff 8, Audit): the one consent the MVP asks for is the Leader Profile's, given when a test
-- is saved, a retake included. The event names the person who gave it and the test, never a score.
create function app.profile_consent_audit() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.taken_at is distinct from old.taken_at or new.test_id is distinct from old.test_id then
    insert into app.audit_event (org_id, kind, actor, detail)
    values (null, 'consent_given', new.person_id,
            jsonb_build_object('consent', 'leader_profile', 'test', (select t.key from app.profile_test t where t.id = new.test_id)));
  end if;
  return new;
end $$;
create trigger profile_consent_audit after insert or update on app.personality_profile
  for each row execute function app.profile_consent_audit();

create function app.prune_audit() returns int
  language sql volatile security definer set search_path = ''
as $$
  with gone as (delete from app.audit_event a where a.at <= now() - interval '24 months' returning 1)
  select count(*)::int from gone
$$;
comment on function app.prune_audit() is 'Removes audited events older than 24 months (handoff 8, Retention). The scheduled job.';

-- ---------------------------------------------------------------- grants and schedule
grant execute on function app.request_export(), app.delete_account() to authenticated;
-- the mailed link works for whoever holds it, signed in or not: the token is the capability
grant execute on function app.download_export(text) to anon, authenticated;
grant execute on function app.expire_exports(), app.prune_audit() to service_role;

do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('leaderpact-expire-exports', '23 * * * *', 'select app.expire_exports()');
    perform cron.schedule('leaderpact-prune-audit', '41 3 * * *', 'select app.prune_audit()');
  end if;
end $$;
