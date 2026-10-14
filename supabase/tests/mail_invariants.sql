-- mail_invariants.sql — the outbox and its dispatcher's claim (0022; handoff 6.18 and 8; milestone 16; REUSE 4.8).
--
--      1  the dispatcher's functions are service_role's alone; a person's settings are their own
--      2  no role holds a privilege on the mail tables; the outbox has no column for an address
--      3  an invitation queues one mail; a round queues one mail when it opens, not one per person
--      4  an invitation's mail carries a link of its own, minted at the claim; both links work
--      5  a round's mail goes to the invited members who are still members and have not answered
--      6  50 invitations a group a day: the rest waits for the next day, with no try spent
--      7  a suppressed address gets nothing, a reminder included; an invitation to one is skipped
--      8  sent, or not with a code (a message is never kept), and given up after five tries
--      9  summaries: Monday from 08:00 in the person's zone, once a period, weekly or every four weeks, never off
--     10  a summary says what waits for the person and never who has answered; with nothing to say, none goes
--     11  a person sets how often, and a time zone that exists
--     12  where pg_cron exists, summaries are queued hourly, once
--     13  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/mail_invariants.sql

create unlogged table if not exists public._inv_mail(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_mail;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_p uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_out uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_ver uuid;
  v_round uuid := gen_random_uuid();
  v_res jsonb;
  v_claim jsonb;
  v_c jsonb;
  v_token text;
  v_mail text;
  v_inv uuid;
  v_id uuid;
  v_txt text;
  v_n int;
  v_ok boolean;
  v_monday timestamptz := '2026-10-12 09:30:00+00';
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  select v.id into strict v_ver from app.instrument_version v join app.instrument i on i.id = v.instrument_id
  where i.key = 'diagnostic' and v.status = 'published';

  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.get_notifications()', 'execute')
          and has_function_privilege('authenticated', 'app.set_notifications(text, text)', 'execute')
          and not exists (
            select 1 from unnest(array['anon', 'authenticated']) r,
              unnest(array['app.claim_mail(int)', 'app.finish_mail(uuid, boolean, text)', 'app.suppress_address(text, text)',
                           'app.queue_summaries(timestamptz)', 'app.summary_facts(uuid)', 'app.mail_suppressed(text)', 'app.invitation_for(text)']) f
            where has_function_privilege(r, f, 'execute'))
          and has_function_privilege('service_role', 'app.claim_mail(int)', 'execute')
          and has_function_privilege('service_role', 'app.finish_mail(uuid, boolean, text)', 'execute')
          and has_function_privilege('service_role', 'app.suppress_address(text, text)', 'execute')
          and has_function_privilege('service_role', 'app.queue_summaries(timestamptz)', 'execute')
          and not has_function_privilege('anon', 'app.get_notifications()', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the dispatcher''s functions are service_role''s alone; a person''s settings are their own',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- no privilege; no address in the outbox
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.outbox'), ('app.mail_suppression'), ('app.notification_preference'), ('app.mail_day')) as t (rel)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.rel, p.priv);
  select string_agg(a.attname, ',' order by a.attnum) into v_txt
  from pg_attribute a where a.attrelid = 'app.outbox'::regclass and a.attnum > 0 and not a.attisdropped;
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no role holds a privilege on the mail tables; the outbox has no column for an address',
    'expected', '0 privileges; id,kind,org_id,team_id,person_id,ref_id,due_at,state,lease_until,attempts,last_error,created_at',
    'actual', v_n || ' privileges; ' || v_txt,
    'pass', v_n = 0 and v_txt = 'id,kind,org_id,team_id,person_id,ref_id,due_at,state,lease_until,attempts,last_error,created_at');

  begin
    insert into auth.users (id, email)
    select v_p[g], 'mail-test-' || g || '@example.invalid' from generate_series(1, 5) g;
    insert into auth.users (id, email) values (v_out, 'mail-test-out@example.invalid');
    insert into app.person (id, display_name) select v_p[g], 'Mail person ' || g from generate_series(1, 5) g;
    insert into app.person (id, display_name) values (v_out, 'Mail outsider');
    insert into app.organisation (id, name) values (v_org, 'Mail test organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Mail test group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from)
    select v_org, v_team, v_p[g], case when g = 1 then 'leader' else 'member' end, now() - interval '30 days' from generate_series(1, 5) g;
    insert into app.trial (team_id, org_id, started_at, ends_at) values (v_team, v_org, now() - interval '1 day', now() + interval '13 days');
    -- whatever earlier rows the database holds wait; this suite claims its own
    update app.outbox set due_at = now() + interval '100 years' where state = 'due';

    -- 3 ------------------------------------------------------------ what queues
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_p[1]), true);
    v_res := app.invite_member(v_team, 'mail-test-invitee@example.invalid', 'Mail invitee');
    reset role;
    v_inv := (v_res ->> 'invitation')::uuid;
    insert into app.assessment_round (id, org_id, team_id, kind, instrument_version_id, window_days, opens_at)
    values (v_round, v_org, v_team, 'diagnostic', v_ver, 14, now() - interval '1 minute');
    perform app.open_round(v_round);
    select string_agg(o.kind || ':' || (o.ref_id = case o.kind when 'member_invite' then v_inv else v_round end)::text
                      || ':' || coalesce(o.person_id::text, 'no person'), ' ' order by o.kind)
      into v_txt from app.outbox o where o.team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'an invitation queues one mail; a round queues one mail when it opens, not one per person',
      'expected', 'member_invite:true:no person round_invite:true:no person', 'actual', coalesce(v_txt, 'none'),
      'pass', v_txt = 'member_invite:true:no person round_invite:true:no person');

    -- 4 ------------------------------------------------------------ the invitation's own link
    -- one member answers and one is removed before the round's mail goes (check 5)
    perform set_config('request.jwt.claims', format(claims, v_p[2]), true);
    set local role authenticated;
    perform app.submit_response(v_round, (select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 3))
                                         from app.instrument_version_item vi where vi.instrument_version_id = v_ver));
    perform set_config('request.jwt.claims', format(claims, v_p[1]), true);
    perform app.remove_member(v_team, v_p[3]);
    reset role;
    v_claim := app.claim_mail(10);
    select c into v_c from jsonb_array_elements(v_claim) c where c ->> 'kind' = 'member_invite';
    v_token := substring(v_c #>> '{facts,path}' from '^/join/(.+)$');
    v_mail := v_c ->> 'id';
    v_txt := concat_ws(',', v_c #>> '{to,0,email}', v_c #>> '{to,0,name}', v_c #>> '{facts,group}', v_c #>> '{facts,leader}',
                       (select i.mail_token_hash = sha256(convert_to(v_token, 'UTF8')) from app.invitation i where i.id = v_inv)::text,
                       app.get_invitation(v_token) ->> 'state', app.get_invitation(v_res ->> 'token') ->> 'state',
                       app.invitation_matches(v_token, 'mail-test-invitee@example.invalid')::text);
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'an invitation''s mail carries a link of its own, minted at the claim; both links work',
      'expected', 'mail-test-invitee@example.invalid,Mail invitee,Mail test group,Mail person 1,true,open,open,true', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'mail-test-invitee@example.invalid,Mail invitee,Mail test group,Mail person 1,true,open,open,true');

    -- 5 ------------------------------------------------------------ the round's recipients
    select c into v_c from jsonb_array_elements(v_claim) c where c ->> 'kind' = 'round_invite';
    select string_agg(t ->> 'email', ' ' order by t ->> 'email') into v_txt from jsonb_array_elements(v_c -> 'to') t;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'a round''s mail goes to the invited members who are still members and have not answered',
      'expected', 'mail-test-1@example.invalid mail-test-4@example.invalid mail-test-5@example.invalid; round facts', 'actual', coalesce(v_txt, 'none')
        || case when v_c #>> '{facts,round_kind}' = 'diagnostic' and v_c #>> '{facts,number}' = '1' and v_c #>> '{facts,team}' = v_team::text then '; round facts' else '; no facts' end,
      'pass', v_txt = 'mail-test-1@example.invalid mail-test-4@example.invalid mail-test-5@example.invalid'
              and v_c #>> '{facts,round_kind}' = 'diagnostic' and v_c #>> '{facts,number}' = '1' and v_c #>> '{facts,team}' = v_team::text);

    -- 6 ------------------------------------------------------------ 50 a day
    update app.outbox set state = 'due', lease_until = null, attempts = 0 where team_id = v_team and kind = 'round_invite';
    update app.mail_day set invitations = 48 where team_id = v_team and day = current_date;
    v_claim := app.claim_mail(10);
    select concat_ws(',', jsonb_array_length(v_claim), o.state, (o.due_at = (current_date + 1)::timestamptz)::text, o.attempts,
                     (select invitations from app.mail_day where team_id = v_team and day = current_date))
      into v_txt from app.outbox o where o.team_id = v_team and o.kind = 'round_invite';
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', '50 invitations a group a day: the rest waits for the next day, with no try spent',
      'expected', '0,due,true,0,48', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = '0,due,true,0,48');

    -- 7 ------------------------------------------------------------ suppression
    update app.mail_day set invitations = 0 where team_id = v_team and day = current_date;
    update app.outbox set due_at = now() - interval '1 minute' where team_id = v_team and kind = 'round_invite';
    perform app.suppress_address('MAIL-TEST-4@example.invalid ', 'hard_bounce');
    perform app.suppress_address('mail-test-invitee2@example.invalid', 'spam');
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_p[1]), true);
    perform app.invite_member(v_team, 'mail-test-invitee2@example.invalid', 'Second invitee');
    reset role;
    v_claim := app.claim_mail(10);
    select string_agg(t ->> 'email', ' ' order by t ->> 'email') into v_txt
    from jsonb_array_elements(v_claim) c, jsonb_array_elements(c -> 'to') t where c ->> 'kind' = 'round_invite';
    v_txt := coalesce(v_txt, 'none') || '; ' || (select o.state from app.outbox o join app.invitation i on i.id = o.ref_id
                                                 where o.kind = 'member_invite' and i.email = 'mail-test-invitee2@example.invalid')
             || '; ' || (select count(*) from app.mail_suppression where email_hash = sha256(convert_to('mail-test-4@example.invalid', 'UTF8')));
    -- and a reminder: the same recipients, with what its link and words need
    insert into app.round_reminder (round_id, org_id, day, due_at) values (v_round, v_org, 3, now() - interval '1 minute');
    select c into v_c from jsonb_array_elements(app.claim_reminders(10)) c where c ->> 'round' = v_round::text;
    v_txt := v_txt || '; ' || coalesce((select string_agg(t ->> 'email', ' ' order by t ->> 'email') from jsonb_array_elements(v_c -> 'recipients') t), 'none')
             || '; ' || concat_ws(',', v_c ->> 'round_kind', v_c ->> 'number', (v_c ->> 'team' = v_team::text)::text);
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a suppressed address gets nothing, a reminder included; an invitation to one is skipped',
      'expected', 'mail-test-1@example.invalid mail-test-5@example.invalid; skipped; 1; mail-test-1@example.invalid mail-test-5@example.invalid; diagnostic,1,true',
      'actual', v_txt,
      'pass', v_txt = 'mail-test-1@example.invalid mail-test-5@example.invalid; skipped; 1; mail-test-1@example.invalid mail-test-5@example.invalid; diagnostic,1,true');

    -- 8 ------------------------------------------------------------ finishing
    select (c ->> 'id')::uuid into v_id from jsonb_array_elements(v_claim) c where c ->> 'kind' = 'round_invite';
    v_txt := app.finish_mail(v_id, false, 'http_503');
    v_txt := v_txt || ',' || (select last_error from app.outbox where id = v_id);
    update app.outbox set attempts = 5, state = 'sending', lease_until = now() + interval '1 minute' where id = v_id;
    v_txt := v_txt || ',' || app.finish_mail(v_id, false, 'Refused: mail-test-1@example.invalid is not a mailbox');
    v_txt := v_txt || ',' || (select last_error from app.outbox where id = v_id);
    -- the invitation's mail of check 4, still being sent: reported sent, it stays sent
    v_txt := v_txt || ',' || app.finish_mail(v_mail::uuid, true) || ',' || app.finish_mail(v_mail::uuid, false, 'http_500');
    v_txt := v_txt || ',' || (select state from app.outbox where id = v_mail::uuid);
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'sent, or not with a code (a message is never kept), and given up after five tries',
      'expected', 'due,http_503,failed,unknown,sent,sent,sent', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'due,http_503,failed,unknown,sent,sent,sent');

    -- 9 ------------------------------------------------------------ when summaries queue
    update app.outbox set due_at = now() + interval '100 years' where state = 'due';
    insert into app.notification_preference (person_id, summary, time_zone) values
      (v_p[2], 'monthly', null), (v_p[3], 'weekly', null), (v_p[4], 'off', null), (v_p[5], 'weekly', 'Pacific/Honolulu');
    -- 12 October 2026 is the second Monday: weekly people in UTC, not monthly; Honolulu is still at 23:30 on Sunday
    v_n := app.queue_summaries(v_monday);
    select string_agg(p.display_name, ',' order by p.display_name) into v_txt
    from app.outbox o join app.person p on p.id = o.person_id where o.kind = 'summary' and o.person_id = any (v_p);
    v_txt := v_n || ':' || coalesce(v_txt, 'none') || ' / again ' || app.queue_summaries(v_monday + interval '2 hours')
             || ' / first Monday ' || app.queue_summaries('2026-11-02 09:00:00+00')
             || ' / Sunday ' || app.queue_summaries('2026-11-08 09:00:00+00');
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'summaries: Monday from 08:00 in the person''s zone, once a period, weekly or every four weeks, never off',
      'expected', 'Mail person 1 (no setting: weekly), Mail person 3 now; once; the monthly one on the first Monday', 'actual', v_txt,
      'pass', v_txt like '%:Mail person 1,Mail person 3 / again 0 / first Monday % / Sunday 0'
              and exists (select 1 from app.outbox o where o.kind = 'summary' and o.person_id = v_p[2])
              and not exists (select 1 from app.outbox o where o.kind = 'summary' and o.person_id = v_p[4]));

    -- 10 ----------------------------------------------------------- what a summary says
    update app.outbox set due_at = now() - interval '1 minute' where kind = 'summary' and person_id in (v_p[1], v_p[3]);
    insert into app.action (org_id, team_id, title, owner_id, due_on) values (v_org, v_team, 'Mail test action', v_p[1], current_date + 3);
    v_claim := app.claim_mail(10);
    select c into v_c from jsonb_array_elements(v_claim) c where c ->> 'kind' = 'summary' and c #>> '{to,0,email}' = 'mail-test-1@example.invalid';
    v_txt := concat_ws(',', jsonb_array_length(v_c -> 'facts'), v_c #>> '{facts,0,group}', jsonb_array_length(v_c #> '{facts,0,to_answer}'),
                       v_c #>> '{facts,0,actions,0,title}', coalesce(v_c #>> '{facts,0,meeting}', 'no meeting'),
                       (v_c::text !~ 'mail-test-[2-5]@' and v_c::text !~ 'Mail person [2-5]')::text,
                       (select o.state from app.outbox o where o.kind = 'summary' and o.person_id = v_p[3]));
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'a summary says what waits for the person and never who has answered; with nothing to say, none goes',
      'expected', '1,Mail test group,1,Mail test action,no meeting,true,skipped', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '1,Mail test group,1,Mail test action,no meeting,true,skipped');

    -- 11 ----------------------------------------------------------- a person's own settings
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_out), true);
    v_txt := concat_ws(',', app.set_notifications('daily', null) ->> 'reason', app.set_notifications('weekly', 'Mars/Olympus') ->> 'reason',
                       app.set_notifications('monthly', 'Europe/Oslo') ->> 'ok');
    -- a reader sees its statement's start: the settings are read in a statement of their own
    v_res := app.get_notifications();
    v_txt := concat_ws(',', v_txt, v_res ->> 'summary', v_res ->> 'time_zone', v_res ->> 'email');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a person sets how often, and a time zone that exists',
      'expected', 'invalid,invalid,true,monthly,Europe/Oslo,mail-test-out@example.invalid', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'invalid,invalid,true,monthly,Europe/Oslo,mail-test-out@example.invalid');

    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 12 ------------------------------------------------------------ the schedule
  if to_regclass('cron.job') is null then
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'where pg_cron exists, summaries are queued hourly, once',
      'expected', 'scheduled, or no pg_cron here', 'actual', 'no pg_cron here', 'pass', true);
  else
    execute $q$select count(*) from cron.job where jobname = 'leaderpact-queue-summaries' and command = 'select app.queue_summaries()'$q$ into v_n;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'where pg_cron exists, summaries are queued hourly, once',
      'expected', '1 job', 'actual', v_n || ' job', 'pass', v_n = 1);
  end if;

  -- 13 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'mail-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Mail test organisation';
  select v_n + count(*) into v_n from app.mail_suppression where email_hash = sha256(convert_to('mail-test-4@example.invalid', 'UTF8'));
  v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_mail
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_mail order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_mail;
  if v_failed is not null then
    raise exception 'mail invariants failed: %', v_failed;
  end if;
  if v_count <> 13 then
    raise exception 'mail invariants: expected 13 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_mail;
