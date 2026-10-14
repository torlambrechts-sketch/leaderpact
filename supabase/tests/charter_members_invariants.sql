-- charter_members_invariants.sql — the group's charter with versions, and its members (0014; handoff 6.8;
-- milestone 9: "A draft does not change the version in force until the group agrees").
--
--      1  the client functions are granted as reviewed; the access rules are internal
--      2  no role holds any privilege on the charter's tables or the invitations
--      3  on the Free plan nobody writes a charter or an invitation
--      4  a member may not save, discard or agree; an outsider reads nothing
--      5  a draft with a long purpose, too many tasks, a wrong right, a blank title or a non-text agreement is refused
--      6  the leader's draft is stored, nothing is in force, and the members read the draft
--      7  a draft without all three parts cannot be agreed; agreed, it is version 1, its rows written, audited with ids
--      8  a new draft does not change the version in force, for the leader or a member
--      9  agreed, it is version 2; version 1 is superseded and still readable as it was
--     10  an agreed version, its tasks and its agreements never change, and never move back
--     11  a discarded draft keeps its row and leaves the version in force; a second discard finds no draft
--     12  every client function that writes a charter or an invitation asks team_plan_writable
--     13  a member may not invite; a wrong address or name is refused; the leader's invitation keeps only the hash
--     14  the link's page shows the group, the name and the state; never the address, nor the group's id to an outsider
--     15  an existing member's address is refused; a second invitation replaces the first, with a new link
--     16  the group holds 15, invitations counted
--     17  another address cannot accept; the invitee joins once, named as invited; the link is then used
--     18  an expired or revoked invitation cannot be accepted; a member may not revoke
--     19  the only leader cannot be removed; a removed member loses access at once and the row stays
--     20  the leader names another leader and stays a member; each membership keeps its dates
--     21  read-only: no charter or invitation is written, a member can still be removed
--     22  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/charter_members_invariants.sql

create unlogged table if not exists public._inv_charter(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_charter;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_invitee uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_free uuid := gen_random_uuid();
  v_res jsonb;
  v_res2 jsonb;
  v_c jsonb;
  v_txt text;
  v_token text;
  v_token2 text;
  v_inv uuid;
  v_n int;
  v_m int;
  v_ok boolean;
  v_tasks constant jsonb := '[{"title": " Set strategy and yearly priorities ", "right": "decide"}, {"title": "Coordinate the units", "right": "advise"}]';
  v_agreements constant jsonb := '["We send pre-reads 48 hours before.", " Decisions get an owner. "]';
  claims constant text := '{"sub": "%s", "role": "authenticated"}';
begin
  -- 1 -------------------------------------------------------------- grants
  v_ok := has_function_privilege('authenticated', 'app.get_charter(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.get_charter_version(uuid, int)', 'execute')
          and has_function_privilege('authenticated', 'app.save_charter_draft(uuid, text, jsonb, jsonb)', 'execute')
          and has_function_privilege('authenticated', 'app.discard_charter_draft(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.agree_charter(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.get_group_members(uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.invite_member(uuid, text, text)', 'execute')
          and has_function_privilege('authenticated', 'app.accept_invitation(text)', 'execute')
          and has_function_privilege('authenticated', 'app.revoke_invitation(uuid, uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.remove_member(uuid, uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.set_group_leader(uuid, uuid)', 'execute')
          and has_function_privilege('anon', 'app.get_invitation(text)', 'execute')
          and has_function_privilege('anon', 'app.invitation_matches(text, text)', 'execute')
          and not has_function_privilege('anon', 'app.accept_invitation(text)', 'execute')
          and not has_function_privilege('anon', 'app.invite_member(uuid, text, text)', 'execute')
          and not has_function_privilege('anon', 'app.get_charter(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.team_plan_writable(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'app.charter_version_json(uuid)', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'the client functions are granted as reviewed; the access rules are internal',
    'expected', 'as expected', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  -- 2 -------------------------------------------------------------- no table privileges
  select count(*) into v_n
  from (values ('anon'), ('authenticated'), ('service_role')) as g (role)
  cross join (values ('app.charter_template'), ('app.charter_version'), ('app.team_task'), ('app.working_agreement'), ('app.invitation')) as t (tbl)
  cross join (values ('select'), ('insert'), ('update'), ('delete')) as p (priv)
  where has_table_privilege(g.role, t.tbl, p.priv);
  v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no role holds a privilege on the charter''s tables or the invitations',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  begin
    insert into auth.users (id, email) values
      (v_lead, 'charter-test-lead@example.invalid'), (v_member, 'charter-test-member@example.invalid'),
      (v_outsider, 'charter-test-out@example.invalid'), (v_invitee, 'charter-test-invitee@example.invalid');
    insert into app.person (id, display_name) values (v_lead, 'Charter lead'), (v_member, 'Charter member'), (v_outsider, 'Charter outsider');
    insert into app.organisation (id, name) values (v_org, 'Charter test organisation');
    insert into app.team (id, org_id, name) values (v_team, v_org, 'Charter test group'), (v_free, v_org, 'Charter free group');
    insert into app.membership (org_id, team_id, person_id, role, valid_from) values
      (v_org, v_team, v_lead, 'leader', now() - interval '30 days'), (v_org, v_team, v_member, 'member', now() - interval '20 days'),
      (v_org, v_free, v_lead, 'leader', now() - interval '30 days');
    -- the group on its trial: the Team plan, writable (0013)
    insert into app.trial (team_id, org_id, started_at, ends_at) values (v_team, v_org, now() - interval '1 day', now() + interval '13 days');

    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);

    -- 3 ------------------------------------------------------------ Free: nothing written
    v_txt := concat_ws(',', app.save_charter_draft(v_free, 'Purpose', v_tasks, v_agreements) ->> 'reason',
                       app.invite_member(v_free, 'someone@example.invalid', 'Someone') ->> 'reason',
                       (app.get_charter(v_free) ->> 'can_edit'), (app.get_group_members(v_free) ->> 'can_invite'));
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'on the Free plan nobody writes a charter or an invitation',
      'expected', 'unavailable,unavailable,false,false', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'unavailable,unavailable,false,false');

    -- 4 ------------------------------------------------------------ a member and an outsider
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := concat_ws(',', app.save_charter_draft(v_team, 'Purpose', v_tasks, v_agreements) ->> 'reason',
                       app.discard_charter_draft(v_team) ->> 'reason', app.agree_charter(v_team) ->> 'reason',
                       app.get_charter(v_team) ->> 'can_edit');
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := concat_ws(',', v_txt, coalesce(app.get_charter(v_team)::text, 'nothing'), coalesce(app.get_group_members(v_team)::text, 'nothing'),
                       coalesce(app.get_charter_version(v_team, 1)::text, 'nothing'));
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'a member may not save, discard or agree; an outsider reads nothing',
      'expected', 'not_leader,not_leader,not_leader,false,nothing,nothing,nothing', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'not_leader,not_leader,not_leader,false,nothing,nothing,nothing');

    -- 5 ------------------------------------------------------------ refused drafts
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',',
      app.save_charter_draft(v_team, repeat('p', 601), v_tasks, v_agreements) ->> 'reason',
      app.save_charter_draft(v_team, 'Purpose', (select jsonb_agg(jsonb_build_object('title', 'Task ' || n, 'right', 'decide')) from generate_series(1, 13) n), v_agreements) ->> 'reason',
      app.save_charter_draft(v_team, 'Purpose', '[{"title": "Task", "right": "veto"}]', v_agreements) ->> 'reason',
      app.save_charter_draft(v_team, 'Purpose', '[{"title": "   ", "right": "decide"}]', v_agreements) ->> 'reason',
      app.save_charter_draft(v_team, 'Purpose', v_tasks, '[3]') ->> 'reason',
      app.save_charter_draft(v_team, 'Purpose', '{"title": "Task"}', v_agreements) ->> 'reason');
    reset role;
    select count(*) into v_n from app.charter_version where team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'a long purpose, 13 tasks, a wrong right, a blank title, a number, no array: refused',
      'expected', 'invalid x6, 0 written', 'actual', coalesce(v_txt, 'null') || ', ' || v_n || ' written',
      'pass', v_txt = 'invalid,invalid,invalid,invalid,invalid,invalid' and v_n = 0);

    -- 6 ------------------------------------------------------------ the first draft
    set local role authenticated;
    v_res := app.save_charter_draft(v_team, ' We set the direction. ', v_tasks, '[]');
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_c := app.get_charter(v_team);
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    reset role;
    v_txt := concat_ws(',', v_res ->> 'ok', coalesce(v_c -> 'in_force' ->> 'version', 'none in force'), v_c -> 'draft' ->> 'purpose',
                       v_c -> 'draft' -> 'tasks' -> 0 ->> 'title', jsonb_array_length(v_c -> 'versions')::text);
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'a stored draft, trimmed; nothing in force; a member reads the draft',
      'expected', 'true,none in force,We set the direction.,Set strategy and yearly priorities,0', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'true,none in force,We set the direction.,Set strategy and yearly priorities,0');

    -- 7 ------------------------------------------------------------ agreed: version 1
    set local role authenticated;
    v_txt := app.agree_charter(v_team) ->> 'reason';
    v_res := app.save_charter_draft(v_team, 'We set the direction.', v_tasks, v_agreements);
    v_res := app.agree_charter(v_team);
    v_c := app.get_charter(v_team);
    reset role;
    select count(*) into v_n from app.team_task t join app.charter_version v on v.id = t.version_id where v.team_id = v_team;
    select count(*) into v_m from app.audit_event a, jsonb_object_keys(a.detail) k
    where a.org_id = v_org and a.kind = 'charter_agreed' and k not in ('team', 'version');
    v_txt := concat_ws(',', v_txt, v_res ->> 'version', v_c -> 'in_force' ->> 'version', coalesce(v_c ->> 'draft', 'no draft'),
                       v_n::text, jsonb_array_length(v_c -> 'in_force' -> 'agreements')::text, v_c -> 'in_force' -> 'agreements' ->> 1,
                       (select count(*) from app.audit_event where org_id = v_org and kind = 'charter_agreed')::text, v_m::text);
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'without agreements: incomplete; agreed: version 1, rows written, audited with ids only',
      'expected', 'incomplete,1,1,no draft,2,2,Decisions get an owner.,1,0', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'incomplete,1,1,no draft,2,2,Decisions get an owner.,1,0');

    -- 8 ------------------------------------------------------------ the milestone: a draft leaves the version in force
    set local role authenticated;
    v_res := app.save_charter_draft(v_team, 'We set the direction and develop leaders.', v_tasks || '[{"title": "Develop the leaders below us", "right": "inform"}]', v_agreements);
    v_c := app.get_charter(v_team);
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_res2 := app.get_charter(v_team);
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    reset role;
    v_txt := concat_ws(',', v_c -> 'in_force' ->> 'version', v_c -> 'in_force' ->> 'purpose', jsonb_array_length(v_c -> 'in_force' -> 'tasks')::text,
                       v_res2 -> 'in_force' ->> 'purpose', v_c -> 'draft' ->> 'purpose', v_c -> 'draft' ->> 'based_on');
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'a new draft does not change the version in force, for the leader or a member',
      'expected', '1,We set the direction.,2,We set the direction.,We set the direction and develop leaders.,1', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '1,We set the direction.,2,We set the direction.,We set the direction and develop leaders.,1');

    -- 9 ------------------------------------------------------------ agreed: version 2; version 1 readable
    set local role authenticated;
    v_res := app.agree_charter(v_team);
    v_c := app.get_charter(v_team);
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_res2 := app.get_charter_version(v_team, 1);
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    reset role;
    v_txt := concat_ws(',', v_c -> 'in_force' ->> 'version', jsonb_array_length(v_c -> 'in_force' -> 'tasks')::text,
                       (select string_agg(x ->> 'version', '+' order by (x ->> 'version')::int) from jsonb_array_elements(v_c -> 'versions') x),
                       v_res2 ->> 'purpose', jsonb_array_length(v_res2 -> 'tasks')::text,
                       (select status from app.charter_version where team_id = v_team and version = 1));
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'version 2 in force with 3 tasks; version 1 superseded, readable by a member as it was',
      'expected', '2,3,1+2,We set the direction.,2,superseded', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = '2,3,1+2,We set the direction.,2,superseded');

    -- 10 ----------------------------------------------------------- agreed content never changes
    v_txt := '';
    begin
      update app.charter_version set purpose = 'Changed' where team_id = v_team and version = 1;
      v_txt := v_txt || 'purpose changed,';
    exception when check_violation then v_txt := v_txt || 'purpose refused,';
    end;
    begin
      update app.team_task set title = 'Changed' where version_id = (select id from app.charter_version where team_id = v_team and version = 2);
      v_txt := v_txt || 'task changed,';
    exception when check_violation then v_txt := v_txt || 'task refused,';
    end;
    begin
      update app.working_agreement set text = 'Changed' where version_id = (select id from app.charter_version where team_id = v_team and version = 2);
      v_txt := v_txt || 'agreement changed,';
    exception when check_violation then v_txt := v_txt || 'agreement refused,';
    end;
    begin
      update app.charter_version set status = 'in_force' where team_id = v_team and version = 1;
      v_txt := v_txt || 'moved back';
    exception when check_violation then v_txt := v_txt || 'move back refused';
    end;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'an agreed version, its tasks and agreements never change, and never move back',
      'expected', 'purpose refused,task refused,agreement refused,move back refused', 'actual', v_txt,
      'pass', v_txt = 'purpose refused,task refused,agreement refused,move back refused');

    -- 11 ----------------------------------------------------------- discard
    set local role authenticated;
    v_res := app.save_charter_draft(v_team, 'A draft to discard.', v_tasks, v_agreements);
    v_res := app.discard_charter_draft(v_team);
    v_c := app.get_charter(v_team);
    v_txt := app.discard_charter_draft(v_team) ->> 'reason';
    reset role;
    v_txt := concat_ws(',', v_res ->> 'ok', coalesce(v_c ->> 'draft', 'no draft'), v_c -> 'in_force' ->> 'version',
                       (select count(*) from app.charter_version where team_id = v_team and status = 'discarded')::text, v_txt);
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'a discarded draft keeps its row and leaves version 2 in force; a second discard finds none',
      'expected', 'true,no draft,2,1,no_draft', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'true,no draft,2,1,no_draft');

    -- 12 ----------------------------------------------------------- the read-only guard, from the catalogue
    select count(*) filter (where p.prosrc !~ 'app\.team_plan_writable\('), count(*) into v_n, v_m
    from pg_proc p
    where p.pronamespace = 'app'::regnamespace and p.prokind = 'f'
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
      and p.prosrc ~* '(insert\s+into|update)\s+app\.(charter_version|team_task|working_agreement|invitation)\M'
      and p.proname not in ('revoke_invitation', 'accept_invitation');
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'every client function writing a charter or an invitation asks team_plan_writable (revoke and accept aside)',
      'expected', '0 without, at least 4 with', 'actual', v_n || ' without, ' || v_m || ' with', 'pass', v_n = 0 and v_m >= 4);

    -- 13 ----------------------------------------------------------- invitations
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.invite_member(v_team, 'charter-test-invitee@example.invalid', 'Charter invitee') ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.invite_member(v_team, 'not-an-address', 'Someone') ->> 'reason',
                       app.invite_member(v_team, 'someone@example.invalid', '   ') ->> 'reason');
    v_res := app.invite_member(v_team, ' Charter-Test-Invitee@Example.invalid ', ' Charter invitee ');
    v_token := v_res ->> 'token';
    reset role;
    select count(*) into v_n from app.invitation i
    where i.team_id = v_team and i.email = 'charter-test-invitee@example.invalid' and i.display_name = 'Charter invitee'
      and i.token_hash = pg_catalog.sha256(convert_to(v_token, 'UTF8')) and position(convert_to(v_token, 'UTF8') in i.token_hash) = 0;
    v_txt := concat_ws(',', v_txt, v_res ->> 'ok', length(v_token)::text, v_n::text);
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'a member may not invite; bad address or name refused; the invitation keeps the hash, lower-cased',
      'expected', 'not_leader,invalid,invalid,true,22,1', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'not_leader,invalid,invalid,true,22,1');

    -- 14 ----------------------------------------------------------- the link's page
    set local role anon;
    perform set_config('request.jwt.claims', '', true);
    v_c := app.get_invitation(v_token);
    v_txt := concat_ws(',', v_c ->> 'group', v_c ->> 'name', v_c ->> 'leader', v_c ->> 'state', (v_c ? 'email')::text, coalesce(v_c ->> 'team', 'no group id'),
                       coalesce(app.get_invitation('flowUnknownTokenXXXXXXX')::text, 'nothing'),
                       app.invitation_matches(v_token, 'Charter-test-invitee@example.invalid')::text,
                       app.invitation_matches(v_token, 'charter-test-out@example.invalid')::text);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'the link''s page: group, name, leader, state; never the address, nor the group''s id to an outsider',
      'expected', 'Charter test group,Charter invitee,Charter lead,open,false,no group id,nothing,true,false', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'Charter test group,Charter invitee,Charter lead,open,false,no group id,nothing,true,false');

    -- 15 ----------------------------------------------------------- a member's address; a second invitation
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := app.invite_member(v_team, 'charter-test-member@example.invalid', 'Charter member') ->> 'reason';
    v_res := app.invite_member(v_team, 'charter-test-invitee@example.invalid', 'Charter invitee');
    v_token2 := v_res ->> 'token';
    reset role;
    v_txt := concat_ws(',', v_txt, app.get_invitation(v_token) ->> 'state', app.get_invitation(v_token2) ->> 'state',
                       (v_token <> v_token2)::text,
                       (select count(*) from app.invitation where team_id = v_team and accepted_at is null and revoked_at is null)::text);
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'an existing member''s address is refused; a second invitation revokes the first, with a new link',
      'expected', 'already_member,revoked,open,true,1', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'already_member,revoked,open,true,1');

    -- 16 ----------------------------------------------------------- up to 15, invitations counted
    -- 2 members and 1 open invitation: 12 more fill it, the next is refused
    set local role authenticated;
    v_n := 0;
    for i in 1..12 loop
      if (app.invite_member(v_team, format('charter-test-fill-%s@example.invalid', i), 'Fill ' || i) ->> 'ok')::boolean then v_n := v_n + 1; end if;
    end loop;
    v_txt := app.invite_member(v_team, 'charter-test-sixteen@example.invalid', 'Sixteen') ->> 'reason';
    reset role;
    update app.invitation set revoked_at = now() where team_id = v_team and email like 'charter-test-fill-%';
    v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'the group holds 15, invitations counted: 12 more, then full',
      'expected', '12, full', 'actual', v_n || ', ' || coalesce(v_txt, 'null'), 'pass', v_n = 12 and v_txt = 'full');

    -- 17 ----------------------------------------------------------- accepting
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := app.accept_invitation(v_token2) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_invitee), true);
    v_res := app.accept_invitation(v_token2);
    v_res2 := app.accept_invitation(v_token2);
    v_c := app.get_charter(v_team);
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := concat_ws(',', v_txt, v_res ->> 'ok', v_res2 ->> 'ok', (v_c -> 'in_force' ->> 'version'), app.accept_invitation(v_token2) ->> 'reason');
    reset role;
    v_txt := concat_ws(',', v_txt, (select display_name from app.person where id = v_invitee),
                       (select role from app.membership where team_id = v_team and person_id = v_invitee),
                       app.get_invitation(v_token2) ->> 'state', app.invitation_matches(v_token2, 'charter-test-invitee@example.invalid')::text);
    v_rows := v_rows || jsonb_build_object('seq', 17, 'name', 'another address cannot accept; the invitee joins once, named as invited; then the link is used',
      'expected', 'other_address,true,true,2,used,Charter invitee,member,used,false', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'other_address,true,true,2,used,Charter invitee,member,used,false');

    -- 18 ----------------------------------------------------------- expired and revoked
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_token := app.invite_member(v_team, 'charter-test-out@example.invalid', 'Charter outsider') ->> 'token';
    v_res := app.invite_member(v_team, 'charter-test-late@example.invalid', 'Late');
    reset role;
    update app.invitation set created_at = now() - interval '15 days', expires_at = now() - interval '1 day'
    where id = (v_res ->> 'invitation')::uuid;
    select id into v_inv from app.invitation where email = 'charter-test-out@example.invalid' and revoked_at is null;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.revoke_invitation(v_team, v_inv) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_res2 := app.revoke_invitation(v_team, v_inv);
    perform set_config('request.jwt.claims', format(claims, v_outsider), true);
    v_txt := concat_ws(',', v_txt, v_res2 ->> 'ok', app.accept_invitation(v_token) ->> 'reason',
                       app.accept_invitation(v_res ->> 'token') ->> 'reason', app.get_invitation(v_res ->> 'token') ->> 'state');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 18, 'name', 'a member may not revoke; a revoked or expired invitation cannot be accepted',
      'expected', 'not_leader,true,revoked,expired,expired', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'not_leader,true,revoked,expired,expired');

    -- 19 ----------------------------------------------------------- removing a member
    update app.membership set valid_from = now() - interval '1 day' where team_id = v_team and person_id = v_invitee;
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := app.remove_member(v_team, v_invitee) ->> 'reason';
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := concat_ws(',', v_txt, app.remove_member(v_team, v_lead) ->> 'reason', app.remove_member(v_team, v_invitee) ->> 'ok');
    perform set_config('request.jwt.claims', format(claims, v_invitee), true);
    v_txt := concat_ws(',', v_txt, coalesce(app.get_charter(v_team)::text, 'nothing'));
    reset role;
    v_txt := concat_ws(',', v_txt, (select count(*) from app.membership where team_id = v_team and person_id = v_invitee and valid_to is not null)::text);
    v_rows := v_rows || jsonb_build_object('seq', 19, 'name', 'a member may not remove; the only leader cannot be removed; a removed member reads nothing at once; the row stays',
      'expected', 'not_leader,only_leader,true,nothing,1', 'actual', coalesce(v_txt, 'null'), 'pass', v_txt = 'not_leader,only_leader,true,nothing,1');

    -- 20 ----------------------------------------------------------- a new leader
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_lead), true);
    v_txt := app.set_group_leader(v_team, v_invitee) ->> 'reason';
    v_res := app.set_group_leader(v_team, v_member);
    v_c := app.get_group_members(v_team);
    v_txt := concat_ws(',', v_txt, v_res ->> 'ok', app.set_group_leader(v_team, v_lead) ->> 'reason', app.get_charter(v_team) ->> 'can_edit');
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := concat_ws(',', v_txt, app.get_charter(v_team) ->> 'can_edit');
    reset role;
    select count(*) into v_n from app.membership where team_id = v_team and person_id in (v_lead, v_member);
    v_txt := concat_ws(',', v_txt, v_c -> 'members' -> 0 ->> 'name', v_n::text,
                       ((v_c -> 'members' -> 1 ->> 'since')::timestamptz < now() - interval '25 days')::text);
    v_rows := v_rows || jsonb_build_object('seq', 20, 'name', 'only a current member can lead; the old leader stays a member; 4 rows; the start date stays',
      'expected', 'invalid,true,not_leader,false,true,Charter member,4,true', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'invalid,true,not_leader,false,true,Charter member,4,true');

    -- 21 ----------------------------------------------------------- read-only
    insert into app.subscription (team_id, org_id, plan_key, interval, currency, amount_minor, price_version, method, state,
                                  started_at, current_period_end, past_due_since, company_name, country, provider)
    values (v_team, v_org, 'team', 'year', 'USD', 180000, 1, 'card', 'past_due', now() - interval '40 days', now() - interval '8 days',
            now() - interval '8 days', 'Charter AS', 'NO', 'development');
    update app.membership set valid_from = now() - interval '1 day'
    where team_id = v_team and valid_to is null and person_id in (v_lead, v_member);
    v_txt := app.group_access(v_team);
    set local role authenticated;
    perform set_config('request.jwt.claims', format(claims, v_member), true);
    v_txt := concat_ws(',', v_txt, app.save_charter_draft(v_team, 'Purpose', v_tasks, v_agreements) ->> 'reason',
                       app.agree_charter(v_team) ->> 'reason', app.invite_member(v_team, 'charter-test-ro@example.invalid', 'Read only') ->> 'reason',
                       app.get_charter(v_team) ->> 'can_edit', app.remove_member(v_team, v_lead) ->> 'ok');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 21, 'name', 'read-only: no draft, agreement or invitation; a member can still be removed',
      'expected', 'read_only,unavailable,unavailable,unavailable,false,true', 'actual', coalesce(v_txt, 'null'),
      'pass', v_txt = 'read_only,unavailable,unavailable,unavailable,false,true');

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 22 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from auth.users where email like 'charter-test-%@example.invalid';
  select v_n + count(*) into v_n from app.organisation where name = 'Charter test organisation';
  v_rows := v_rows || jsonb_build_object('seq', 22, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_charter
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_charter order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_charter;
  if v_failed is not null then
    raise exception 'charter and members invariants failed: %', v_failed;
  end if;
  if v_count <> 22 then
    raise exception 'charter and members invariants: expected 22 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_charter;
