-- 0029_sign_up_notice.sql — ensure_person says whether it made the row, so the owner hears of each new account once
-- (owner, 16 October 2026; D-59).
--
-- Every sign-in lands on /app/new, which calls ensure_person before anything else (0028): a password, an email
-- link, Google or Microsoft, a kept scan or Leader Profile, an invitation. The first call for an account makes its
-- person row; every later one finds it. So "created" is true exactly once per account, and the app mails the owner
-- a copy then (lib/platform/owner-notice.ts). Nothing else changes: same grant, same refusal when signed out, and
-- an existing row is never renamed.

create or replace function app.ensure_person() returns jsonb
  language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_made int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  v_name := app.display_name_for(v_uid);
  if v_name is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  insert into app.person (id, display_name) values (v_uid, v_name) on conflict (id) do nothing;
  get diagnostics v_made = row_count;
  return jsonb_build_object('ok', true, 'created', v_made = 1);
end $$;
comment on function app.ensure_person() is
  'The signed-in caller''s person row, from the name given at sign-up; an existing row is left as it is. Says whether it made the row (0028, 0029).';
