#!/usr/bin/env bash
# The Data API for the local database, in a cloud session that has no Docker (D-23).
#
# scripts/qa/local-pg.sh gives a PostgreSQL with every migration; this puts PostgREST in front of it the
# way Supabase does, so the app and the Playwright flows can run against it:
#
#   eval "$(bash scripts/qa/local-pg.sh)"    # DATABASE_URL
#   eval "$(bash scripts/qa/local-api.sh)"   # NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
#
# - PostgREST v12.2.3, the release Supabase pins, downloaded once and checked against its SHA-256.
# - The `authenticator` role Supabase has, which switches to `anon` or `authenticated` by the token.
# - An anon key: an HS256 token with role `anon`, signed with a secret made for this run.
# - The schemas Supabase exposes plus `app` (supabase/config.toml), and Supabase's `/rest/v1` prefix,
#   served by scripts/qa/local-api-proxy.mjs.
#
# There is no Auth service: sign-in flows need CI's real Supabase. The proxy answers Auth's user lookup for
# tokens signed with this run's secret, so a test can open a signed-in page with a minted session (D-27);
# LOCAL_API_JWT_SECRET is printed for that. It never touches a hosted project.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?run scripts/qa/local-pg.sh first and eval its output}"
case "$DATABASE_URL" in postgresql://*@127.0.0.1:*|postgresql://*@localhost:*) ;; *) echo "local-api: not a local database" >&2; exit 2 ;; esac

VERSION=v12.2.3
SHA256=9f71269e61ac3a940281e93ff415760f5957e430e475ba4c3889f3ede7d5527c
DIR=${LOCAL_API_DIR:-/tmp/leaderpact-api}
API_PORT=${LOCAL_API_PORT:-54321}
PGRST_PORT=$((API_PORT + 1))
mkdir -p "$DIR"

if [ ! -x "$DIR/postgrest" ]; then
  curl -sSL -o "$DIR/postgrest.tar.xz" "https://github.com/PostgREST/postgrest/releases/download/$VERSION/postgrest-$VERSION-linux-static-x64.tar.xz"
  echo "$SHA256  $DIR/postgrest.tar.xz" | sha256sum -c --quiet - >&2
  tar -xJf "$DIR/postgrest.tar.xz" -C "$DIR"
fi

for f in postgrest proxy; do
  if [ -f "$DIR/$f.pid" ]; then kill "$(cat "$DIR/$f.pid")" 2>/dev/null || true; rm -f "$DIR/$f.pid"; fi
done

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 >&2 <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
SQL

SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=\n')
ANON_KEY=$(SECRET="$SECRET" node -e '
  const { createHmac } = require("node:crypto")
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const body = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ iss: "leaderpact-local", role: "anon", iat: now, exp: now + 7 * 86400 })
  process.stdout.write(body + "." + createHmac("sha256", process.env.SECRET).update(body).digest("base64url"))
')

host_port=${DATABASE_URL#*@}; host_port=${host_port%%/*}
cat > "$DIR/postgrest.conf" <<CONF
db-uri = "postgresql://authenticator@$host_port/postgres"
db-schemas = "public, graphql_public, app"
db-extra-search-path = "public, extensions"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = $PGRST_PORT
CONF

nohup "$DIR/postgrest" "$DIR/postgrest.conf" > "$DIR/postgrest.log" 2>&1 &
echo $! > "$DIR/postgrest.pid"
LOCAL_API_JWT_SECRET="$SECRET" nohup node scripts/qa/local-api-proxy.mjs "$API_PORT" "$PGRST_PORT" > "$DIR/proxy.log" 2>&1 &
echo $! > "$DIR/proxy.pid"

for _ in $(seq 1 20); do
  curl -sf -o /dev/null "http://127.0.0.1:$API_PORT/rest/v1/" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" && break
  sleep 0.5
done
curl -sf -o /dev/null "http://127.0.0.1:$API_PORT/rest/v1/" -H "Authorization: Bearer $ANON_KEY" || { echo "local-api: PostgREST did not start; see $DIR/postgrest.log" >&2; exit 1; }

echo "export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$API_PORT"
echo "export NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
echo "export LOCAL_API_JWT_SECRET=$SECRET"
