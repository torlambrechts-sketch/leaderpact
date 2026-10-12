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

## D-09 — A holding page until milestone 3 (0b; superseded by D-24)

`/` shows the product name and one sentence: "This site is being built. Nothing here is live yet." Every
page is `noindex` until the name is cleared (handoff section 0). The icon is the design's logo mark: a
black circle with a white dot.

## D-10 — Hosted Auth settings not yet applied (0b; still open, see D-28)

`supabase/config.toml` declares a 15-minute sign-in link and a 30-day session. The free project is reachable
only through the Supabase MCP, which has no Auth-configuration tool, and the environment's Management API
tokens do not reach this project. The hosted values stay at Supabase's defaults until milestone 4 (sign-in),
which needs either a Management API token for this project or the owner setting them in the dashboard
(Authentication, Providers, Email). On the free plan the 30-day limit rests on the cookie's lifetime.

## D-11 — How milestone 1 is checked against the design (M1)

The design is measured, not eyeballed. `docs/design/component-specs.md` gives every component's values
with the design line they come from, and a locator that opens the design at the right state.
`scripts/verify/side-by-side.mjs` renders the design (`design-render.mjs`) and `/specimens` at 1280 px. It
compares the computed styles in `scripts/verify/claims.json`, one claim per component, and writes design |
app | diff sheets for a person. A claim fails on a differing property. The pixel share is informational,
because sample text and data differ by design.

At 390 and 360 px the design has no layout (`min-width:1280px`), so `scripts/verify/mobile.mjs` checks the
owner's B3 rules instead: no sideways scroll, body text at least 15 px, inputs at least 16 px, targets at
least 44 px, no serious axe finding, no console error. It also saves screenshots for a person to review.

**Body text** is the body role of the handoff's type scale: text at 400 or 500, between the meta sizes
(12 to 12.5 px) and 15 px, outside a control. Meta, micro labels, chips and control labels are their own
roles in that scale, and keep their sizes on phones. Raising every word to 15 px would redraw every chip
and button, which the handoff does not ask for. Components with body text add `max-md:text-[15px]`.

`/specimens` is public in the middleware so the check needs no session, and returns 404 in production.

## D-12 — Where the build follows the design's measurements over the handoff's numbers (M1)

The handoff's section 4 values are a summary. Where the design measures differently and section 11 does not
call the design wrong, the build follows the measurement (CLAUDE.md: the design wins on visuals where it is
right). From the spec's conflicts table (section 7):

- **Buttons.** Five sizes, as measured: default (radius 11, 10 by 16, 13.5 px; primary 700, others 600),
  compact, small (radius 10, 8 by 13, 12.5 / 700), extra small, and large (radius 12, 14 / 600). The
  handoff's "radius 12, primary 600" is the large size.
- **Level bar.** 9 px in the team view, the personal view and Home; 8 px in Results rows. `LevelBar` takes
  `track={8 | 9}` and defaults to 9. The fill is drawn from the stored one-decimal level, not the design's
  unrounded mean.
- **Warning box.** The sentence is ink and only the action is `--flag-ink`. The icon is `--flag-icon`
  (`#a86c05`, 4.17:1, an icon beside words), a new token. `--flag` stays a border.
- **Section title.** 18 px has no tracking; -0.02em is for 21 px.
- **Page title.** Poppins 32 / 500 / -0.03em, on eight pages of the design and missing from the handoff's
  scale, is the `page-title` font size.
- **Hint box.** Two sizes: compact (radius 12) and large with a title (radius 14).
- **Evidence chip.** 11 / 700. Only the design's Standing table draws 600.
- **Standing.** An icon per standing (check, eye, flag, split, info, link), all in `--accent-strong`, so
  colour never carries the standing.
- **Avatar.** A stable hash of the person, as the handoff says, not the design's fixed tone per seeded
  member. The fixture will seed Kari's id to the first pair so screenshots match.
- **Toast.** Kept with the design's shadow. The design has no error toast. One will reuse this shape with an
  error icon when a screen needs it.

## D-13 — The phone bottom bar is a proposal (M1)

The design has no phone layout and no bottom bar. Below 768 px the bar holds Home, Group, Meetings, Plan
and More (handoff section 4 Layout). It reuses the navigation item's tokens on a `--bar` surface: 12.5 / 600,
16 px icons, the active item in ink, radius 10, targets at least 48 px high. Nothing in the design can
confirm it, so it waits on the owner's review of the phone screenshots.

## D-14 — Colours the design uses that no token covers (M1)

`#a86c05`, the warning icon, became `--flag-icon` (D-12), and `#36342f` became `--text-body` (B2). The
others in the spec's conflict 14 belong to screens of later milestones: `#d4cfdd`, `#fff6f7`, `#8a5a00`,
`#b7790b`, `#f0d7a5`, `#f3efe8`, `#e9e4f3`, `#2a2a2a` and `#aaa59a`. Each is tokenised by the milestone that
builds its screen, with its measured role, or mapped to the nearest token if it fails contrast. `#aaa59a`
fails (2.45:1), so it will not be used for text.

## D-15 — No scan answer exists before the group does (M2, security)

The leader answers the scan before any account exists. Those answers stay on the device through the
email sign-in and are submitted to the group's new scan session (REUSE 4.7). So `scan_session` always
belongs to a group and an organisation, and no answer is stored for a visitor who never signs up. The
handoff's 90-day rule for "scan answers before sign-up" therefore has nothing to delete. This is the
stricter reading: an anonymous visitor's answers are not kept on the chance that they return.

## D-16 — `person` carries no organisation (M2)

"Every row carries an organisation ID" (handoff 8) holds for every table but `person`. A person is the
signed-in identity, one per auth user, and may belong to groups of more than one organisation, so the
organisation lives on `membership`. A person is read only by themselves and by people who share a group
with them now (`app.shares_team`).

## D-17 — The agreement index, exactly (M2)

Handoff 7 proposes "1 minus the variance of respondents' scale scores divided by 2.0". The build uses:

- **The sample variance (n − 1)**, as the rwg index it is modelled on does.
- **Labels:** high above 0.70, low at or below 0.50, medium between. The handoff's "medium from 0.51"
  is read as "above 0.50", so no value falls between labels.
- **Exact arithmetic.** In integers the variance is num / den, with num = n·Σs² − (Σs)² and
  den = items² · n · (n − 1). A label is decided by comparing num with 2·(1 − cut-off)·den, never in
  floating point. The SQL (`app.agreement_label`) and TypeScript (`lib/scoring`) functions agree on all
  119 cases in `lib/scoring/cases.json`, whose expected values were computed separately with exact
  rationals. Exactly 0.70 is possible only for some group sizes, and the case names say which.
- **Where the index lives.** It is stored in the snapshot to four decimals and never returned by a
  reader. The formula is one function in each language, so a confirmed formula changes one body
  (handoff 14).

## D-18 — Rounds and scans at close (M2)

- **Phases.** A round moves scheduled → answering → closed or released (owner C11).
- **What opening fixes.** Opening freezes k, fixes the window and invites the current members
  (`app.open_round`). One round answers per group at a time; a due round waits until the open one
  closes.
- **When it closes.** On its date, or inside the transaction of the last answer.
- **Below k:**
  - a diagnostic is extended once while someone has yet to answer, then gives no result;
  - a pulse is missed, with no extension;
  - the scan is extended once while seats are left, then gives no team view.
  Either way the answers are deleted (owner C9).
- **Owner C3's reshuffle** runs in the closing transaction. The suite shows the link while a round is
  open (one shared transaction id per answer) and its absence after close (one id spans every
  participation row and response set). This proves the residual of C3 is real and that close removes it.
- **The snapshots** `factor_score`, `item_score` and `scan_theme_score` are as unreadable as the answers
  (no policy, no grant). Readers return levels and labels for current members only. The scan's team view
  is also readable through its link, for members without an account.
- **Change** is decided on the two shown levels (`app.change_shows`), so what a person reads is what
  was compared. Across versions it shows only when the scale's core item rows are identical
  (`app.factor_comparable`, owner C5).
- **The scan link's code is stored as it is.** The leader re-shares the link, so the code must be
  readable; current members read it through `get_scan_link`, and it is not a column a client can
  select. Only the replace key is kept as a hash.
- **Testing deadlines.** `now()` does not advance inside one transaction, so the suites pass a deadline
  by moving a closing date back with the guard trigger switched off for that one statement, inside a
  block that is rolled back.

## D-19 — The model as data, version 1 (M2)

- **The data.** `data/` holds the bank, the scan, the instruments, the cut-offs, the settings and the
  plans, checked by Zod in `lib/model/schema.ts`: counts, the 6/11/4/3 split, 3 core and 1 candidate
  per scale, the copy rules. `scripts/seed/model.mjs` renders migration 0004 from them, and a unit test
  fails if the two disagree.
- **Once 0004 is applied, it is never edited.** A reworded item, a new cut-off version or a changed
  setting or price becomes a new data version and a new migration.
- **Who reads what.**
  - Candidate items are read by no client; a pilot reader comes with milestone 10 (owner D8).
  - A visitor without an account reads only the scan's items.
- **Fixed settings carry no range.** The `reminder_days` range is 1 to 30, the longest window.
- **Templates** (charter, agenda, the four agenda item types) are seeded by the milestones that build
  their tables, 9 and 13.
- **The charter version** on a score is a column without a reference until milestone 9 creates the
  charter tables.

## D-20 — The Lumio fixture comes with milestone 4 (M2)

The generator of handoff 9 and REUSE 4.12 needs sign-in, groups made through their RPCs and known
passwords for local use; none exists before milestone 4. Until then the suites build their own
organisations in rolled-back blocks, as REUSE 4.4 asks, and depend on no fixture. The generator, local
only, arrives with milestone 4. It solves for the design's figures by milestone 5, the team view.

## D-21 — SQL is always allowed, in production too (owner, 12 October 2026)

The owner: "always allow SQL; even in production". `execute_sql` and `apply_migration` through the
Supabase MCP on `tgxjbshdjwoemsmrtkzw` run without a prompt, now and after the product is declared in
production; CLAUDE.md, Operating authority, says so. `.claude/settings.json` names both tools in its allow
list. It changes who asks, not what may be done: weakening a security invariant still needs the owner's
written decision here, and no other project is touched.

A cloud session ignores `defaultMode: bypassPermissions` and reads a repository's allow rules only when it
holds that one repository, so a session opened on LeaderPact alone gets these rules.

## D-22 — Migrations the connector holds go to the owner's SQL editor (M2)

Hosted 0006 and 0007 would not apply. `apply_migration` and `execute_sql` both timed out after 60 s, and
once returned `{"status":"cancelled"}`. The Postgres log shows the query never arrived.

Bisected with rolled-back probes: a query with one `DELETE` in a function body runs; a query with two is
held. The Supabase connector asks for a confirmation on destructive statements, and a cloud session
cannot show it. `close_scan` holds four and `close_round` two, so neither file can pass.

- **The SQL is not reshaped to pass.** Splitting a function's deletes or hiding the keyword would dodge a
  control (CLAUDE.md: when a tool refuses).
- **The owner runs a generated script** in the SQL editor of `tgxjbshdjwoemsmrtkzw`.
  `scripts/qa/editor-script.mjs` writes it: one transaction, the committed files verbatim, each history
  row as `apply_migration` writes it, a guard that refuses another project or a second run, and the
  firewall last.
- **Rehearsed first, verified after.** The script runs on a local database built to the migration
  before, and the suites pass on the result. On hosted afterwards: `list_migrations`, each file's md5,
  the firewall and the security advisor.

## D-23 — A local Data API for the flows in a cloud session (M3)

A cloud session has PostgreSQL (D-07) but no PostgREST, so a page that reads the database could not run
there. `scripts/qa/local-api.sh` puts PostgREST v12.2.3 in front of the local database, the way Supabase
does: the `authenticator` role, an anon key signed for the run, the schemas of `supabase/config.toml`, and
Supabase's `/rest/v1` prefix (`scripts/qa/local-api-proxy.mjs`). The binary is downloaded once and checked
against its SHA-256. There is no Auth service, so sign-in flows still need CI's real Supabase. It never
touches a hosted project.

## D-24 — The landing page, the scan and the personal view (M3)

Handoff 6.1 to 6.3 with section 11's corrections. Where the build differs from the design, and why:

- **The first heading says "leadership team assessment"** (handoff section 5). It is the heading's first
  line, small, above the design's headline; the page title starts with it.
- **The menu lists only pages that exist.** Leadership Team Scan now; Leader Profile and Sign in join with
  milestones 7 and 4, so no link leads nowhere. Research, Templates, For coaches and the demo group are not
  built (section 11).
- **Two trust lines changed.** "Built on meta-analytic research" is not stated in the handoff, so the line
  is the handoff's own label: "Research-based, not yet validated". "Counts only, never who answered" is
  "Counts only, never names" (section 10).
- **"Read it together"** says the team view opens when the scan closes, not at 4 answers (section 11).
- **The sample card** keeps the design's figures, labelled Sample. Its theme names come from the published
  scan, so a renamed theme is renamed there too. The question count comes from the scan as well.
- **The personal view leaves out "You rate highest / lowest".** Handoff 6.3 lists what the view shows, and
  these boxes are not in it. With tied scores, as in the design's six 3.0s, they name a theme for no
  reason. The owner can ask for them.
- **The personal view is one 560 px column** until milestone 4 adds the save card beside it (email, group
  name and size), which signs the leader in. A form that cannot submit is not built ahead of it.
- **Every score is labelled.** "Each score is indicative: the mean of two questions" and "Research-based, not
  yet validated · scale 1–5" sit under the six themes; a screen reader hears "indicative" with each level.
- **A draft lives 7 days from its last save,** in one localStorage record. A draft for another version of
  the scan is dropped, and an unreadable one is removed. Where the device refuses storage, the scan works
  for the visit and does not resume.
- **The question is the page's heading.** Focus moves to it when the question changes, and the options are
  a radio group labelled by it.
- **Two states the design does not draw:** the scan cannot be read ("not available right now"), and the
  personal view is opened on a device with no finished scan.
- **The footer** with the privacy and data-processing links is on every public page. Both pages say their
  text is not written yet, with `TODO(owner)` in the code.
- **`/` redirects to the landing page** (307, while the name is not cleared). D-09's holding page is gone.
- **Two colours from the design became tokens:** `--step-teal` (`#c3e1e6`) and `--step-yellow` (`#fdea8a`),
  the step tiles; their text passes 4.5:1. `--white-veil` is the facts pill's 75% white.

## D-25 — The hosted Data API must expose `app` (M3, deployment; applied, see D-28)

Every table and reader is in the `app` schema, and `supabase/config.toml` exposes it locally and in CI.
The hosted project still exposes only `public` and `graphql_public`, so the deployed scan says it is not
available until `app` is added: Supabase, Project Settings, Data API, Exposed schemas. The Supabase MCP
has no tool for this setting, and the Management API token does not reach this session (D-10). Exposing
the schema opens nothing by itself: row-level security and grants decide what a role reads, and the
answer tables have neither.


## D-26 — The mail sender: post@leaderpact.com (owner, 12 October 2026)

The owner's answer to D3's open part: `MAIL_FROM` and the reply-to address are both
`post@leaderpact.com`, on the same Brevo account as Orgpuls with a verified LeaderPact sender domain (D3).
The sender's name is `PRODUCT_NAME`.

- **Sign-in mail** goes through Supabase Auth, with Brevo's SMTP relay as its custom SMTP and
  `post@leaderpact.com` as the sender (`scripts/hosted/auth-config.mjs`). Auth sets no reply-to of its own,
  so a reply goes to the sender, which is the address D3 names.
- **The outbox mail** (invitations and reminders, milestones 10 and 16) will send from and reply to the same
  address through Brevo's API.
- **Not yet in place:** the relay's login and key (`BREVO_SMTP_LOGIN`, `BREVO_SMTP_KEY`) are not in this
  environment, and the domain's verification in Brevo is the owner's. Until both exist, hosted sign-in mail
  uses Supabase's built-in mailer, which sends only a few mails an hour (D-28).

## D-27 — Sign-in, the group, the invite link and members' answers (M4)

Handoff 6.3 to 6.5 and section 8's Authentication, with the owner's C1, C2 and C4. Where the build chose,
and why:

- **An account is made only from the save card.** `signInWithOtp` may create a user only when the personal
  view's save card asks (REUSE 4.15). The sign-in page never creates one, and it says the same thing whether
  or not an address has an account: "if it has an account, a link is on its way".
- **The link opens a page; a button signs in.** `/auth/confirm` verifies the token on a POST, so a mail
  scanner that opens the link does not use it up (REUSE 4.15). Both mails carry the same link, back to
  `emailRedirectTo` with the token (`supabase/templates`); a token that lands on `/` is passed on.
- **No return address in the link.** After sign-in everyone lands on `/app/new`, and the device decides. With
  the save card's group on it, the group is made and the leader's answers go to its scan. Without, the
  person's group opens, or the form to make one. Only the device holds the answers (D-15), so only the device
  can finish the save.
- **The session cookie lasts 30 days** from the last visit. `@supabase/ssr` writes 400 days and ignores a
  shorter `maxAge`, so the cap is applied where the cookies are written (`lib/supabase/cookies.ts`). A hard
  limit from sign-in is the paid plan's time-box (A2).
- **`start_group` (0009)** makes the organisation, the group, the leader's membership and the scan in one
  transaction, and returns the group and the link's code. It writes no answer: the leader's answers go
  through `submit_scan` like every member's, so the scan keeps one write path (invariant 4, owner C4).
  - **A new organisation per group**, named after it. Free is one group (handoff 1), and an existing person
    who saves another scan adds a group (6.3). Milestone 8 brings plans and may join them.
  - **A random request id** makes a repeated start return the first group. It is kept in the audit row,
    which records the start anyway, and starts by one person are serialised.
  - **The display name** is the part of the email before the @, until Settings lets the person set one:
    `person` needs a name and the save card asks for none.
- **Every scan submission is made as a visitor.** The server action calls `submit_scan` with the anon
  client, the leader's included, so the request that writes answers carries no user id. The residual owner
  C3 names, the request's time, remains.
- **The link's page reads the group's name** (`get_scan_invite`), so a member knows which group asks. It
  also returns the version to answer, so a member answers the version the scan was opened on.
- **The invite page is `/app/[group]/invite`**, the design's `invite` screen, until Home (milestone 6)
  carries the scan status card. Its bar holds the logo and Sign out only (D-24's rule: no link to a page
  that does not exist). Section 11's corrections apply: the count and the closing date, no countdown to 4,
  and no word about reminders, which are not sent yet.
- **The invite link's pages have a bar with the logo only.** The public menu's "Start the scan" would lead a
  member to a different scan from the one they were sent.
- **The member's flow** is intro, questions, personal view, then "Submit anonymously". After submitting, the
  device keeps only the replace key; coming back shows "your answers are in" with "Answer again", which
  replaces them (owner C2). The intro lists how answers are kept, as 6.5 asks.
- **The save card starts at 8 members**, the design's value; the stepper and the field take 4 to 15, and the
  hint says a group of 3 or fewer gets no team view (6.6).
- **Sign in** sits in the public header from 768 px, where the design puts it, and in the footer at every
  width: below 768 px the logo, Sign in and "Start the scan" do not fit in 360 px.
- **A closed scan says so** on both pages, with the count; the team view and its three states are
  milestone 5.
- **Dates are written in UTC** until a person's time zone exists (Settings), as everywhere else.
- **Rate limits wait for milestone 16:** 5 sign-in links per address per hour, and 60 scan submissions per
  address per hour. Until then Auth's own project-wide mail limit applies (30 an hour locally and with
  custom SMTP).
- **Two design colours became tokens:** `--ink-raised` (`#2a2a2a`), the save card's gradient start (D-14).
  On that ink card the focus outline is white (`.on-ink`), since the ink one would not show.
- **A local Auth lookup for cloud sessions** (extends D-23). `scripts/qa/local-api-proxy.mjs` answers
  `GET /auth/v1/user` for tokens signed with the run's own secret, and a flow mints such a session
  (`tests/e2e/support/session.ts`). It signs nobody in and never touches a hosted project; real sign-in by
  email link runs in CI, where the leader's flow reads the link from Mailpit.
- **The fixture** (D-20) is `scripts/seed/fixture.mjs`: Lumio AS and its group of 8 led by Kari Nordmann,
  an open scan with Kari's answers written through `submit_scan`, and with `--e2e` one group per Playwright
  project and a flow leader with no group. Addresses are on `lumio.example`. It refuses any database not on
  127.0.0.1 or localhost. Solving the answers for the design's figures is milestone 5's.

## D-28 — The hosted project's configuration, 12 October 2026 (deployment)

The owner asked for two settings on `tgxjbshdjwoemsmrtkzw` through the Management API, with the network
secret "Supabase LeaderPact".

- **The Management API refused the injected credential.** Every call, read or write, answered
  `401 JWT could not be decoded`. The Vercel API answered `403 missing authentication token` with its own
  injected secret. Neither is the owner saying no; the credentials did not arrive in a form the APIs read.
- **`app` is exposed, by SQL.** Supabase documents the same setting as a role setting:
  `alter role authenticator set pgrst.db_schemas = 'public, graphql_public, app'`, then
  `notify pgrst, 'reload config'`. It ran through the MCP's `execute_sql` on `tgxjbshdjwoemsmrtkzw` (SQL is
  always allowed, D-21). An anon read of `app.instrument_version` and of the scan's items then answered 200.
  The dashboard's "Exposed schemas" no longer manages the list while the role setting stands; resetting it
  is `alter role authenticator reset pgrst.db_schemas`.
- **The live `/scan` still said it was not available.** The project's API log showed no request from the
  deployment at all, ever: the Vercel build has no `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or was built before they were set. Both are inlined at build time.
- **The Auth settings of D-10 are not applied.** No other route sets them: Auth's configuration is not in
  the database. `scripts/hosted/auth-config.mjs` holds them (the 15-minute link, the redirect addresses, the
  two mails, and with Brevo's relay key the sender of D-26) and applies them once the Management API takes
  a token: `NODE_USE_ENV_PROXY=1 node scripts/hosted/auth-config.mjs --site https://leaderpact.vercel.app --apply`.
  Until then hosted links last Supabase's default hour, return to its default site address, and go out
  through its built-in mailer.
