-- platform_invariants.sql — the Sentral connection (0025; handoff A.3 and 13; milestone 17; REUSE 6.1). Ported
-- from Orgpuls's platform_api_invariants.sql and platform_resync_invariants.sql at 6f5d441, with REUSE 6.1's checks.
--
--      1  the five platform tables are closed: RLS on, no policy, no grant to any role
--      2  the registry is exactly the fields Sentral reads, and none names an answer, a score, a profile or a respondent
--      3  platform_emit refuses an unlisted field and an unregistered kind; a demo organisation emits nothing
--      4  an organisation, its first scan, its members, an invitation and its plan emit as they change
--      5  the usage tick sends the registered counts only
--      6  delivery waits for an enabled installation; then the claim hands over events and secret; done marks them
--      7  a forged, tampered, unsigned, foreign, expired, too long or incomplete token is refused, with no audit row
--      8  a refused command (unknown, out of scope, a stray argument) leaves its audit row
--      9  a command runs by parameter name, is audited by argument names, and its id cannot be replayed
--     10  a write through the API does what it says, Sentral is told, and its record says it succeeded
--     11  the audit cannot be rewritten or deleted while it is younger than 24 months; then it can go
--     12  deleting an organisation drops what was queued about it and says so once, with nothing in it
--     13  every mapped function is an app.op_* that exists and no role may execute; only platform_command sets the actor
--     14  without a platform actor an operation refuses
--     15  users: the only leader of a group with others stays; a member leaves; an invitation's mail goes again
--     16  orgs.resync says again what the triggers said, and a person deleted takes their queued rows with them
--     17  no trigger on an answer table reaches the event builder
--     18  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block that is
-- rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/platform_invariants.sql

create unlogged table if not exists public._inv_platform(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_platform;

-- a token as Sentral signs it (_shared/signing.ts signJwt): HS256 under the Vault secret, or another key or header
create or replace function pg_temp.b64(p text) returns text language sql as $$
  select rtrim(translate(encode(convert_to(p, 'UTF8'), 'base64'), E'+/\n', '-_'), '=') $$;
create or replace function pg_temp.tok(p_claims jsonb, p_key text default null, p_head text default '{"alg":"HS256","typ":"JWT"}') returns text
  language plpgsql as $$
declare
  h text := pg_temp.b64(p_head);
  p text := pg_temp.b64(p_claims::text);
begin
  return h || '.' || p || '.' ||
    rtrim(translate(encode(extensions.hmac(h || '.' || p, coalesce(p_key, app.platform_secret('token')), 'sha256'), 'base64'), E'+/\n', '-_'), '=');
end $$;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_org uuid := '00000000-0000-4000-8000-00000000f251';
  v_team uuid := '00000000-0000-4000-8000-00000000f252';
  v_team2 uuid := '00000000-0000-4000-8000-00000000f253';
  v_lead uuid := '00000000-0000-4000-8000-00000000f254';
  v_mem uuid := '00000000-0000-4000-8000-00000000f255';
  v_gone uuid := '00000000-0000-4000-8000-00000000f256';
  v_demo uuid := '00000000-0000-4000-8000-00000000f257';
  v_inv uuid := '00000000-0000-4000-8000-00000000f258';
  v_ver uuid;
  v_now bigint := extract(epoch from now())::bigint;
  ok_claims jsonb;
  v_json jsonb;
  v_txt text;
  v_n int;
  v_ok boolean;
  v_before int;
  v_bad text;
begin
  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'scan' and v.status = 'published' order by v.version desc limit 1;

  -- 1 -------------------------------------------------------------- closed
  select count(*) filter (where c.relrowsecurity)::text
         || ',' || (select count(*) from pg_policies p where p.schemaname = 'app' and p.tablename = any (array['platform_events', 'platform_event_kinds',
                    'platform_commands', 'platform_command_map', 'platform_installation']))
         || ',' || (select count(*) from information_schema.role_table_grants g
                    where g.table_schema = 'app' and g.grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
                      and g.table_name in ('platform_events', 'platform_event_kinds', 'platform_commands', 'platform_command_map', 'platform_installation'))
    into v_txt
  from pg_class c where c.relnamespace = 'app'::regnamespace
    and c.relname in ('platform_events', 'platform_event_kinds', 'platform_commands', 'platform_command_map', 'platform_installation');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the five platform tables are closed: RLS on, no policy, no grant to any role',
    'expected', '5,0,0', 'actual', v_txt, 'pass', v_txt = '5,0,0');

  -- 2 -------------------------------------------------------------- the registry, exactly
  select string_agg(k.kind || '=' || array_to_string(k.fields, '+'), ' ' order by k.kind) into v_txt from app.platform_event_kinds k;
  select coalesce(string_agg(k.kind || ':' || f, ','), 'none') into v_bad
  from app.platform_event_kinds k cross join unnest(k.fields) f
  where f ~* '(answer|comment|respon|score|standing|profile|result|level|agreement|participa|process|free_text|phone|token|value|trait|band)';
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'the registry is exactly the fields Sentral reads, and none names an answer, a score, a profile or a respondent',
    'expected', 'billing.changed=plan+billing_interval+trial_started_at+trial_ends_at+confirmed_at+free_from+cancelled_at+cancel_effective_at+deletion_due_at+price+currency+seats+payment_state'
                || ' member.invited=invitation_id+role member.joined=user_id+role+email+name member.left=user_id org.created=name+group_size+created_at org.deleted='
                || ' usage.daily=members+groups+rounds_started+meetings_held+last_sign_in_on; none',
    'actual', v_txt || '; ' || v_bad,
    'pass', v_txt = 'billing.changed=plan+billing_interval+trial_started_at+trial_ends_at+confirmed_at+free_from+cancelled_at+cancel_effective_at+deletion_due_at+price+currency+seats+payment_state'
                || ' member.invited=invitation_id+role member.joined=user_id+role+email+name member.left=user_id org.created=name+group_size+created_at org.deleted='
                || ' usage.daily=members+groups+rounds_started+meetings_held+last_sign_in_on'
            and v_bad = 'none');

  begin
    -- 3 ------------------------------------------------------------ the registry decides; a demo is nobody's customer
    begin
      perform app.platform_emit('org.created', null, '{"name": "X", "score": 4}'::jsonb);
      v_txt := 'written';
    exception when invalid_parameter_value then
      v_txt := 'refused';
    end;
    begin
      perform app.platform_emit('answers.exported', null, '{}'::jsonb);
      v_txt := v_txt || ',written';
    exception when invalid_parameter_value then
      v_txt := v_txt || ',refused';
    end;
    insert into app.organisation (id, name, is_demo) values (v_demo, 'Platform demo organisation', true);
    v_txt := v_txt || ',' || (select count(*) from app.platform_events e where e.org_id = v_demo);
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'platform_emit refuses an unlisted field and an unregistered kind; a demo organisation emits nothing',
      'expected', 'refused,refused,0', 'actual', v_txt, 'pass', v_txt = 'refused,refused,0');

    -- 4 ------------------------------------------------------------ what emits
    insert into auth.users (id, email) values (v_lead, 'platform-test-lead@example.invalid'), (v_mem, 'platform-test-member@example.invalid'),
                                              (v_gone, 'platform-test-gone@example.invalid');
    insert into app.person (id, display_name) values (v_lead, 'Platform lead'), (v_mem, 'Platform member'), (v_gone, 'Platform gone');
    insert into app.organisation (id, name) values (v_org, 'Platform test organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Platform test group'), (v_team2, v_org, 'Platform second group');
    insert into app.scan_session (org_id, team_id, instrument_version_id, code, member_count, k, window_days, opens_at, closes_at)
    values (v_org, v_team, v_ver, 'platformTestScanCode00001', 6, 4, 7, now(), now() + interval '7 days');
    insert into app.membership (org_id, team_id, person_id, role, valid_from) values
      (v_org, v_team, v_lead, 'leader', now() - interval '1 day'), (v_org, v_team, v_mem, 'member', now() - interval '1 day'),
      (v_org, v_team, v_gone, 'member', now() - interval '1 day'), (v_org, v_team2, v_lead, 'leader', now() - interval '1 day');
    insert into app.invitation (id, org_id, team_id, email, display_name, token_hash, created_by, expires_at)
    values (v_inv, v_org, v_team, 'platform-test-invitee@example.invalid', 'Platform invitee', sha256('platform-test-token'::bytea), v_lead, now() + interval '7 days');
    insert into app.trial (team_id, org_id, ends_at) values (v_team, v_org, now() + interval '14 days');
    select string_agg(e.kind || coalesce(':' || coalesce(e.payload ->> 'group_size', e.payload ->> 'role', e.payload ->> 'plan'), ''), ',' order by e.id)
      into v_txt from app.platform_events e where e.org_id = v_org;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'an organisation, its first scan, its members, an invitation and its plan emit as they change',
      'expected', 'org.created,org.created:6,member.joined:leader,member.joined:member,member.joined:member,member.joined:leader,member.invited:member,billing.changed:trial',
      'actual', v_txt,
      'pass', v_txt = 'org.created,org.created:6,member.joined:leader,member.joined:member,member.joined:member,member.joined:leader,member.invited:member,billing.changed:trial');

    -- 5 ------------------------------------------------------------ usage
    perform app.platform_usage_tick();
    select string_agg(k || '=' || (e.payload ->> k), ',' order by k) into v_txt
    from app.platform_events e cross join jsonb_object_keys(e.payload) k where e.org_id = v_org and e.kind = 'usage.daily';
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'the usage tick sends the registered counts only',
      'expected', 'groups=2,meetings_held=0,members=3,rounds_started=0', 'actual', coalesce(v_txt, 'none'),
      'pass', v_txt = 'groups=2,meetings_held=0,members=3,rounds_started=0');

    -- 6 ------------------------------------------------------------ delivery
    update app.platform_installation set enabled = false, webhook_url = null;
    v_json := app.platform_events_claim(50);
    v_txt := coalesce(v_json ->> 'url', 'null') || ',' || jsonb_array_length(v_json -> 'events');
    update app.platform_installation set webhook_url = 'https://sentral.example/functions/v1/product-events', enabled = true;
    v_json := app.platform_events_claim(200);
    select count(*) into v_n from jsonb_array_elements(v_json -> 'events') x where (x ->> 'org_id')::uuid = v_org;
    v_txt := v_txt || ',' || (v_json ->> 'url') || ',' || (v_json ->> 'secret' = app.platform_secret('webhook'))::text || ',' || (v_n > 0)::text
          || ',' || coalesce((select bool_and((x ->> 'id') ~ '^\d{1,18}$') from jsonb_array_elements(v_json -> 'events') x), false)::text;
    perform app.platform_events_done(array(select (x ->> 'id')::bigint from jsonb_array_elements(v_json -> 'events') x), true);
    v_txt := v_txt || ',' || (select count(*) from app.platform_events e where e.org_id = v_org and e.delivered_at is null);
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'delivery waits for an enabled installation; then the claim hands over events and secret; done marks them',
      'expected', 'null,0,https://sentral.example/functions/v1/product-events,true,true,true,0', 'actual', v_txt,
      'pass', v_txt = 'null,0,https://sentral.example/functions/v1/product-events,true,true,true,0');

    -- 7 ------------------------------------------------------------ the token
    ok_claims := jsonb_build_object('aud', 'leaderpact', 'sub', 'tor@sentral', 'scope', 'orgs:read billing:write users:write',
                                    'iat', v_now, 'exp', v_now + 120);
    select count(*) into v_before from app.platform_commands;
    v_txt := concat_ws(',',
      public.platform_command('nonsense', 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-wrongkey1"}', 'not-the-secret-not-the-secret-0000'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(regexp_replace(pg_temp.tok(ok_claims || '{"jti": "t-tampered1"}'), '^([^.]+)\.[^.]+\.', '\1.' || pg_temp.b64((ok_claims || '{"jti": "t-tampered1", "sub": "mallory"}')::text) || '.'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.b64('{"alg":"none","typ":"JWT"}') || '.' || pg_temp.b64((ok_claims || '{"jti": "t-algnone1"}')::text) || '.', 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-algnone2"}', null, '{"alg":"none","typ":"JWT"}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok((ok_claims - 'aud') || '{"jti": "t-noaud001"}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok((ok_claims - 'exp') || '{"jti": "t-noexp001"}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok((ok_claims - 'iat') || '{"jti": "t-noiat001"}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || jsonb_build_object('jti', 't-strexp1', 'exp', (v_now + 60)::text)), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || jsonb_build_object('jti', 't-future1', 'iat', v_now + 120, 'exp', v_now + 180)), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || jsonb_build_object('jti', 't-toolong1', 'exp', v_now + 3600)), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-foreign1", "aud": "orgpuls"}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-expired1", "iat": 1, "exp": 2}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "short"}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error',
      public.platform_command(pg_temp.tok((ok_claims - 'sub') || '{"jti": "t-nosub001"}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error');
    v_txt := v_txt || '; ' || ((select count(*) from app.platform_commands) - v_before) || ' audit rows';
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a forged, tampered, unsigned, foreign, expired, too long or incomplete token is refused, with no audit row',
      'expected', 'unauthorized x15; 0 audit rows', 'actual', v_txt,
      'pass', v_txt = array_to_string(array_fill('unauthorized'::text, array[15]), ',') || '; 0 audit rows');

    -- 8 ------------------------------------------------------------ a refusal leaves its row
    v_txt := concat_ws(',',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-unknown1"}'), 'answers.export', '{}') ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-scope001"}'), 'modules.set_status', '{"p_key": "scan", "p_version": 1, "p_status": "retired"}') ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-strayarg"}'), 'orgs.get', jsonb_build_object('p_org', v_org, 'p_answers', true)) ->> 'error',
      public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-notobj01"}'), 'orgs.get', '[1]'::jsonb) ->> 'error');
    select v_txt || '; ' || string_agg(c.jti || ':' || c.ok::text || ':' || c.error, ',' order by c.id) into v_txt
    from app.platform_commands c where c.jti in ('t-unknown1', 't-scope001', 't-strayarg', 't-notobj01');
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'a refused command (unknown, out of scope, a stray argument) leaves its audit row',
      'expected', 'unknown_command,scope,invalid_args,invalid_args; t-unknown1:false:unknown_command,t-scope001:false:scope,t-strayarg:false:invalid_args,t-notobj01:false:invalid_args',
      'actual', v_txt,
      'pass', v_txt = 'unknown_command,scope,invalid_args,invalid_args; t-unknown1:false:unknown_command,t-scope001:false:scope,t-strayarg:false:invalid_args,t-notobj01:false:invalid_args');

    -- 9 ------------------------------------------------------------ by name, audited, once
    v_json := public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-get-0001"}'), 'orgs.get', jsonb_build_object('p_org', v_org));
    v_txt := (v_json ->> 'ok') || ',' || (v_json #>> '{result,name}') || ',' || jsonb_array_length(v_json #> '{result,groups}') || ','
          || jsonb_array_length(v_json #> '{result,members}') || ',' || (v_json #>> '{result,billing,plan}');
    v_txt := v_txt || ',' || (public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-get-0001"}'), 'orgs.get', jsonb_build_object('p_org', v_org)) ->> 'error');
    select v_txt || ',' || c.actor || ',' || array_to_string(c.arg_names, '+') || ',' || c.ok into v_txt
    from app.platform_commands c where c.jti = 't-get-0001';
    -- what orgs.get carries: no round and no person's sign-in time (E4); the organisation's own counts only
    v_txt := v_txt || ',' || ((v_json #> '{result,members}')::text !~* 'sign_in'
                              and v_json::text !~* '(closes_at|opens_at|answered|score|"rounds"|participa)')::text;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'a command runs by parameter name, is audited by argument names, and its id cannot be replayed',
      'expected', 'true,Platform test organisation,2,3,trial,replay,tor@sentral,p_org,true,true', 'actual', v_txt,
      'pass', v_txt = 'true,Platform test organisation,2,3,trial,replay,tor@sentral,p_org,true,true');

    -- 10 ----------------------------------------------------------- a write
    insert into app.subscription (team_id, org_id, plan_key, interval, currency, amount_minor, price_version, method, state,
                                  current_period_end, company_name, country, provider)
    values (v_team2, v_org, 'team', 'year', 'USD', 180000, 1, 'card', 'active', now() + interval '200 days', 'Platform AS', 'NO', 'development');
    v_json := public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-cancel01"}'), 'billing.cancel', jsonb_build_object('p_team', v_team2));
    select concat_ws(',', v_json ->> 'ok', s.state, (s.cancel_effective_at = s.current_period_end)::text,
                     (select c.ok::text from app.platform_commands c where c.jti = 't-cancel01'),
                     (select e.payload ->> 'plan' || ':' || (e.payload ->> 'seats') || ':' || (e.payload ->> 'price') || ':' || (e.payload ->> 'currency') || ':'
                             || (e.payload ->> 'billing_interval') || ':' || (e.payload ? 'cancel_effective_at')::text
                      from app.platform_events e where e.org_id = v_org and e.kind = 'billing.changed' order by e.id desc limit 1),
                     (select a.kind || ':' || (a.detail ->> 'by') from app.audit_event a where a.org_id = v_org and a.kind = 'plan_changed' order by a.id desc limit 1))
      into v_txt
    from app.subscription s where s.team_id = v_team2;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'a write through the API does what it says, Sentral is told, and its record says it succeeded',
      'expected', 'true,cancelled,true,true,team:1:1800.00:USD:year:true,plan_changed:platform', 'actual', v_txt,
      'pass', v_txt = 'true,cancelled,true,true,team:1:1800.00:USD:year:true,plan_changed:platform');

    -- 11 ----------------------------------------------------------- the audit is fixed for 24 months
    begin
      update app.platform_commands set actor = 'someone else' where jti = 't-get-0001';
      v_txt := 'changed';
    exception when restrict_violation then
      v_txt := 'refused';
    end;
    begin
      delete from app.platform_commands where jti = 't-get-0001';
      v_txt := v_txt || ',deleted';
    exception when restrict_violation then
      v_txt := v_txt || ',kept';
    end;
    insert into app.platform_commands (at, jti, actor, command, scope, arg_names, ok) values (now() - interval '25 months', 't-old-0001', 'old@sentral', 'orgs.list', 'orgs:read', '{}', true);
    delete from app.platform_commands where jti = 't-old-0001';
    get diagnostics v_n = row_count;
    v_txt := v_txt || ',' || v_n;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'the audit cannot be rewritten or deleted while it is younger than 24 months; then it can go',
      'expected', 'refused,kept,1', 'actual', v_txt, 'pass', v_txt = 'refused,kept,1');

    -- 15 ----------------------------------------------------------- users
    -- one statement each: a statement reads the snapshot it started with
    v_txt := public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-deact001"}'), 'users.deactivate', jsonb_build_object('p_org', v_org, 'p_user', v_lead)) #>> '{result,reason}';
    v_txt := v_txt || ',' || (public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-deact002"}'), 'users.deactivate', jsonb_build_object('p_org', v_org, 'p_user', v_mem)) #>> '{result,ok}');
    v_txt := v_txt || ',' || (select count(*) from app.membership m where m.person_id = v_mem and m.valid_to is null);
    v_txt := v_txt || ',' || (select e.kind from app.platform_events e where e.org_id = v_org and e.payload ->> 'user_id' = v_mem::text order by e.id desc limit 1);
    v_txt := v_txt || ',' || (public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-resend01"}'), 'users.resend_invite', jsonb_build_object('p_invitation', v_inv)) #>> '{result,ok}');
    v_txt := v_txt || ',' || (select count(*) from app.outbox o where o.kind = 'member_invite' and o.ref_id = v_inv);
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'users: the only leader of a group with others stays; a member leaves; an invitation''s mail goes again',
      'expected', 'sole_leader,true,0,member.left,true,2', 'actual', v_txt, 'pass', v_txt = 'sole_leader,true,0,member.left,true,2');

    -- 16 ----------------------------------------------------------- resync; a person deleted
    select count(*) into v_before from app.platform_events e where e.org_id = v_org;
    v_json := public.platform_command(pg_temp.tok(ok_claims || '{"jti": "t-resync01"}'), 'orgs.resync', jsonb_build_object('p_org', v_org));
    select string_agg(e.kind, ',' order by e.id) into v_txt from app.platform_events e where e.org_id = v_org and e.id > (
      select max(x.id) from app.platform_events x where x.org_id = v_org) - (v_json ->> 'result')::int;
    v_txt := (v_json ->> 'result') || ':' || v_txt;
    delete from auth.users where id = v_gone;
    v_txt := v_txt || '; ' || (select string_agg(e.kind, ',') from app.platform_events e where e.payload ->> 'user_id' = v_gone::text);
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'orgs.resync says again what the triggers said, and a person deleted takes their queued rows with them',
      'expected', '5:org.created,billing.changed,member.joined,member.joined,usage.daily; member.left', 'actual', v_txt,
      'pass', v_txt = '5:org.created,billing.changed,member.joined,member.joined,usage.daily; member.left');

    -- 14 ----------------------------------------------------------- an operation answers to the platform alone
    perform set_config('app.platform_actor', '', true);
    begin
      perform app.op_org_get(v_org);
      v_txt := 'ran';
    exception when insufficient_privilege then
      v_txt := 'refused';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'without a platform actor an operation refuses',
      'expected', 'refused', 'actual', v_txt, 'pass', v_txt = 'refused');

    -- 12 ----------------------------------------------------------- a deletion
    delete from app.organisation where id = v_org;
    select coalesce(string_agg(e.kind || ':' || e.payload::text, ','), 'none') into v_txt from app.platform_events e where e.org_id = v_org;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'deleting an organisation drops what was queued about it and says so once, with nothing in it',
      'expected', 'org.deleted:{}', 'actual', v_txt, 'pass', v_txt = 'org.deleted:{}');

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  perform set_config('app.platform_actor', '', true);

  -- 13 ------------------------------------------------------------- the operations are closed
  select count(*)::text || ',' || count(*) filter (where to_regprocedure(m.fn) is null)
         || ',' || count(*) filter (where to_regprocedure(m.fn) is not null
                                      and (has_function_privilege('anon', to_regprocedure(m.fn), 'execute')
                                           or has_function_privilege('authenticated', to_regprocedure(m.fn), 'execute')
                                           or has_function_privilege('service_role', to_regprocedure(m.fn), 'execute')))
         || ',' || count(*) filter (where m.fn not like 'app.op\_%')
    into v_txt from app.platform_command_map m;
  select v_txt || ',' || coalesce(string_agg(p.oid::regprocedure::text, '+' order by p.oid::regprocedure::text), 'none') into v_txt
  from pg_proc p where p.prosrc ~ 'set_config\(\s*''app\.platform_actor''' and p.pronamespace in ('app'::regnamespace, 'public'::regnamespace);
  v_ok := has_function_privilege('anon', 'public.platform_command(text,text,jsonb)', 'execute')
          and not exists (select 1 from unnest(array['app.platform_emit(text,uuid,jsonb)', 'app.platform_jwt_claims(text)', 'app.platform_secret(text)',
                                                     'app.platform_hand_over(text,boolean)', 'app.platform_set_webhook_secret(text)', 'app.platform_events_claim(integer)',
                                                     'app.platform_events_done(bigint[],boolean,text)', 'app.dispatch_authorised(text)', 'app.platform_usage_tick()']) f,
                                 unnest(array['anon', 'authenticated']) r
                          where has_function_privilege(r, f, 'execute'))
          and not has_function_privilege('service_role', 'app.platform_secret(text)', 'execute')
          and not has_function_privilege('service_role', 'app.platform_hand_over(text,boolean)', 'execute')
          and has_function_privilege('service_role', 'app.platform_events_claim(integer)', 'execute');
  v_txt := v_txt || ',' || v_ok::text;
  v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'every mapped function is an app.op_* that exists and no role may execute; only platform_command sets the actor',
    'expected', '11,0,0,0,platform_command(text,text,jsonb),true', 'actual', v_txt,
    'pass', v_txt = '11,0,0,0,platform_command(text,text,jsonb),true');

  -- 17 ------------------------------------------------------------- no answer table emits
  select coalesce(string_agg(c.relname || ':' || t.tgname, ','), 'none') into v_txt
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal and c.relnamespace = 'app'::regnamespace
    and c.relname in ('response', 'response_set', 'scan_response', 'scan_response_set', 'scan_replace_key', 'participation',
                      'factor_score', 'item_score', 'scan_theme_score', 'agreement_response', 'agreement_score')
    and p.prosrc ~* 'platform_(emit|member_state)';
  v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'no trigger on an answer table reaches the event builder',
    'expected', 'none', 'actual', v_txt, 'pass', v_txt = 'none');

  -- 18 ------------------------------------------------------------- nothing survives
  select (select count(*) from app.organisation where id in (v_org, v_demo)) + (select count(*) from auth.users where email like 'platform-test-%@example.invalid')
         + (select count(*) from app.platform_commands where jti like 't-%') + (select count(*) from app.platform_events where org_id = v_org)
    into v_n;
  select v_n + count(*) into v_n from app.platform_installation where enabled;
  v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_platform
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_platform order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_platform;
  if v_failed is not null then
    raise exception 'platform invariants failed: %', v_failed;
  end if;
  if v_count <> 18 then
    raise exception 'platform invariants: expected 18 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_platform;
