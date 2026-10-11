#!/usr/bin/env bash
# Every SQL suite, as CI runs them, against a local database (never a hosted project).
# Origin: Orgpuls scripts/qa/test-db.sh @ 6f5d441 (adapted: no design figures; any local Postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."
# DATABASE_URL picks another local database; without it, the local Supabase stack
db=${DATABASE_URL:-$(supabase status -o json | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).DB_URL))')}
case "$db" in postgresql://*@127.0.0.1:*|postgresql://*@localhost:*) ;; *) echo "test:db: not a local database" >&2; exit 2 ;; esac
# every suite runs, and the run fails at the end, so one red suite hides no other
failed=0
for suite in supabase/tests/*_invariants.sql; do
  if psql "$db" -q -v ON_ERROR_STOP=1 -f "$suite" >/dev/null; then
    echo "ok   $suite"
  else
    echo "FAIL $suite" >&2
    failed=$((failed + 1))
  fi
done
if [ "$failed" -gt 0 ]; then echo "test:db: $failed suite(s) failed" >&2; exit 1; fi
