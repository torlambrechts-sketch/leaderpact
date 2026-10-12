# CLAUDE.md — LeaderPact

LeaderPact (a working name, held in `lib/brand.ts`) lets a leadership team of 4 to 15 see how it really
works in three minutes, then improve it meeting by meeting. The loop is the product: scan, invite,
subscribe, design the charter, diagnose, focus, meet, re-measure.

Three promises hold everything else up. They are security invariants, not features:

- **Anonymous by construction.** An answer is never stored with a person. Nobody, staff included, can
  select raw answers.
- **Nothing before close.** No result shows while a round is open. A result is computed once.
- **Honest labels.** Every score carries "Research-based, not yet validated". Nothing claims validation.

Before a milestone, read `docs/LEADERPACT_HANDOFF.md` (the build order is its section 12),
`docs/REUSE_EVALUATION.md` (section 2.0 holds the owner's answers) and `docs/DECISIONS.md`.

## Sources, in order of precedence
1. `docs/LEADERPACT_HANDOFF.md`: rules, scope, data, behaviour, copy.
2. `design/reference/LeaderPact App - Cream v2.dc.html`: layout and look, **where it is right**. Handoff
   section 11 lists where it is wrong; build the right-hand column.
3. Orgpuls (`torlambrechts-sketch/Orgpuls` at `6f5d441`): proven patterns, code and tests. Where Orgpuls
   is stricter on security, follow Orgpuls. Note the origin of every copied file in its first line.
4. Your own judgement. Say what you assumed in the pull request.

**Never invent** scores, norms, item wording, prices, legal text, customer names or pilot numbers. Where
a value is missing, leave a named `TODO(owner)` and say so.

## Stack (fixed)
- Next.js 15.5 (App Router) + TypeScript `strict` + React 19 + Tailwind 3.4, on Vercel (`fra1`).
- shadcn/ui for controls with behaviour (Radix); the visual components are ours, in `/components/lp`.
- Supabase: Postgres, Auth, Realtime, Vault, Cron. **One project: `leaderpact`, ref `tgxjbshdjwoemsmrtkzw`,
  eu-central-1.** See *The hosted project* below.
- next-intl with **English as the only locale** and no locale in the path. Every string is in
  `messages/en.json`. British English; dates in `en-GB`.
- Zod at every server boundary. Vitest, SQL invariant suites, Playwright with axe.
- Fonts: Figtree and Poppins, the same files in the app and in the design render. Icons: `lucide-react`.

## The hosted project
- Every hosted database action targets `tgxjbshdjwoemsmrtkzw` and nothing else. Check the `project_id`
  of every Supabase MCP call before it runs.
- The cloud environment also holds Orgpuls's credentials (`SUPABASE_ACCESS_TOKEN`, `SB_MCP_PAT`), which
  reach Orgpuls's production database (`jmhhszsnjfqgclxzhciq`) and Sentral's (`zuvqbaejoktpekfsiyyr`).
  **Never use them for LeaderPact, and never touch those projects from this repository.**
- The project is on the free plan (owner, A2): it pauses after a week idle, has no point-in-time backup,
  and has no server-side session limit. Restore it with the MCP if it is paused.

## Security invariants — breaking one fails the PR
1. **The threshold is 4, may be raised to 8, and is never lowered.** `app.k_floor()` returns 4 and
   `app.k_max()` returns 8: functions, not columns, so no row can lower them. An organisation's threshold
   is 4..8 and only rises. A round freezes its k when it opens; readers apply the round's k.
2. **Anonymity by absence.** A response set carries an id, its organisation, its round (or scan session)
   and its instrument version: nothing else, and **no time at all**. Participation records whether a
   member answered, never when. No column, log or timestamp links a person to a response set.
   - At close, in the closing transaction, the round's response sets are re-inserted in random order with
     new ids and the participation rows rewritten, so no transaction id or row order links them (C3).
   - The invite link's replace key is a SHA-256 in its own table, with no policy and no grant, deleted
     when the scan closes (C2). No function reads answers by it.
3. **Answer tables are unreadable.** `response`, `response_set`, `scan_response`, `scan_response_set`,
   `scan_replace_key`, `participation` and the snapshots `factor_score`, `item_score` and
   `scan_theme_score` have RLS on, **no policy and no grant to any role, `service_role` included**.
   Aggregates come only from SECURITY DEFINER functions that return nothing for an open round and nothing
   below the round's k. `app.anonymity_firewall()` proves it from the catalogue; a new reader is added to
   its reviewed list on purpose.
4. **One write path per instrument**, in one transaction, never returning the id it wrote:
   `submit_response` for a signed-in member, `submit_scan` for the shared link.
5. **Nothing before close; computed once.** A result is a snapshot written at close: level, agreement
   label and standing, with the instrument and charter versions. It never changes after. While a round
   is open, every page shows a count, never a score.
6. **What a result may show** (handoff section 7): scale and item means to one decimal, the agreement
   label, one standing. **Never** a lowest, highest or median, a standard deviation, the agreement
   number, a confidence band, a mark per member, a distribution, or a subgroup cut.
7. **RLS on every table**, scoped by organisation and by a current group membership (valid from, valid
   to). A new table ships with RLS, its policies and a test in the same migration.
8. **No service-role client in the app.** Jobs and the dispatcher claim work through narrow definer
   functions granted to `service_role` alone. CI greps the source and the browser bundle for it.
9. **No function is executable by a client until a migration grants it** (0001 removes the defaults).
   Every public entry point is reviewed in `.claude/skills/audit/allowlist.json`.
10. **No answer, comment or free text in logs, errors or analytics.** Log codes and column paths, never
    values. An analytics event carries no name, no email and no answer.
11. **The Leader Profile is the owner's alone.** Its own tables and functions, readable only by its owner;
    a group sees it only through a share, at the level shared. It shares no key, cookie or id with the scan.
12. **Nothing about an answer leaves for Sentral.** The event builder refuses any field its kind does not
    list. Never in an event: an answer, a score, a standing, a profile, a comment, a participation, or a
    count or date tied to a named round.
13. **Never build** a rating of a person by outsiders, a ranking, a team-fit score, a target on a survey
    score, or any use for selection, promotion or performance evaluation.
14. Schema changes only through `supabase/migrations/`. Never edit an applied migration; add one that
    supersedes it.

## Model as data
Scales, items, instruments, cut-offs, plans, prices and templates are rows with versions, never constants
in code. One renderer per question kind, keyed off the row. Item wording lives in versioned rows, not in
`messages/`. Cut-offs are versioned, and a stored result keeps the ones it was made with.

## Never fabricate data in the UI
If a value does not exist in the schema, do not render a placeholder that looks like data: an invented
count, a hard-coded version, a 0% over an unknown denominator. Render the real state, render nothing, or
render the design's empty treatment. A fake value is indistinguishable from a real one in review and
survives into screenshots as though it were true. Sample content is always marked Sample.

## Names and copy (handoff section 10)
- One name per thing: Leadership Team Scan (not Team Scan), team view, Full diagnostic, task match and
  time check, group (in navigation and settings), "21 scales and 3 outcomes", "Views differ", "they" for
  the team leader. The name comes from `PRODUCT_NAME`.
- British spelling. Plain words. Sentences under 25 words. No emoji. No claim that is not true today.
- "Counts only, never names" wherever a response count shows.
- `npm run verify:i18n` checks spelling, emoji, sentence length and the forbidden names.

## Design
- Match the design where it is right; the exceptions are handoff section 11 and the contrast fixes of
  section 4. It is not a pixel-perfect reference.
- Responsive from 360 px. Below 768 px: body text at least 15 px, inputs at least 16 px, targets 44 px.
- Real elements: buttons, links and labelled inputs, never a clickable `div`. Focus is a 2 px ink outline
  at 1 px offset on every interactive element.
- The design renders with `design/reference/proto-core-v5.js` and `support.js`; how is in
  `design/reference/README.md`.

## Immutability triggers must permit referential maintenance
An append-only trigger written as "reject any UPDATE or DELETE" collides with PostgreSQL's own FK
maintenance (cascades and `ON DELETE SET NULL` are DELETEs and UPDATEs the database issues for you), and
the symptom is a parent row that cannot be deleted, found far from the trigger. Write the rule as
*"nobody may change this content"*: compare the columns that carry meaning, and allow a delete only when
the parent is already gone. Orgpuls rediscovered this five times.

## Testing gates
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run verify:i18n`
- `NEXT_DIST_DIR=.next-build npx next build`, then undo the `tsconfig.json` include Next adds
- `npx playwright test` (with `NEXT_DIST_DIR=.next-build PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium`
  in a cloud session)
- Every suite in `supabase/tests/`, and `node scripts/audit/wiring.mjs --security-only`. **The anonymity
  suites pass before any merge.** In a cloud session with no Docker:
  `eval "$(bash scripts/qa/local-pg.sh)" && npm run test:db && node scripts/audit/wiring.mjs --security-only --db "$DATABASE_URL"`.
- CI rebuilds the database from migrations on real Supabase and runs all of the above.

## The fixture
One generator is the only source of fixture rows: the Lumio AS demo organisation, the Lumio leadership
group of 8 led by Kari Nordmann. Nothing is created ad hoc against a database, because a row the
generator does not emit does not survive a reset. Deterministic tokens and known passwords stay local.

## Definition of done per screen
The checks of handoff section 13 pass; every state the design shows is reachable, empty and warning
states included; every string is in `messages/en.json`; axe is clean; no console errors; keyboard and
focus-visible work; no sideways scroll at 360 px.

## Operating authority
**Build phase: in force until the owner (Tor) declares the product in production.** Granted on
11 October 2026 (A1): the same authority as Orgpuls. Run everything end to end and report afterwards.
Never stop to ask permission for an action; ask only for a product decision nobody has made (a price, a
wording, a threshold).

**Run freely:**
- any local command
- database work on `tgxjbshdjwoemsmrtkzw` through the Supabase MCP: migrations, seeds, data fixes,
  dropping or truncating a table, bulk deletes. Look at the target first and record what was removed in
  the commit.
- deploys: push to `main`, Vercel production and preview, edge functions, env vars
- git: branches, commits, PRs, merges. Force-push only a branch this session created, never `main`.
- rotating keys (through env or Vault, never printed) and plan or billing settings

**Not a deployment decision:** weakening a security invariant. That covers disabling RLS, a policy or
grant on an answer table, lowering the threshold, a column that could link a person, or an event field
that carries an answer. These change only by the owner's written decision in `docs/DECISIONS.md`.

**Secrets:** read them from the environment. Never print one, never write one into a tracked file, never
put one in a commit message or PR body. If a credential is missing, say which one and how to provide it.

**When a tool refuses:** a refusal is a technical fact, not the owner saying no. Find the cause and take
another sanctioned route; say what happened. Never retry an action an automated classifier denied, and
never weaken a control to get past one.

### Deployment playbook
1. **Database first, code second.** Code that needs new schema ships after the hosted migration, or works
   against both schemas while it is pending. A new RPC parameter is optional with a default.
2. **Hosted migrations go through the Supabase MCP `apply_migration`** on `tgxjbshdjwoemsmrtkzw`, with the
   committed file verbatim and named after its file.
3. **Write migrations without destructive statements.** The connector answers a `DROP …` with
   `{"status":"cancelled"}`. Set objects aside instead: move a function to `app`, rename it `…_retired` and
   revoke it; rename a table and revoke its grants. A migration not yet applied to the hosted project may
   be edited; once applied, it is superseded, never edited.
4. **Before every push**, with exit codes read: the testing gates above.
5. **Ship:** one milestone per pull request (handoff section 3). Push the branch, open the PR, watch CI,
   merge when green. Vercel deploys `main`.
6. **After:** on hosted, `list_migrations`, a SELECT that proves the change, and `get_advisors security`.

## Cloud sessions
A cloud session is a fresh VM with a clone of this repo. `.mcp.json` and `.claude/settings.json` configure
it; the settings file is read once, at session start.
- There is no Docker and no Supabase CLI: use `scripts/qa/local-pg.sh` for the SQL suites.
- To look at the app: build, start it in the background, and use the Playwright MCP against
  `http://localhost:3000`. Never run `playwright install`; Chromium is at `/opt/pw-browsers/chromium`.

## When ambiguous
The handoff wins on rules and scope, the design on visuals where it is right. If something is genuinely
unspecified, choose the minimal consistent option and log it in `docs/DECISIONS.md`. Do not invent
features.
