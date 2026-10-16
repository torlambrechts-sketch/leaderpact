-- billing_invariants.sql — plans and checkout (0013; handoff 6.18; milestone 8: "Upgrade carries the group,
-- members and scan over. Grace and read-only states work.").
--
--      1  only a signed-in client may run the billing functions; the access rules are not client entry points
--      2  no client writes a subscription, a checkout or the adapter; only the leader's policy reads a subscription
--      3  a group with no subscription is Free: scan yes, charter no, writable
--      4  only the group's leader may start a checkout; a member and an outsider are refused
--      5  a wrong period, method, company, country, invoice detail or reference is refused, and nothing is written
--      6  with the adapter "none" a checkout starts at the price in force, and can never be paid
--      7  with the development adapter a failed payment leaves the group on Free, audited
--      8  a paid checkout makes the group Team: a year's period, charter allowed, and nothing about the group moved
--      9  a group on Team cannot start a second checkout
--     10  a member reads the plan, not the billing details; the leader reads them; an outsider reads nothing
--     11  a failed renewal gives grace: still writable, with the grace end 7 days on
--     12  when the grace runs out the group is read-only: it reads Team features and writes nothing
--     13  a payment received makes it Team again
--     14  a member may not cancel; the leader's cancel keeps Team to the period's end and sets the deletion date
--     15  a cancel can be withdrawn before it takes effect, and not after; then the group is Free
--     16  a group whose cancel has ended can subscribe again, from a clean row
--     17  audit rows carry ids, a plan, a period and a state only; the development events need that adapter
--     18  a trial: only the leader starts it, for 30 days (0030), with Team features and writable; never a second,
--         and never on a group that has had a plan
--     19  a trial ended unpaid: Free, Team data kept 90 days after the end, no new trial; a checkout still pays
--     20  a failed renewal ends the paid period: a cancel while a payment is owed is Free at once, data kept 90 days
--     21  nothing written by this suite survives, and the adapter is as it was
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/billing_invariants.sql

create unlogged table if not exists public._inv_billing(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_billing;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_team2 uuid := gen_random_uuid();
  v_adapter text := (select adapter from app.payment_adapter);
  v_res jsonb;
  v_res2 jsonb;
  v_txt text;
  v_n int;
  v_m int;
  v_ok boolean;
  v_before text;
  v_after text;
  r record;
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- who may run what
  v_ok := not has_function_privilege('anon', 'app.start_checkout(uuid, text, text, text, text, text, text, text)', 'execute')
          and not has_function_privilege('anon', 'app.get_group_plan(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.complete_checkout(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.start_checkout(uuid, text, text, text, text, text, text, text)', 'execute')
          and has_function_privilege('authenticated', 'app.complete_checkout(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.get_group_plan(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.cancel_subscription(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.withdraw_cancel(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.dev_billing_event(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'app.start_trial(uuid)', 'execute')
          and not has_function_privilege('anon', 'app.start_trial(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.group_access(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.group_writable(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.plan_allows(uuid, text)', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'only a signed-in client may run the billing functions; access rules are internal',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- no client writes
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.subscription'), ('app.checkout'), ('app.payment_adapter'), ('app.trial')) as t (tbl)
  cross join (values ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.tbl, p.priv);
  select count(*) into v_m
  from (values ('anon', 'app.subscription'), ('service_role', 'app.subscription'), ('anon', 'app.checkout'), ('authenticated', 'app.checkout'),
               ('service_role', 'app.checkout'), ('anon', 'app.payment_adapter'), ('authenticated', 'app.payment_adapter'),
               ('anon', 'app.trial'), ('authenticated', 'app.trial'), ('service_role', 'app.trial')) as x (role, tbl)
  where has_table_privilege(x.role, x.tbl, 'select');
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no client writes billing; only authenticated reads a subscription (the leader''s policy)',
    'expected', '0 writes, 0 other reads', 'actual', v_n || ' writes, ' || v_m || ' other reads', 'pass', v_n = 0 and v_m = 0);

  begin
    insert into auth.users (id, email) values
      (v_lead, 'billing-test-lead@example.invalid'), (v_member, 'billing-test-member@example.invalid'), (v_outsider, 'billing-test-out@example.invalid');
    insert into app.person (id, display_name) values (v_lead, 'Billing lead'), (v_member, 'Billing member'), (v_outsider, 'Billing outsider');
    insert into app.organisation (id, name) values (v_org, 'Billing test organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Billing test group');
    insert into app.membership (org_id, team_id, person_id, role) values (v_org, v_team, v_lead, 'leader'), (v_org, v_team, v_member, 'member');
    insert into app.scan_session (org_id, team_id, instrument_version_id, code, member_count, k, window_days, closes_at)
    select v_org, v_team, v.id, 'billingTestScanCode00001', 6, 4, 7, now() + interval '7 days'
    from app.instrument_version v join app.instrument i on i.id = v.instrument_id where i.key = 'scan' and v.status = 'published';
    select concat_ws('|', (select count(*) from app.membership where team_id = v_team), (select string_agg(id::text || phase || answered, ',') from app.scan_session where team_id = v_team),
                     (select name from app.team where id = v_team)) into v_before;

    -- 3 ------------------------------------------------------------ Free by default
    v_txt := concat_ws(',', app.group_access(v_team), app.plan_allows(v_team, 'scan')::text, app.plan_allows(v_team, 'charter')::text, app.group_writable(v_team)::text);
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'no subscription: free; scan yes, charter no; writable',
      'expected', 'free,true,false,true', 'actual', v_txt, 'pass', v_txt = 'free,true,false,true');

    -- 4 ------------------------------------------------------------ only the leader starts a checkout
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.start_checkout(v_team, 'year', 'card', 'Billing AS', null, 'NO', null, null) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := concat_ws(',', v_txt, app.start_checkout(v_team, 'year', 'card', 'Billing AS', null, 'NO', null, null) ->> 'reason');
    perform set_config('request.jwt.claims', '', true);
    v_txt := concat_ws(',', v_txt, app.start_checkout(v_team, 'year', 'card', 'Billing AS', null, 'NO', null, null) ->> 'reason');
    reset role;
    select count(*) into v_n from app.checkout where team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'a member, an outsider and no session: refused, nothing written',
      'expected', 'not_leader,not_leader,signed_out, 0', 'actual', coalesce(v_txt, 'null') || ', ' || v_n, 'pass', v_txt = 'not_leader,not_leader,signed_out' and v_n = 0);

    -- 5 ------------------------------------------------------------ refused details
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',',
      app.start_checkout(v_team, 'week', 'card', 'Billing AS', null, 'NO', null, null) ->> 'reason',
      app.start_checkout(v_team, 'year', 'cash', 'Billing AS', null, 'NO', null, null) ->> 'reason',
      app.start_checkout(v_team, 'year', 'card', '   ', null, 'NO', null, null) ->> 'reason',
      app.start_checkout(v_team, 'year', 'card', 'Billing AS', null, 'no', null, null) ->> 'reason',
      app.start_checkout(v_team, 'year', 'invoice', 'Billing AS', null, 'NO', 'invoice@example.invalid', null) ->> 'reason',
      app.start_checkout(v_team, 'year', 'invoice', 'Billing AS', '923 456 789', 'NO', null, null) ->> 'reason',
      app.start_checkout(v_team, 'year', 'card', 'Billing AS', null, 'NO', 'not-an-address', null) ->> 'reason',
      app.start_checkout(v_team, 'year', 'card', 'Billing AS', null, 'NO', null, repeat('r', 61)) ->> 'reason');
    reset role;
    select count(*) into v_n from app.checkout where team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'week, cash, blank company, "no", invoice without number or email, bad email, long reference: refused',
      'expected', 'invalid x8, 0 written', 'actual', coalesce(v_txt, 'null') || ', ' || v_n || ' written',
      'pass', v_txt = 'invalid,invalid,invalid,invalid,invalid,invalid,invalid,invalid' and v_n = 0);

    -- 6 ------------------------------------------------------------ adapter none: started, never paid
    update app.payment_adapter set adapter = 'none';
    set local role authenticated;
    v_res := app.start_checkout(v_team, 'year', 'invoice', ' Billing AS ', '923 456 789', 'NO', 'Invoice@Example.invalid', 'Leadership group');
    v_res2 := app.start_checkout(v_team, 'month', 'card', 'Billing AS', null, 'SE', null, null);
    v_txt := app.complete_checkout((v_res ->> 'checkout')::uuid, 'paid') ->> 'reason';
    reset role;
    select string_agg(concat_ws(':', company_name, invoice_email, status), ',') into v_after from app.checkout where id = (v_res ->> 'checkout')::uuid;
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'adapter none: year USD 180000 and month 18000 start; paying is unavailable; still free',
      'expected', 'USD 180000, 18000, unavailable, free, Billing AS:invoice@example.invalid:open',
      'actual', concat_ws(', ', (v_res ->> 'currency') || ' ' || (v_res ->> 'amount_minor'), v_res2 ->> 'amount_minor', v_txt, app.group_access(v_team), v_after),
      'pass', v_res ->> 'currency' = 'USD' and (v_res ->> 'amount_minor')::bigint = 180000 and (v_res2 ->> 'amount_minor')::bigint = 18000
              and v_txt = 'unavailable' and app.group_access(v_team) = 'free' and v_after = 'Billing AS:invoice@example.invalid:open');

    -- 7 ------------------------------------------------------------ development adapter: a failed payment
    update app.payment_adapter set adapter = 'development';
    set local role authenticated;
    v_res2 := app.complete_checkout((v_res2 ->> 'checkout')::uuid, 'failed');
    reset role;
    select count(*) into v_n from app.audit_event where org_id = v_org and kind = 'payment_failed';
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'a failed payment: not paid, still free, audited',
      'expected', 'false, free, 1', 'actual', concat_ws(', ', v_res2 ->> 'paid', app.group_access(v_team), v_n),
      'pass', (v_res2 ->> 'paid')::boolean = false and app.group_access(v_team) = 'free' and v_n = 1);

    -- 8 ------------------------------------------------------------ paid: Team, and nothing moved
    set local role authenticated;
    v_res2 := app.complete_checkout((v_res ->> 'checkout')::uuid, 'paid');
    reset role;
    select concat_ws('|', (select count(*) from app.membership where team_id = v_team), (select string_agg(id::text || phase || answered, ',') from app.scan_session where team_id = v_team),
                     (select name from app.team where id = v_team)) into v_after;
    select (current_period_end between now() + interval '1 year' - interval '1 minute' and now() + interval '1 year' + interval '1 minute') into v_ok
    from app.subscription where team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'paid: team for a year, charter allowed; members, scan and name unchanged',
      'expected', 'true, team, a year, true, unchanged',
      'actual', concat_ws(', ', v_res2 ->> 'paid', app.group_access(v_team), case when v_ok then 'a year' else 'not a year' end, app.plan_allows(v_team, 'charter')::text,
                          case when v_before = v_after then 'unchanged' else 'changed' end),
      'pass', (v_res2 ->> 'paid')::boolean and app.group_access(v_team) = 'team' and v_ok and app.plan_allows(v_team, 'charter') and v_before = v_after);

    -- 9 ------------------------------------------------------------ no second checkout
    set local role authenticated;
    v_txt := app.start_checkout(v_team, 'year', 'card', 'Billing AS', null, 'NO', null, null) ->> 'reason';
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'a group on Team cannot start a second checkout',
      'expected', 'already', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'already');

    -- 10 ----------------------------------------------------------- who reads what
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    select * into r from app.get_group_plan(v_team);
    select count(*) into v_n from app.subscription;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    select count(*) into v_m from app.subscription;
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    select count(*) into v_txt from app.get_group_plan(v_team);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'a member reads the plan, not the details; the leader reads them; an outsider nothing',
      'expected', 'team/team/year, member 0 rows, leader 1, outsider 0',
      'actual', concat_ws('/', r.plan, r.access, r."interval") || ', member ' || v_n || ' rows, leader ' || v_m || ', outsider ' || v_txt,
      'pass', r.plan = 'team' and r.access = 'team' and r."interval" = 'year' and v_n = 0 and v_m = 1 and v_txt = '0');

    -- 11 ----------------------------------------------------------- a failed renewal: grace
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    set local role authenticated;
    v_res := app.dev_billing_event(v_team, 'payment_failed');
    select * into r from app.get_group_plan(v_team);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a failed renewal: grace, writable, the grace ending 7 days on',
      'expected', 'true, grace, past_due, true, 7 days',
      'actual', concat_ws(', ', v_res ->> 'ok', r.access, r.state, app.group_writable(v_team)::text, extract(day from r.grace_ends_at - (select past_due_since from app.subscription where team_id = v_team)) || ' days'),
      'pass', (v_res ->> 'ok')::boolean and r.access = 'grace' and r.state = 'past_due' and app.group_writable(v_team)
              and r.grace_ends_at = (select past_due_since from app.subscription where team_id = v_team) + interval '7 days');

    -- 12 ----------------------------------------------------------- the grace runs out: read-only
    set local role authenticated;
    v_res := app.dev_billing_event(v_team, 'grace_ended');
    reset role;
    v_txt := concat_ws(',', app.group_access(v_team), app.group_writable(v_team)::text, app.plan_allows(v_team, 'charter')::text);
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'grace over: read_only, not writable, still reads Team features',
      'expected', 'read_only,false,true', 'actual', v_txt, 'pass', (v_res ->> 'ok')::boolean and v_txt = 'read_only,false,true');

    -- 13 ----------------------------------------------------------- payment received
    set local role authenticated;
    v_res := app.dev_billing_event(v_team, 'payment_received');
    reset role;
    v_txt := concat_ws(',', app.group_access(v_team), app.group_writable(v_team)::text, (select state from app.subscription where team_id = v_team));
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'a payment received: team and active again',
      'expected', 'team,true,active', 'actual', v_txt, 'pass', (v_res ->> 'ok')::boolean and v_txt = 'team,true,active');

    -- 14 ----------------------------------------------------------- cancel
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.cancel_subscription(v_team) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res := app.cancel_subscription(v_team);
    reset role;
    select * into r from app.subscription where team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'a member may not cancel; the leader''s cancel keeps Team to the period''s end, deletion 90 days after',
      'expected', 'not_leader, ok, cancelled, team, effective at period end, deletion +90 days',
      'actual', concat_ws(', ', v_txt, case when (v_res ->> 'ok')::boolean then 'ok' else 'refused' end, r.state, app.group_access(v_team),
                          case when r.cancel_effective_at = r.current_period_end then 'effective at period end' else 'elsewhen' end,
                          case when r.deletion_due_at = r.cancel_effective_at + interval '90 days' then 'deletion +90 days' else 'other deletion' end),
      'pass', v_txt = 'not_leader' and (v_res ->> 'ok')::boolean and r.state = 'cancelled' and app.group_access(v_team) = 'team'
              and r.cancel_effective_at = r.current_period_end and r.deletion_due_at = r.cancel_effective_at + interval '90 days');

    -- 15 ----------------------------------------------------------- withdraw, then let it take effect
    set local role authenticated;
    v_res := app.withdraw_cancel(v_team);
    v_res2 := app.cancel_subscription(v_team);
    reset role;
    v_txt := (select state from app.subscription where team_id = v_team);
    update app.subscription set cancel_effective_at = now() - interval '1 minute', current_period_end = now() - interval '1 minute' where team_id = v_team;
    set local role authenticated;
    v_txt := concat_ws(',', v_res ->> 'ok', v_txt, app.withdraw_cancel(v_team) ->> 'reason');
    reset role;
    v_txt := concat_ws(',', v_txt, app.group_access(v_team), app.plan_allows(v_team, 'charter')::text);
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'withdrawn before the end; once ended, no withdraw, and the group is Free',
      'expected', 'true,cancelled,invalid,free,false', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,cancelled,invalid,free,false');

    -- 16 ----------------------------------------------------------- subscribe again
    set local role authenticated;
    v_res := app.start_checkout(v_team, 'month', 'card', 'Billing AS', null, 'DK', null, null);
    v_res2 := app.complete_checkout((v_res ->> 'checkout')::uuid, 'paid');
    reset role;
    select * into r from app.subscription where team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'after an ended cancel: a new checkout, a clean active row',
      'expected', 'true, team, month, card, DK, no cancel dates',
      'actual', concat_ws(', ', v_res2 ->> 'paid', app.group_access(v_team), r.interval, r.method, r.country,
                          case when r.cancelled_at is null and r.cancel_effective_at is null and r.deletion_due_at is null then 'no cancel dates' else 'cancel dates left' end),
      'pass', (v_res2 ->> 'paid')::boolean and app.group_access(v_team) = 'team' and r.interval = 'month' and r.method = 'card' and r.country = 'DK'
              and r.cancelled_at is null and r.cancel_effective_at is null and r.deletion_due_at is null);

    -- 17 ----------------------------------------------------------- audit, and the development events' guard
    select count(*) into v_n from app.audit_event a, jsonb_object_keys(a.detail) k
    where a.org_id = v_org and k not in ('team', 'plan', 'interval', 'state', 'checkout');
    update app.payment_adapter set adapter = 'none';
    set local role authenticated;
    v_txt := concat_ws(',', app.dev_billing_event(v_team, 'payment_failed') ->> 'reason',
                       app.complete_checkout((app.start_checkout(v_team, 'year', 'card', 'Billing AS', null, 'NO', null, null) ->> 'checkout')::uuid, 'paid') ->> 'reason');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'audit carries ids, plan, period and state only; development events need that adapter',
      'expected', '0 other keys, unavailable,unavailable', 'actual', v_n || ' other keys, ' || coalesce(v_txt, 'null'),
      'pass', v_n = 0 and v_txt = 'unavailable,unavailable');

    -- 18 ----------------------------------------------------------- a trial
    insert into app.team (id, org_id, name) values (v_team2, v_org, 'Billing trial group');
    insert into app.membership (org_id, team_id, person_id, role) values (v_org, v_team2, v_lead, 'leader'), (v_org, v_team2, v_member, 'member');
    update app.payment_adapter set adapter = 'development';
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.start_trial(v_team2) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.start_trial(v_team) ->> 'reason');
    v_res := app.start_trial(v_team2);
    v_txt := concat_ws(',', v_txt, case when (v_res ->> 'ok')::boolean then 'ok' else 'refused' end, app.start_trial(v_team2) ->> 'reason');
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    select * into r from app.get_group_plan(v_team2);
    reset role;
    v_txt := concat_ws(',', v_txt, r.plan, r.access, app.plan_allows(v_team2, 'charter')::text, app.group_writable(v_team2)::text, r.trial_available::text,
                       case when r.trial_ends_at = (select started_at from app.trial where team_id = v_team2) + interval '30 days' then '30 days' else 'not 30 days' end);
    v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'a member and a group with a plan are refused; the leader''s trial: Team, writable, 30 days, once',
      'expected', 'not_leader,already,ok,already,team,trial,true,true,false,30 days', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,already,ok,already,team,trial,true,true,false,30 days');

    -- 19 ----------------------------------------------------------- the trial ends unpaid
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    set local role authenticated;
    v_res := app.dev_billing_event(v_team2, 'trial_ended');
    select * into r from app.get_group_plan(v_team2);
    v_txt := app.start_trial(v_team2) ->> 'reason';
    reset role;
    v_txt := concat_ws(',', v_res ->> 'ok', r.access, app.plan_allows(v_team2, 'charter')::text, v_txt,
                       case when r.deletion_due_at = r.trial_ends_at + interval '90 days' then 'kept 90 days' else 'not kept 90 days' end);
    set local role authenticated;
    v_res := app.start_checkout(v_team2, 'year', 'card', 'Billing AS', null, 'NO', null, null);
    v_res2 := app.complete_checkout((v_res ->> 'checkout')::uuid, 'paid');
    select * into r from app.get_group_plan(v_team2);
    reset role;
    v_txt := concat_ws(',', v_txt, v_res2 ->> 'paid', r.access, coalesce(r.trial_ends_at::text, 'no trial end'), coalesce(r.deletion_due_at::text, 'no deletion'));
    v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'an unpaid trial''s end: Free, Team data kept 90 days, no new trial; a checkout then pays',
      'expected', 'true,free,false,trial_used,kept 90 days,true,team,no trial end,no deletion', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,free,false,trial_used,kept 90 days,true,team,no trial end,no deletion');

    -- 20 ----------------------------------------------------------- a cancel while a payment is owed
    set local role authenticated;
    v_res := app.dev_billing_event(v_team2, 'payment_failed');
    v_res2 := app.cancel_subscription(v_team2);
    reset role;
    select * into r from app.subscription where team_id = v_team2;
    v_txt := concat_ws(',', v_res ->> 'ok', v_res2 ->> 'ok', app.group_access(v_team2), app.plan_allows(v_team2, 'charter')::text,
                       case when r.current_period_end <= now() then 'period over' else 'period left' end,
                       case when r.deletion_due_at = r.cancel_effective_at + interval '90 days' and r.cancel_effective_at <= now() then 'kept 90 days from now' else 'other' end);
    v_rows := v_rows || jsonb_build_object('seq', 20, 'name', 'a failed renewal ends the paid period; a cancel while a payment is owed is Free at once, data kept 90 days',
      'expected', 'true,true,free,false,period over,kept 90 days from now', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,true,free,false,period over,kept 90 days from now');

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 21 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'billing-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Billing test organisation';
  select v_n + count(*) into v_n from app.payment_adapter where adapter is distinct from v_adapter;
  v_rows := v_rows || jsonb_build_object('seq', 21, 'name', 'nothing written by this suite survives, and the adapter is as it was',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_billing
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_billing order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_billing;
  if v_failed is not null then
    raise exception 'billing invariants failed: %', v_failed;
  end if;
  if v_count <> 21 then
    raise exception 'billing invariants: expected 21 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_billing;
