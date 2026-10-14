-- What a plain PostgreSQL needs before the migrations apply as they do on Supabase: the client roles,
-- the extensions schema with pgcrypto, a minimal `auth` schema (`auth.users` and `auth.uid()`, which reads
-- the JWT claims the way Supabase's does), a minimal Vault (`vault.secrets`, `vault.decrypted_secrets`,
-- `vault.create_secret`, `vault.update_secret`, unencrypted here), and Supabase's default grants in public
-- (which 0001 removes).
-- Used only by scripts/qa/local-pg.sh, for cloud sessions without Docker. CI runs real Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create table if not exists auth.users (id uuid primary key, email text);
-- the last sign-in Auth records, which the retention job of 0026 reads
alter table auth.users add column if not exists last_sign_in_at timestamptz;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Vault's interface as Supabase has it, without the encryption: the platform secrets of 0025 live here locally
create schema if not exists vault;
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(), name text unique, description text not null default '', secret text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create or replace view vault.decrypted_secrets as select s.id, s.name, s.description, s.secret, s.secret as decrypted_secret from vault.secrets s;
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '') returns uuid
  language sql as $$ insert into vault.secrets (secret, name, description) values (new_secret, new_name, coalesce(new_description, '')) returning id $$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null)
  returns void language sql as $$
  update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name),
                           description = coalesce(new_description, description), updated_at = now() where id = secret_id $$;
revoke all on schema vault from public;

alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
