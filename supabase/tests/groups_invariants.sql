-- groups_invariants.sql — a signed-in leader starts a group and its scan (0009; handoff 6.3 and 6.4).
--
--      1  no client role but a signed-in one may start a group; anon may not
--      2  a caller with no session is told signed_out and nothing is written
--      3  a size outside 4 to 15, a blank name or no request id is refused, and nothing is written
--      4  a start returns ok, the group and a 22-character link code, and nothing else
--      5  it writes one person (named from the email), one organisation, one group, one leader membership
--      6  and one open scan: the declared size, k frozen at 4, the 7-day window, no answer yet
--      7  the same request again returns the same group and code, and writes nothing more
--      8  a new request from the same person adds a group (handoff 6.3); the person stays one row
--      9  the leader reads the group, the scan's count and the link, but not the code column itself
--     10  another signed-in person reads nothing of the group, and no link
--     11  the link's page reads the group's name, phase, count, closing date and version, and nothing more
--     12  a malformed or unknown code reads nothing
--     13  the leader's own answers go through submit_scan and count toward the cap (owner C4)
--     14  the audit row carries ids and a count only
--     15  a start writes no answer of any kind
--     16  nothing written by this suite survives
--
-- Every row must read pass = true; the file raises if any does not. Everything is written inside a block
-- that is rolled back, so the suite depends on no fixture and leaves nothing.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/groups_invariants.sql

create unlogged table if not exists public._inv_groups(seq int, name text, expected text, actual text, pass bool);
truncate public._inv_groups;

do $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_lead uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_req uuid := gen_random_uuid();
  v_req2 uuid := gen_random_uuid();
  v_res jsonb;
  v_res2 jsonb;
  v_team uuid;
  v_code text;
  v_org uuid;
  v_n int;
  v_m int;
  v_txt text;
  v_ok boolean;
  v_json jsonb;
  v_version uuid;
  r record;
begin
  -- 1 -------------------------------------------------------------- who may start a group
  v_ok := not has_function_privilege('anon', 'app.start_group(text, int, uuid)', 'execute')
          and has_function_privilege('authenticated', 'app.start_group(text, int, uuid)', 'execute');
  v_rows := v_rows || jsonb_build_object('seq', 1, 'name', 'only a signed-in client may start a group',
    'expected', 'anon no, authenticated yes', 'actual', case when v_ok then 'as expected' else 'not as expected' end, 'pass', v_ok);

  begin
    insert into auth.users (id, email) values
      (v_lead, 'groups-test-kari.nordmann@example.invalid'), (v_other, 'groups-test-other@example.invalid');

    -- 2 ------------------------------------------------------------ no session
    perform set_config('request.jwt.claims', '', true);
    set local role authenticated;
    v_res := app.start_group('Groups test group A', 8, v_req);
    reset role;
    select count(*) into v_n from app.organisation where name = 'Groups test group A';
    v_rows := v_rows || jsonb_build_object('seq', 2, 'name', 'no session: signed_out, nothing written',
      'expected', 'signed_out, 0', 'actual', coalesce(v_res ->> 'reason', 'null') || ', ' || v_n, 'pass', v_res ->> 'reason' = 'signed_out' and v_n = 0);

    -- 3 ------------------------------------------------------------ refused inputs
    perform set_config('request.jwt.claims', json_build_object('sub', v_lead, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_txt := concat_ws(',',
      app.start_group('Groups test group A', 3, v_req) ->> 'reason',
      app.start_group('Groups test group A', 16, v_req) ->> 'reason',
      app.start_group('   ', 8, v_req) ->> 'reason',
      app.start_group(repeat('x', 121), 8, v_req) ->> 'reason',
      app.start_group('Groups test group A', 8, null) ->> 'reason',
      app.start_group('Groups test group A', null, v_req) ->> 'reason');
    reset role;
    select count(*) into v_n from app.organisation where name = 'Groups test group A';
    v_rows := v_rows || jsonb_build_object('seq', 3, 'name', 'size 3 or 16, a blank or long name, no request or no size: refused',
      'expected', 'invalid x6, 0 written', 'actual', v_txt || ', ' || v_n || ' written',
      'pass', v_txt = 'invalid,invalid,invalid,invalid,invalid,invalid' and v_n = 0);

    -- 4 ------------------------------------------------------------ a start
    set local role authenticated;
    v_res := app.start_group('  Groups test group A ', 8, v_req);
    reset role;
    v_team := (v_res ->> 'team')::uuid;
    v_code := v_res ->> 'code';
    select array_to_string(array(select jsonb_object_keys(v_res) order by 1), ',') into v_txt;
    v_rows := v_rows || jsonb_build_object('seq', 4, 'name', 'a start returns ok, the group and a 22-character code only',
      'expected', 'code,ok,team; 22', 'actual', v_txt || '; ' || coalesce(length(v_code), 0),
      'pass', (v_res ->> 'ok')::boolean and v_txt = 'code,ok,team' and v_code ~ '^[A-Za-z0-9_-]{22}$');

    -- 5 ------------------------------------------------------------ what it wrote
    select t.org_id into v_org from app.team t where t.id = v_team;
    select count(*) into v_n from app.person p where p.id = v_lead and p.display_name = 'groups-test-kari.nordmann';
    select v_n * 1000 + count(*) into v_n from app.organisation o where o.id = v_org and o.name = 'Groups test group A' and o.threshold = 4;
    select v_n * 1000 + count(*) into v_n from app.team t where t.id = v_team and t.name = 'Groups test group A';
    select v_n * 1000 + count(*) into v_n from app.membership m
      where m.team_id = v_team and m.person_id = v_lead and m.role = 'leader' and m.valid_to is null and m.org_id = v_org;
    select count(*) into v_m from app.membership m where m.team_id = v_team;
    v_rows := v_rows || jsonb_build_object('seq', 5, 'name', 'one person named from the email, one organisation, group and leader membership',
      'expected', '1001001001, 1 membership', 'actual', v_n || ', ' || v_m || ' membership', 'pass', v_n = 1001001001 and v_m = 1);

    -- 6 ------------------------------------------------------------ the scan
    select v.id into strict v_version from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'scan' and v.status = 'published' order by v.version desc limit 1;
    select count(*) into v_n from app.scan_session ss
    where ss.team_id = v_team and ss.org_id = v_org and ss.code = v_code and ss.member_count = 8 and ss.k = 4
      and ss.window_days = 7 and ss.phase = 'open' and ss.answered = 0 and not ss.extended
      and ss.instrument_version_id = v_version and ss.closes_at = ss.opens_at + interval '7 days';
    v_rows := v_rows || jsonb_build_object('seq', 6, 'name', 'one open scan: size 8, k 4, 7 days, the published version, no answer',
      'expected', '1', 'actual', v_n::text, 'pass', v_n = 1);

    -- 7 ------------------------------------------------------------ the same request again
    set local role authenticated;
    v_res2 := app.start_group('Groups test group C', 5, v_req);
    reset role;
    select count(*) into v_n from app.team t join app.membership m on m.team_id = t.id where m.person_id = v_lead;
    v_rows := v_rows || jsonb_build_object('seq', 7, 'name', 'the same request returns the same group and code, nothing more',
      'expected', 'same, 1 group', 'actual', case when v_res2 = v_res then 'same' else v_res2::text end || ', ' || v_n || ' group',
      'pass', v_res2 = v_res and v_n = 1);

    -- 8 ------------------------------------------------------------ a second group for the same person
    set local role authenticated;
    v_res2 := app.start_group('Groups test group B', 4, v_req2);
    reset role;
    select count(*) into v_n from app.membership m where m.person_id = v_lead and m.role = 'leader';
    select count(*) into v_m from app.person p where p.id = v_lead;
    v_rows := v_rows || jsonb_build_object('seq', 8, 'name', 'a new request adds a group; the person stays one row',
      'expected', 'ok, 2 groups, 1 person', 'actual', coalesce(v_res2 ->> 'ok', 'null') || ', ' || v_n || ' groups, ' || v_m || ' person',
      'pass', (v_res2 ->> 'ok')::boolean and (v_res2 ->> 'team')::uuid <> v_team and v_n = 2 and v_m = 1);

    -- 9 ------------------------------------------------------------ the leader reads the group, the count and the link
    set local role authenticated;
    select count(*) into v_n from app.team t where t.id = v_team;
    select v_n * 10 + count(*) into v_n from app.scan_session ss where ss.team_id = v_team and ss.answered = 0;
    v_txt := (select app.get_scan_link(ss.id) from app.scan_session ss where ss.team_id = v_team);
    v_ok := false;
    begin
      perform ss.code from app.scan_session ss where ss.team_id = v_team;
    exception when insufficient_privilege then
      v_ok := true;
    end;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 9, 'name', 'the leader reads the group, the count and the link, not the code column',
      'expected', '11, the code, refused', 'actual', v_n || ', ' || case when v_txt = v_code then 'the code' else coalesce(v_txt, 'null') end
        || ', ' || case when v_ok then 'refused' else 'read' end,
      'pass', v_n = 11 and v_txt = v_code and v_ok);

    -- 10 ----------------------------------------------------------- an outsider reads nothing
    perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from app.team t where t.id = v_team;
    select v_n + count(*) into v_n from app.scan_session ss where ss.team_id = v_team;
    select v_n + count(*) into v_n from app.membership m where m.team_id = v_team;
    select v_n + count(*) into v_n from app.organisation o where o.id = v_org;
    select v_n + count(*) into v_n from app.person p where p.id = v_lead;
    reset role;
    -- the outsider knows the scan's id (it is no secret) and still gets no link
    select ss.id into v_version from app.scan_session ss where ss.code = v_code;
    set local role authenticated;
    v_txt := app.get_scan_link(v_version);
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 10, 'name', 'another signed-in person reads nothing of the group, and no link',
      'expected', '0 rows, no link', 'actual', v_n || ' rows, ' || coalesce(v_txt, 'no link'), 'pass', v_n = 0 and v_txt is null);

    -- 11 ----------------------------------------------------------- the link's page, as anon
    select v.id into strict v_version from app.instrument_version v join app.instrument i on i.id = v.instrument_id
    where i.key = 'scan' and v.status = 'published' order by v.version desc limit 1;
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    select count(*) as n, min(i.group_name) as name, min(i.phase) as phase, min(i.answered) as answered,
           min(i.member_count) as size, bool_and(i.closes_at > now()) as future, bool_and(i.instrument_version_id = v_version) as version
      into r from app.get_scan_invite(v_code) i;
    reset role;
    select string_agg(x, ',' order by o) into v_txt
    from unnest((select proargnames from pg_proc where oid = 'app.get_scan_invite(text)'::regprocedure)) with ordinality u (x, o)
    where o > 1;
    v_rows := v_rows || jsonb_build_object('seq', 11, 'name', 'the link page reads name, phase, count, closing date and version only',
      'expected', '1, Groups test group A, open, 0 of 8; group_name,phase,answered,member_count,closes_at,instrument_version_id',
      'actual', r.n || ', ' || r.name || ', ' || r.phase || ', ' || r.answered || ' of ' || r.size || '; ' || v_txt,
      'pass', r.n = 1 and r.name = 'Groups test group A' and r.phase = 'open' and r.answered = 0 and r.size = 8 and r.future and r.version
              and v_txt = 'group_name,phase,answered,member_count,closes_at,instrument_version_id');

    -- 12 ----------------------------------------------------------- a malformed or unknown code
    set local role anon;
    select count(*) into v_n from app.get_scan_invite('short');
    select v_n + count(*) into v_n from app.get_scan_invite(null);
    select v_n + count(*) into v_n from app.get_scan_invite('unknownCodeUnknownCode00');
    select v_n + count(*) into v_n from app.get_scan_invite(v_code || ''' or true --');
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 12, 'name', 'a malformed or unknown code reads nothing',
      'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

    -- 13 ----------------------------------------------------------- the leader's own answers count (owner C4)
    select jsonb_agg(jsonb_build_object('item', vi.item_id, 'value', 1 + vi.ordinal % 5) order by vi.ordinal)
      into v_json from app.instrument_version_item vi where vi.instrument_version_id = v_version;
    perform set_config('request.jwt.claims', json_build_object('sub', v_lead, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_res2 := app.submit_scan(v_code, v_json, null);
    select i.answered into v_n from app.get_scan_invite(v_code) i;
    reset role;
    v_rows := v_rows || jsonb_build_object('seq', 13, 'name', 'the leader answers through submit_scan and counts 1 of 8',
      'expected', 'ok, 1', 'actual', coalesce(v_res2 ->> 'ok', 'null') || ', ' || v_n, 'pass', (v_res2 ->> 'ok')::boolean and v_n = 1);

    -- 14 ----------------------------------------------------------- the audit row
    select count(*), min(array_to_string(array(select jsonb_object_keys(a.detail) order by 1), ','))
      into v_n, v_txt
    from app.audit_event a where a.kind = 'group_created' and a.actor = v_lead and a.org_id = v_org;
    v_rows := v_rows || jsonb_build_object('seq', 14, 'name', 'one audit row with ids and a count only',
      'expected', '1: members,request,team', 'actual', v_n || ': ' || coalesce(v_txt, ''), 'pass', v_n = 1 and v_txt = 'members,request,team');

    -- 15 ----------------------------------------------------------- a start writes no answer
    select count(*) into v_n from app.scan_response_set rs join app.scan_session ss on ss.id = rs.scan_session_id
    where ss.team_id = (v_res2 ->> 'team')::uuid or ss.org_id in (select t.org_id from app.team t join app.membership m on m.team_id = t.id
                                                                  where m.person_id = v_lead and t.id <> v_team);
    v_rows := v_rows || jsonb_build_object('seq', 15, 'name', 'a start writes no answer: the second group''s scan has none',
      'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

    reset role;
    perform set_config('request.jwt.claims', '', true);
    raise exception 'rollback' using errcode = 'P0001';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'rollback' then raise; end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- 16 ------------------------------------------------------------ nothing survives
  select count(*) into v_n from app.organisation where name in ('Groups test group A', 'Groups test group B', 'Groups test group C');
  select v_n + count(*) into v_n from auth.users where email like 'groups-test-%@example.invalid';
  v_rows := v_rows || jsonb_build_object('seq', 16, 'name', 'nothing written by this suite survives',
    'expected', '0', 'actual', v_n::text, 'pass', v_n = 0);

  insert into public._inv_groups
  select (r2 ->> 'seq')::int, r2 ->> 'name', r2 ->> 'expected', r2 ->> 'actual', (r2 ->> 'pass')::boolean
  from jsonb_array_elements(v_rows) r2;
end $$;

select seq, name, expected, actual, pass from public._inv_groups order by seq;

do $$
declare v_failed text; v_count int;
begin
  select string_agg(seq || ' ' || name, '; ' order by seq) filter (where pass is not true), count(*)
    into v_failed, v_count from public._inv_groups;
  if v_failed is not null then
    raise exception 'groups invariants failed: %', v_failed;
  end if;
  if v_count <> 16 then
    raise exception 'groups invariants: expected 16 rows, got %', v_count;
  end if;
end $$;

drop table public._inv_groups;
