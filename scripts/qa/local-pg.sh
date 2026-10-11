#!/usr/bin/env bash
# A throwaway local database for the SQL suites, in a cloud session that has no Docker.
#
# It starts the image's PostgreSQL (16; hosted is 17) on 127.0.0.1:54399, stubs what Supabase provides
# (supabase/tests/support/supabase-stub.sql), applies every migration in order and prints the URL:
#
#   eval "$(bash scripts/qa/local-pg.sh)"   # sets DATABASE_URL
#   npm run test:db && node scripts/audit/wiring.mjs --security-only --db "$DATABASE_URL"
#
# It never touches a hosted project. With Docker and the Supabase CLI, use `supabase start` instead,
# as CI does: that is the real system, auth schema included.
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
[ -n "$BIN" ] || { echo "local-pg: no PostgreSQL server binaries found" >&2; exit 2; }
DIR=${LOCAL_PG_DIR:-/tmp/leaderpact-pg}
PORT=${LOCAL_PG_PORT:-54399}
URL="postgresql://postgres@127.0.0.1:${PORT}/postgres"
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else sh -c "$*"; fi; }
if [ -f "$DIR/data/postmaster.pid" ]; then run "$BIN/pg_ctl -D $DIR/data stop -m fast" >/dev/null 2>&1 || true; fi
rm -rf "$DIR" && mkdir -p "$DIR" && chmod 777 "$DIR"
run "$BIN/initdb -D $DIR/data -U postgres --auth=trust -E UTF8" >/dev/null
run "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log start" >/dev/null
for _ in 1 2 3 4 5 6 7 8 9 10; do psql "$URL" -Atc 'select 1' >/dev/null 2>&1 && break; sleep 1; done
psql "$URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/support/supabase-stub.sql >&2
for m in supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$m" >&2; done
echo "export DATABASE_URL=$URL"
