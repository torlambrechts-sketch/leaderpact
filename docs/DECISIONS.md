# Decisions

Decisions taken during the build, newest last. The owner's answers to the reuse evaluation are in
`docs/REUSE_EVALUATION.md`, section 2.0; they are not repeated here. An entry that changes a security
invariant needs the owner's written decision and says so.

## D-01 — ESLint 9, flat config (milestone 0b)

Orgpuls runs ESLint 8 with `.eslintrc.json`; ESLint 8 is out of support. ESLint 9 is the newest that
`eslint-config-next` 15.5 accepts, so LeaderPact uses ESLint 9 with `eslint.config.mjs`. npm reports
ESLint 9 as no longer supported too; moving to ESLint 10 waits for a Next version that accepts it.

## D-02 — "No literal text in JSX" is a lint rule (0b)

`react/jsx-no-literals` fails on text written directly into JSX in `app/` and `components/`, so the rule
"every string comes from next-intl" is checked, not remembered. Orgpuls had no such check. A handful of
punctuation marks are allowed.

## D-03 — The copy rules are checked (0b)

`lib/i18n/copy-rules.ts`, run by `npm run verify:i18n` and the unit tests, fails on American spelling,
emoji, sentences of 25 words or more, and the names in the "Not" column of handoff section 10. The word
lists are short and grow when a case is found.

## D-04 — Deny by default in the middleware (0b)

Orgpuls makes every unknown address public, because its public site has many pages. LeaderPact names its
public paths (`lib/supabase/middleware.ts`, `PUBLIC_PATHS`) from handoff section 5; every other address
needs a session. The four failure rules of Orgpuls's middleware are kept.

## D-05 — No function is executable by a client until granted (0b, security)

PostgreSQL grants EXECUTE on every new function to PUBLIC, and Supabase adds a default in `public` that
makes every new function executable by `anon` and `authenticated`. Migration 0001 removes both for what
the migrations create. A per-schema default can only add to the global one, so the PUBLIC default is
removed globally. Every entry point is then a deliberate grant, reviewed in the audit's allowlist. This is
stricter than Orgpuls, which revokes function by function. `foundation_invariants.sql` check 6 proves it,
and a negative control showed the probe is executable by `anon` without the migration.

## D-06 — CI runs on every pull request (0b)

Orgpuls skips CI for documentation-only changes, so such a pull request can never pass a required check.
LeaderPact runs the job on every pull request and push to `main`.

## D-07 — A local PostgreSQL for the suites in a cloud session (0b)

Cloud sessions have no Docker and no Supabase CLI. `scripts/qa/local-pg.sh` starts the image's
PostgreSQL 16, stubs the client roles and Supabase's default grants
(`supabase/tests/support/supabase-stub.sql`), applies every migration and prints `DATABASE_URL`. It is for
quick feedback only; CI runs real Supabase on Postgres 17, and its result is the one that counts.

## D-08 — `.claude/settings.json` (0b)

Copied from Orgpuls as it is (owner, A1): bypass mode, an allow list covering every tool. One addition: the
SessionStart hook that runs `scripts/cloud-session-start.sh`, which Orgpuls's script expects but Orgpuls
never wired.

## D-09 — A holding page until milestone 3 (0b)

`/` shows the product name and one sentence: "This site is being built. Nothing here is live yet." Every
page is `noindex` until the name is cleared (handoff section 0). The icon is the design's logo mark: a
black circle with a white dot.

## D-10 — Hosted Auth settings not yet applied (0b)

`supabase/config.toml` declares a 15-minute sign-in link and a 30-day session. The free project is reachable
only through the Supabase MCP, which has no Auth-configuration tool, and the environment's Management API
tokens do not reach this project. The hosted values stay at Supabase's defaults until milestone 4 (sign-in),
which needs either a Management API token for this project or the owner setting them in the dashboard
(Authentication, Providers, Email). On the free plan the 30-day limit rests on the cookie's lifetime.
