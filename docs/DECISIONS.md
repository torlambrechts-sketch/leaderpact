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
- **Update, 13 October 2026.** The owner set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  in Vercel for Production and redeployed; the live `/scan` then read the scan from the hosted project. With
  the Vercel secret now working, both were extended to Preview, as the README's environments table says
  (targets only; the values were not read). Migration 0009 was applied to hosted before #7 merged. The
  Management API still answers `401 JWT could not be decoded`, so the Auth settings above still wait.

## D-29 — The scan's close and the team view (M5)

Handoff 6.6 and section 7's "When results open", with section 11's corrections. Where the build chose:

- **The scheduled close** is `app.close_due_scans()` (0010): every five minutes pg_cron hands each open scan
  past its date to `close_scan`, which alone decides (snapshot and reshuffle, one extension, or no team
  view). A scan an answer has locked is taken on the next run. The migration creates pg_cron where it exists
  (hosted and CI); the local PostgreSQL has none, and the suites call the function themselves. No client
  may run it, and the leader cannot close early (6.4).
- **Where the team view is.** At the link, `/j/[code]`, once the scan has closed (handoff section 5), for
  everyone with the link at the same moment. For a group's members at `/app/[group]/team` (design `team`),
  reached from the invite page's "The team view is open", until Home carries it (milestone 6).
- **The three states.**
  - Open: the count and the closing date only. Section 11 removes the design's "3 more answers needed".
  - Closed with 4 or more: the levels and labels computed once at close, with a line that says so.
  - Closed with fewer: a page that says no team view was made, that the answers were deleted, and why: a
    team view needs at least 4 answers so that no one's answers can be seen.
  - Between the date and the job's next run, the link says the scan has closed and shows nothing more.
- **"You agree on" and "Your views differ most on" come from the labels alone.** The first lists the themes
  labelled high agreement, highest level first. The second lists the themes whose views differ. When none
  qualifies, the card says so. The design picks the theme with the lowest agreement number, but no reader
  returns that number, and an order by it would show what the label exists to hide (handoff 7).
- **The plan card.** The leader sees what the Team plan adds and its price from the plan rows
  (`lib/plans/load.ts`), without the Upgrade button: the checkout is milestone 8, and no button leads to a
  page that does not exist (D-24). Everyone else sees "Ask your team leader to upgrade" (6.19). The link
  cannot tell who reads it, so it always shows the member's card.
- **The fixture's three flow groups** (`--e2e`), each led by the flow leader: released from four answer sets
  chosen so that every label appears, extended once, and closed with no team view. Deadlines pass through
  `close_scan`, with only the closing date moved back, as the suites do. Lumio's own scan stays open at 1 of
  8, the state the design's Home and invite screens draw; solving answers for the design's team-view
  figures waits until a screen compares against them.

## D-30 — The app shell, Home on the Free plan and the sample pages (M6)

Handoff sections 4 and 5, 6.7 and 6.19, with section 11's corrections. Where the build chose:

- **The shell lists the pages that exist.** Home, Group, People, Assess, Results, Plan and Meetings. Me
  waits for the Leader Profile (milestone 7), and the gear for Settings (milestones 8 and 16). The plan pill
  says "Free plan" and links nowhere until plan and billing exist (milestone 8). The avatar opens a menu
  with the person's name and Sign out. Every group is on the Free plan until plans exist. `/app` opens the
  person's first group's Home; `/app/[group]` is that Home too.
- **The greeting has no name.** Until a person sets one, the stored name is the start of their email
  address (0009), and "Good morning, kari.nordmann." reads as a mistake. The date and the time of day are
  the device's, put in once the page runs in the browser, since the server does not know the reader's
  clock. The status line is the plan's limit, said once: "Free plan · latest scan only, no history".
- **"Needs you" on the Free plan** has two rows while the scan is open: answer the scan, and share the link.
  Whether a person has answered is known only to their device, by the replace key the link left there (C2);
  nothing on the server says who answered, so a person who answered on another device still sees the row.
  The Leader Profile's row comes with milestone 7. When nothing is open, the card says nothing needs you.
- **The scan card** says the closing date once, with the count and the dots (section 11). "Where we stand"
  appears only once the team view is open, from the same snapshot as the team view page; while the scan is
  open the design's empty bars would show the shape of a result that does not exist yet.
- **No Upgrade button yet.** Handoff 6.19 gives the leader an Upgrade button; the checkout is milestone 8,
  and no button leads to a page that does not exist (D-24, D-29). The leader sees the price from the plan
  rows; a member is asked to ask their team leader, with no price. The button comes with the checkout.
- **The sample content is a data file**, `data/sample/lumio.v1.json`, parsed with `lib/sample/schema.ts`.
  The tables it stands for arrive in milestones 9 to 15; when they exist, the samples come from the demo
  organisation's rows instead (REUSE 4.12) and the file goes. Its content is the design's Lumio group with
  section 11's corrections. Scale names, layers, reading types and evidence ratings come from the bank
  file the seed loads, and standing and change come from `lib/scoring` with the version 1 cut-offs. Every
  change in the sample is within normal variation, so none shows as a number.
- **What each sample leaves out** (section 11): the coach card, composition, the agenda time per task and
  counts of tasks or actions per member; the team map, person pages and contribution feedback; the six
  phases, the library, schedule and coverage tabs and the team-leader feedback round; the dots per answer,
  SD, the agreement number, the matrix, the radar, the results session and the plan column; initiatives,
  milestones, targets and practices; the meeting series, check-in, decision and audit tabs, and pre-read
  flags. A shared Leader Profile shows its sharing level only: its scores need the items and the norm
  table, which are not supplied (6.17).
- **The fixture's members take the design's names** (Sofie Lie, Erik Dahl, Maja Strand, Henrik Bakke in
  place of four invented ones), so the sample and the fixture are one group. The fixture is local only, so
  no hosted row changes.
- **Each flow signs in a person of its own.** Auth sends one address one link per interval, so the leader's
  and a member's checks run at 1280 px, and two other members check the phones.

## D-31 — The Leader Profile's bands are equal thirds of the answer scale (owner, 13 October 2026)

Handoff 6.17 and section 9 ("Ask before choosing them"). The owner chose equal thirds of the 1 to 5 answer
scale for "lower", "middle" and "higher": a trait's mean below 2.33 is lower, above 3.67 is higher, and the
rest is middle. The limits are a versioned row (`app.profile_band_set`, version 1), and a profile keeps
the version it was made with. The bands against a norm group wait for the norm table (section 9), and are
asked again then.

## D-32 — The Leader Profile (M7)

Handoff 6.17, 8 and 9, CLAUDE.md invariant 11. Where the build chose:

- **The items were read from the sources, not written from memory** (handoff 9). The full test is the
  IPIP-NEO-120 as published at ipip.ori.org (facet names, keys and wording), in the administration order of
  the open-source set the handoff names (Alheimsins, commit 493546d), and every one of the 120 items was
  checked against both: wording, facet and key. The domain names come from the IPIP's NEO domains page.
  The quick test is the Mini-IPIP from its IPIP scoring key, with the key's own labels ("Surgency or
  extraversion", "Intellect or imagination"). The key gives no order, so its items are asked round robin
  across the five factors, so that no two items of one factor follow each other. Both are public domain;
  the public page credits the IPIP. The data files keep their sources.
- **Item wording is verbatim**, so it keeps the source's American spelling ("Sympathize") and its sentence
  fragments; the copy rules apply to the product's own words, not to a published instrument's items.
  The answer options are the source's, in sentence case.
- **One profile per person: the latest test taken.** A retake of either length replaces it and resets
  every share to nothing, in one transaction. A quick profile shared "domains and facets" shows domains,
  since it has none.
- **Only sums are stored.** `save_profile` takes the full set of answers, checks them, and keeps per trait
  the sum of the keyed answers and their count. The answers are not stored, so nobody, the owner included,
  can read them back. The device shows the result before anything is sent (lib/profile/score.ts), and the
  database computes the same sums; the SQL suite and the unit tests hold the same cases.
- **Sharing is per group**, readable and settable by its owner only, and applies at once. A group reads a
  shared profile through `get_group_profiles`, as bands only: never a sum, a count or a position. A
  profile that is not shared and a member with no profile read the same, "Not shared", so the group cannot
  tell whether one exists.
- **Delete is immediate**, within the 30 days handoff 8 allows: the profile and its shares, with an audit
  row that carries nothing but the kind.
- **The quick and full results show a position on the answer scale** in the three bands of D-31, and say
  that no norm group is used, until the norm table exists. The owner sees a dot for their mean; a group
  sees only the band.
- **A visitor keeps a result by email sign-in.** The answers wait on the device (7 days) and Me saves
  them once the link is opened there; sign-in may make an account for this (`intent: 'profile'`). Drafts
  resume for 30 days, since the full test is 120 questions. Every key starts `leaderpact.profile.`, so
  nothing is shared with the scan's.
- **People is real on the Free plan.** The Leader Profile is free (handoff 1), and a share needs a place to
  be read, so People lists the group's current members with their shared profiles (handoff 6.9) instead of
  a sample. Me joins the navigation, and Home's "Needs you" offers the quick test while the person has no
  profile. After sign-in, a person with a group now lands on Home.
- **Left out of Me**: the design's team map, conversation prompt, modules, contribution feedback and the
  per-domain descriptions, which no source supplies. The person's actions and open questionnaires join
  Me when they exist (milestones 10 and 12).
- **Hosted, through the owner's SQL editor** (D-22). `apply_migration` held 0011 and timed out with
  nothing applied, so the owner runs the script `scripts/qa/editor-script.mjs 0011_profile 0012_profile_v1`
  makes. It was rehearsed on a local database built to 0010: both files applied in one transaction, the
  firewall six of six, every suite passing, the history hashes matching the files, a second run refused.
  The code merges once hosted carries both (the deployment playbook: database first).
- **Open for the owner: the political facet.** Facet O6, Liberalism, is scored from four items about
  voting and politics ("Tend to vote for liberal political candidates"). Its band reveals a political
  opinion, a special category of personal data under the GDPR, and "domains and facets" would show it to a
  group. The handoff asks for the IPIP-NEO-120 as published, so it is built as published; whether to keep,
  drop or withhold this facet from sharing is the owner's decision before launch.

## D-33 — Plans and checkout (M8)

Handoff 1, 3, 6.18, 6.19 and 11; REUSE 4.9; owner D1, D2a, D2b, D2c. Where the build chose:

- **Billed per group, as rows.** A group with no `app.subscription` row is on the Free plan. Upgrading
  writes the row and nothing else, so the group, its members, its scan and the Leader Profile shares carry
  over as they are (handoff 6.18). The price is read from `plan_price` at checkout and stored on the
  subscription with its version, so a later price change does not alter a plan already bought.
- **One access function** (`group_access`): free, trial, team, grace or read_only. `group_writable` and
  `plan_allows` are internal, not client entry points; milestone 9 on asks them in every group write.
  Read-only reads everything and writes nothing of the Team plan's; the Free features (the scan, its
  invite link, the Leader Profile) stay open, as on Free.
- **The trial (owner D2a): 14 days, once per group**, started by the leader with no billing details.
  Its length is a fixed setting row, `trial_days`. A group that has had a trial or a subscription has no
  second one. Unpaid at its end, the group is on Free and its Team data is kept for the organisation's
  retention, then deleted (the deletion job is milestone 16). Buying during the trial ends it; the paid
  period starts on payment. The trial-ending mail is milestone 16's notifications, and the
  `billing.changed` fields are milestone 17's.
- **Grace and read-only** (handoff 6.18). A failed renewal ends the paid period and opens 7 days' grace
  (`payment_grace_days()`, a fixed rule like the threshold's floor). After it, read-only until a payment
  arrives. Every page of the group says so, to every member; only the leader's notice links to Plan and
  billing. A cancel keeps the plan to the end of the paid period, or ends it at once while a payment is
  owed, and sets the deletion date from the retention setting. It can be withdrawn before it takes effect.
- **No payment vendor** (handoff 3, owner D1). Checkouts go through a `PaymentProvider` with two adapters,
  chosen by the database (`app.payment_adapter`): `none`, the hosted value, where a checkout can never be
  paid and the review says payment is not connected; and `development`, which the fixture sets in a local
  or CI database, and which pays or fails on demand. With it the leader can also make a renewal fail, the
  grace end, a payment arrive and a trial end, so every state can be seen and tested. The functions refuse
  those events unless the database runs that adapter.
- **Tax is the provider's** (owner D2c; handoff 11: no "VAT 25%"). The checkout takes the company's
  country and says tax follows it; no rate or total with tax is shown. No card number is shown (handoff
  11): a vendor brings its own form.
- **No invoice list.** The design lists invoices; none exists until a vendor makes one, so Plan and billing
  shows the billing details only (CLAUDE.md: never fabricate data).
- **Settings has one tab so far**, Plan and billing, in the spec's vertical menu. Account, Group,
  Notifications and Privacy follow with their milestones; the shell lists only pages that exist. The gear
  and the plan pill now lead there. The pill reads Free plan, Team trial, Team plan or Read-only.
- **A member sees no price anywhere** (handoff 6.19, D-30): Plan and billing shows a member the plans'
  contents and the group's state, never a price or the billing details. Row-level security keeps the
  details to the leader.
- **Upgrade buttons** (supersedes D-30's "no button"): the leader's sample banner, Home's Team plan card
  and the team view lead to the checkout. With the Team plan or its trial the paid areas are still samples
  until their milestones build them, and their banner says so; Home drops the Team plan card.
- **The plan list leaves out the Organisation plan**, which is not in the MVP (handoff 1), and lists
  meetings (handoff 11). The design's Done step names a receipt and next steps that do not exist yet; the
  built step says what carried over.
- **Hosted:** 0013 has no `DELETE` or `DROP` statement, so it goes through `apply_migration`. If the
  connector holds it, the owner's script follows D-22.

## D-34 — The public site: articles, search and answer engines (owner, 13 October 2026)

The owner asked for SEO and GEO, "a large set of relevant articles", free downloads behind an e-mail address
and pages that describe the platform, to Orgpuls's standard. Handoff section 2 had the public site's Research,
Templates and comparison pages in Phase 2; the owner's request brings them forward. The plan, the keyword map
and the article list are `docs/marketing/seo-geo-strategy.md`; the editorial standard is
`docs/marketing/editorial-brief.md`.

- **Twenty articles planned, ten published** under `/articles`. They inform and sell nothing (Orgpuls D-235):
  no product, price, offer or sign-up, and links in the text only to other articles. The rules are code
  (`lib/site/article-content.ts`) and the unit tests hold every article to them, with the copy rules of
  handoff section 10. Five writers wrote them, each source checked against Crossref or the publisher;
  independent fact-checkers then checked every claim against its source.
- **Words are data, not messages.** An article is `data/articles/<slug>.json`, parsed by Zod, as the sample
  content is (D-30): long prose in an ICU catalogue is fragile. The sources are bibliographic records written
  as the source writes itself, so they are not held to British spelling.
- **Search plumbing:** a canonical address, Open Graph and Twitter data and a share card for every public
  page (`scripts/seo/og-images.mjs`); JSON-LD (Organization, WebSite, SoftwareApplication, Article with
  `citation`, FAQPage, BreadcrumbList, CollectionPage); `/sitemap.xml`, `/robots.txt` and `/llms.txt` from the
  registries. The menu gains How it works and Articles from 1024 px; the footer lists every page.
- **Not indexed yet.** Every page still says `noindex` (D-09): the name is not cleared (handoff section 0).
  Switching indexing on is the owner's decision, made in one line (`app/layout.tsx`). With it come an
  `X-Robots-Tag: noindex` on every host but `www.leaderpact.com` and an IndexNow key. An attempt to make both
  changes in this session was stopped by the session's safety check and left for the owner.
- **The questionnaires, the result, sign-in, the invite link and the app** say `noindex` themselves, so the
  switch can never index them.

## D-35 — Sentral by API: one door for every product (owner's E2)

LeaderPact sends Sentral two kinds of event now, before milestone 17 brings the lifecycle events:
`template.requested` (a reader's request for a free template) and `content.inventory` (the public site's
pages and the searches they answer). Neither carries product data, an answer or a respondent.

- **The door is Sentral's `product-events`** (its 0090), built for any product as the owner chose in E2: the
  body names the product, the headers are `x-platform-product`, `x-platform-timestamp` and
  `x-platform-signature` (HMAC-SHA256 of `<timestamp>.<body>` under the product's own webhook secret), and the
  signature is checked before the body is read.
- **The builder refuses any field its kind does not list** (`lib/platform/sentral.ts`, invariant 12), and a
  unit test proves no answer, score, standing, comment, profile or participation can leave.
- **LeaderPact holds one shared secret, `PLATFORM_WEBHOOK_SECRET`, in the server's environment**, and no key to
  Sentral's database; Sentral holds none to LeaderPact's. CLAUDE.md's "never touch those projects from this
  repository" is about database credentials and the MCP; this signed API is the connection handoff A.3 asks
  for. With no secret set, development sends nothing and says so; production treats that as a failure.

## D-36 — The content inventory in Sentral's Growth › SEO

`lib/site/inventory.ts` builds the keyword map as data: every public page, its searches (the first is the one
it answers; the tests refuse a search that is the first of two pages) and whether it is live or planned.
`scripts/platform/publish-content.mjs` sends it, and `.github/workflows/content.yml` runs that on every push to
main that changes the site's content, once the owner adds the repository secrets `PLATFORM_EVENTS_URL` and
`PLATFORM_WEBHOOK_SECRET`. Sentral files each page's first search as a content-plan row (an idea while
planned, published with its path once live), tracks every search as a keyword, and logs a page's first
publication. It never moves a stage back and never deletes.

## D-37 — Free templates behind an e-mail address (after Orgpuls D-241)

Two Word templates, a leadership team charter and a meeting agenda, built by `scripts/templates/build.py` from
what the articles say, kept in `private/templates` and served only to a browser whose cookie names the template.
A soft gate, on purpose: the point is the address the person chose to give.

- **The form:** name and address, organisation and role if wanted, an unticked box for e-mail about new
  templates and articles, and a field only bots fill (it answers as if it worked and sends nothing).
- **The request goes to Sentral** as `template.requested` and becomes a Sales ticket and a CRM lead there.
  LeaderPact stores nothing but the cookie. Sentral takes five requests an hour from one address and two
  hundred from the product; above that the form says to try again later.
- **TODO(owner): the privacy page** must describe template requests (what is kept, where, how long, the legal
  basis and the e-mail consent). The legal text is the owner's; Orgpuls's statement has a section to adapt.

## D-38 — Product pages: only what is true today

`/platform`, `/research`, `/anonymity` and `/leadership-team-assessment-tools` describe the product. They may
name it and offer the scan; every claim is one the product enforces today or is marked "In development".

- **How it works** lists the loop's nine steps. Four are available (the scan, the invite, the team view, the
  Leader Profile); five carry "In development" until their milestones ship, and a test holds the list.
- **No prices.** The Team plan and its trial exist (D-33), but the hosted payment adapter is `none`, so it
  cannot be paid for and its areas are still samples. No public page states a price, the SoftwareApplication
  data carries no offer, and the pages say the Team plan's areas are in development.
- **Research reads the published bank** (`data/instrument/bank.v1.json`): every scale's layer, how it is read
  and its evidence rating, never an item. "Research-based, not yet validated" stands on it.
- **Anonymity states what the database enforces** and was checked against the migrations: no person or time on
  an answer set, no reading rights for any role, the threshold of 4, nothing before close, the reshuffle at
  close, the cap and the deleted replace key on the open scan link.
- **The company behind the product** is not named in the Organization data until the owner gives its legal
  name and registration (`PUBLISHER`, `TODO(owner)`).

## D-39 — The public site's visits are counted in Sentral (owner, 14 October 2026)

The owner registered the site with Google and asked for its visits to go to Sentral. They are counted the way
Orgpuls's are (its D-248): a cookieless beacon (`lib/site/beacon.ts`, `components/site/SiteBeacon.tsx`) posts to
Sentral's `web-collect`, which knows leaderpact.com as a registered site (its 0090), drops bots, hashes the
address and the browser string with a key that changes every day, and stores neither.

- **What is sent:** a page view (the path, the five utm_ campaign tags of the address, and the referring host once
  per page load), a press on a link to the scan (`start-scan`), and a template asked for (`template`). Never a
  query string, a name, an address or an answer (invariant 10).
- **Never counted:** the scan and its result, the invite link (/j), the Leader Profile's tests, sign-in and its
  confirmation, the app, a template's file. Nothing about an answer leaves for Sentral (invariant 12), not even
  that someone was answering. Also never from a browser that sends Global Privacy Control or Do Not Track, or
  from a host other than leaderpact.com and www.leaderpact.com. The unit tests hold every path.
- **Nothing is stored on the device**, so there is nothing to ask consent for under the cookie rules; the
  `connect-src` of the CSP names Sentral's origin for it.
- **TODO(owner): the privacy page** should say that visits are counted this way, alongside the template
  requests (D-37).
- **Search Console:** Sentral imports a site's figures once its service account can read the property. Add
  `orgpuls-search-console@orgpuls-seo.iam.gserviceaccount.com` as a user (restricted is enough) on the
  leaderpact.com property; the nightly import then finds it.

## D-40 — The public site is indexed (owner, 14 October 2026)

The owner asked for indexing to start. This supersedes D-34's "Not indexed yet" and the root layout's noindex
from D-09.

- **The root layout says `index, follow`.** The pages that must never be found keep their own `noindex`: the
  scan and its result, the Leader Profile's tests, sign-in and its confirmation, the invite link, the app, the
  privacy and data-processing drafts. A template's file says it in a header. `robots.txt` also disallows the
  private paths.
- **Only `www.leaderpact.com` is indexed.** Every other host (leaderpact.vercel.app, a preview, a local server)
  answers with `X-Robots-Tag: noindex` (`next.config.ts`), so no copy of the site competes with it.
  `leaderpact.com` redirects to `www` at Vercel.
- **An e2e test holds it** (`tests/e2e/site.spec.ts`): the public pages say index, the private ones noindex,
  and a host that is not production sends the header.
- **No IndexNow.** Google does not use it. The sitemap in Search Console is how Google learns the pages.
- **Search Console is the owner's:** verify the domain, submit `https://www.leaderpact.com/sitemap.xml`, and
  add Sentral's service account (D-39).

## D-41 — Articles draw their argument: figures, charts and a drawing each (owner, 14 October 2026)

The owner asked for the articles to be as visual as Orgpuls's: our own illustrations, and tables, graphs and other
elements. After Orgpuls D-237.

- **Fourteen figure kinds** in `lib/site/blocks.ts`, drawn by `components/site/Figures.tsx`: steps, flow, pyramid,
  pillars, matrix, compare, fork, rings, cycle, stats, bars, timebar, spread and specimen. Cards may be numbered.
  The words are data in the article's file and keep the copy rules; the drawing is CSS in the site's tokens.
- **Every number says where it comes from.** A chart needs a `basis`: one of the article's sources, arithmetic
  written out, or an example the text sets out, which the figure marks "Example". A charter or agenda item filled
  in for illustration is marked "Sample" or "Example". No figure states a number the text and its sources do not.
  Every figure drawn from a source cites it, linked to that source in the numbered list.
- **The rule is code.** `articleProblems` refuses an article with fewer than two figures, a citation the list does
  not hold, a time bar's kind it does not name and a share over 100 per cent. A page with no sources may cite none.
- **Accessible at every width.** Every word a figure shows is text. Where a drawing repeats a list (the cycle, the
  rings, the time bar, the small pyramid on a phone), the drawing is hidden from screen readers. Under 768 px every
  figure is one column. axe runs on three figure-heavy articles at 1280, 390 and 360 px.
- **A drawing for each article** (`components/site/art/ArticleArt.tsx`), chosen by its `art` in
  `lib/site/articles.ts`: beside the title from 1024 px, and on its card in the index and under "Read next".
  Decorative, so hidden from screen readers. The colours are the tokens, transcribed.
- **The ten articles** each gained two to four figures, drawn from their own text: for example, Lencioni's pyramid,
  Edmondson's safety and standards matrix, the pairs of members by team size, and the example agenda's minutes.
  Several lists became step figures with the same words.

## D-42 — The group: charter versions and members (M9)

Handoff 6.8, 8 and 9; milestone 9: "A draft does not change the version in force until the group agrees."
Where the build chose:

- **The draft is stored, not kept in the browser.** The design says "The draft stays in your browser until
  the group agrees it". A stored draft survives a closed tab, and the group can read it before it agrees,
  which the agreement needs. It never touches the version in force: the suite proves it for the leader and
  a member (check 8), and so does the e2e flow.
- **"The group agrees · put in force" is the leader's.** The leader records that the group agreed
  (handoff 6.8: "The leader drafts"); there is no vote. The draft becomes the next numbered version, the one
  before is superseded, and the event is audited with ids only. All three parts are needed: a purpose, a team
  task and a working agreement.
- **An agreed version never changes**, nor do its tasks and agreements, and versions move forward only.
  Earlier versions open read-only at `?version=n`. A discarded draft keeps its row, marked discarded.
- **Decision rights are Decide, Advise and Inform**, the design's three. Tasks carry no owner: the handoff
  does not ask for one and the design's editor has none. The design's agenda time per task waits for the
  task match (milestone 13).
- **The template holds the three parts' limits** (version 1: 12 tasks, 12 agreements, a purpose of 600
  characters and 200 per item), as a versioned row. The limits are this build's choice; the handoff gives
  none, and it gives no template wording, so a first draft starts with empty parts.
- **Members join by an invitation link.** No product mail exists until the outbox (milestone 16, D-26), so
  "Add and invite" gives the leader a link to send. It works once, for the one address the leader entered,
  for `invitation_days` (14, this build's choice). Only the token's SHA-256 is kept. The link's page never
  shows the address; a sign-in link that may make an account goes only to the address the invitation names
  (`invitation_matches`), and joining checks the signed-in address again. A person new to the product is
  named as the leader invited them. Someone already in the group who opens the link goes to its Home.
- **Up to 15, invitations counted**, so a group cannot be overfilled by open links. A second invitation to
  the same address replaces the first, with a new link ("New link").
- **Removing a member and naming a leader are always open**, on any plan and when read-only: they take
  access away or hand it on. The charter and invitations are the Team plan's and stop when read-only
  (`team_plan_writable`); the suite checks from the catalogue that every client function writing them asks
  it. Naming a leader ends both memberships and starts new ones, so each keeps its dates.
- **Members see who is in the group; only the leader sees the open invitations.** No counts of tasks or
  actions per person (section 11). Invitations and membership changes are not audited: the handoff's audit
  list names neither, and `audit_event`'s kinds are fixed.
- **On the Free plan the Group page stays the sample** (handoff 6.19). The trial or the Team plan opens the
  group's own.
- **Nothing in 0014 deletes a row**: drafts, invitations and memberships keep theirs with a state and a
  date, and their group's removal takes them.

## D-43 — The diagnostic round: open, invite, answer, remind, close (M10)

Milestone 10 of handoff section 12: "Reminders go only to people who have not answered. Close computes scores
once." `0015_diagnostic` adds the leader's way to open a round, the reminders and the scheduled close to the
round engine of 0007; `supabase/tests/diagnostic_invariants.sql` (20 checks) proves both halves of the rule.

- **The leader opens it, and needs the threshold.** `open_diagnostic` opens the published Full diagnostic for
  the group's current leader alone, on the Team plan or its trial and not read-only (`team_plan_writable`
  and `plan_allows(…, 'diagnostic')`), one round answering at a time. It refuses a group with fewer current
  members than the organisation's threshold and says how many there are. REUSE 4.5 keeps 0073's rule that a
  group asked fewer than k people gets no count, and such a round can never release; owner C10's warning
  becomes a refusal for that reason. Every current member is invited by `open_round` (0007), with no picker.
- **The window is the setting's default, 14 days.** `diagnostic_window_days` is a row with a group range of
  7 to 30, but no table holds a group's own value yet, so every round takes the default. The rhythm (6
  months) schedules nothing yet: the leader opens each round.
- **A removed member keeps their place in the count** (owner C7, adapted). C7 says a leaver's participation
  row goes. Here it stays: `submit_response` now answers only current members, so a removed member answers
  no more, and the reminders pass them over. Removing the row would change the count, and so tell the group
  whether that person had answered; it would also be a deletion the connector holds (D-22). The denominator
  stays who was invited (C7). The cost: a round whose removed member never answered closes on its date
  rather than at 100%.
- **The questionnaire.** One question per screen in one mixed order per round, the same for every member and
  never grouped by scale (handoff 6.11: md5 of the round and the item). The scan and the diagnostic share one
  renderer, `components/respond/StatementFlow.tsx`, since they are one question kind (CLAUDE.md, Model as
  data). Next moves on without an answer; the review page lists the gaps, leads from gap to gap and waits for
  them before "Submit anonymously" (owner C8). Progress is kept on the device under a key for the round and
  the person, for as long as a round can be open (37 days), and removed on submit.
- **TODO(owner): the time to answer.** Handoff 6.11 asks the intro to say how long the 72 questions take. No
  figure exists in the handoff or the item bank, so the intro says the number of questions and no time.
- **Reminders without a person.** `round_reminder` holds one row per round and reminder day (`reminder_days`,
  3, 7 and 12, inside the window): when it is due and whether it went, never to whom. Who is reminded is
  decided when the dispatcher claims the row (`claim_reminders`, granted to `service_role` alone): the
  invited people who are still members and have not answered. A round that has closed, or that everyone has
  answered, is skipped. A sent reminder is audited with the round and the day only; a failure is claimed again
  and given up after five tries.
- **No reminder mail goes yet.** The dispatcher that sends it is the outbox's (milestone 16, D-26), with the
  quiet hours of REUSE 4.8. Until then the rows wait, and a due one for a closed round is skipped at its
  first claim. Nothing on screen promises a reminder. A reminder falls due at the opening's time of day.
- **The close.** pg_cron runs `close_due_rounds` every five minutes, as 0010 does for scans; the last
  answer still closes a round at once. `close_round` (0007) is unchanged: at or above k it writes the
  snapshot once and reshuffles; below k one 7-day extension, then no result and the answers deleted (C9).
- **The charter version in force is recorded on the round at its release,** by a trigger on
  `assessment_round`, and never changes after. `factor_score.charter_version_id` stays empty: writing it would
  mean redefining `close_round`, whose deletions the connector holds (D-22). The round's column is the
  snapshot's, and the results of milestone 11 read it there.
- **Reading.** `get_rounds` gives every current member the rounds with phase, dates and the count of
  answers ("5 of 8 answered"), and the caller's own state; `get_round_form` gives the questions only while
  the caller is asked and has yet to answer. Both read `participation` and join the firewall's reviewed list
  (0015 redefines `anonymity_firewall` with them; the rules are unchanged).
- **Assess and Home.** Assess is a plain list with four phases, the leader's "Open the Full diagnostic"
  (asked once more, since a round cannot be cancelled) and "Answer now" for a member asked. A released round
  says its result was computed at close; the results pages are milestone 11. Home's "Needs you" offers the
  Full diagnostic while it asks the person.
- **Not yet:** pilot groups' candidate items (owner D8) wait for Sentral's `modules.pilot` command (milestone
  17); pulses are milestone 15.
- **What remains outside the database.** When the dispatcher exists, the mail provider will see who is
  reminded on which day, as API logs see the time of each submission (owner C3's residuals).

## D-44 — An account without the scan, and the diagnostic's time to answer (owner, 14 October 2026)

The owner's words: "build in a way to register WITHOUT taking the test … it won't work for people who want to
test the system, mentors and others not part of the leadership group (HR for example)"; "time to answer, go
with scientific validated time recommendation"; on D-43's removed members, "your decision is fine".

- **`/sign-up` makes an account with an email link and no scan.** The sign-in page links to it ("No account
  yet? Create an account"), beside the scan, which still makes an account when its result is saved. The link
  may create the account (`intent: 'sign_up'`); the sign-in page's still never does, and still never says
  whether an address has one. Auth's own limits on links apply.
- **After the link, `/app/new` offers the ways in.** Making a group (the form, as before); joining one by its
  leader's invitation (milestone 9); the Leader Profile, which is the person's own. Someone trying the product
  makes a group of their own and may start its 14-day trial.
- **No new role.** A mentor or HR person who joins a group by invitation is a member of it, with a member's
  view: there is no observer role, and handoff 6.10 asks every current member in a round. An outside role is
  not in the handoff, and a rating of a person by outsiders is never built (CLAUDE.md invariant 13).
- **The diagnostic takes "about 10 minutes".** No peer-reviewed study gives a validated time per
  agree–disagree item, so the figure is built from what is measured:
  - The 72 statements hold 682 words (9.5 each). Adults read English non-fiction silently at 238 words a
    minute on average, most between 175 and 300 (Brysbaert, 2019, *Journal of Memory and Language* 109,
    104047; 190 studies, 18,573 readers). Reading takes 2.9 minutes, 3.9 at 175.
  - An attentive answer takes at least about 2 seconds an item (Huang, Curran, Keeney, Poposki and DeShon,
    2012, *Journal of Business and Psychology* 27, 99–114, the cut-off for insufficient effort). Answering
    adds at least 2.4 minutes.
  - So a careful reader at the slow end of the normal range needs at least about 6.5 minutes. Attitude
    questions take longer than factual ones (Yan and Tourangeau, 2008, *Applied Cognitive Psychology* 22,
    51–68), so the copy rounds up to "about 10 minutes". The figure is re-measured when pilot data exists.
  - It shows on the questionnaire's intro, the leader's card that opens a round, and Home's row.
- **D-43's removed members stand** as decided: the participation row stays, so the count never shows
  whether a removed member had answered.

## D-45 — Results in three depths (M11)

Milestone 11 of handoff section 12: "Every row shows level, agreement label and one standing. No forbidden
element appears." `supabase/tests/results_invariants.sql` (8 checks) proves it in the database, and
`tests/e2e/results.spec.ts` on the screens.

- **The snapshot is the only source.** The overview, a scale and its questions read `get_results` and
  `get_item_results` (0007), the firewall's reviewed readers: a current member, a released round, at or above
  its threshold. No new reader of an answer table. The suite checks from the catalogue that the two return
  exactly the columns a result may show, and that the agreement they return is the label.
- **Three depths, three pages:** `/results` (the newest released round, or one by `?round=`), a scale at
  `/results/[scale]`, and its questions at `/results/[scale]/items`. The overview shows the three outcomes
  first, marked self-rated, then the 21 scales by layer: scale, evidence chip, level, change, agreement label,
  standing. A scale's page adds its definition, the evidence behind its rating and the guidance. The questions
  page shows each question's text and its mean to one decimal, nothing else.
- **Change** shows only between two released rounds of the Full diagnostic, at the margin of the cut-offs in
  force when the later one closed (0.6 in version 1), and only for a scale whose questions were the same in
  both versions (owner C5, "Not comparable: the questions changed"). A first round shows "First round". It is
  worked out in the app from the two rounds' results and the versions' items, which members may read.
- **Definitions are rows** (`factor_text`, 0016), versioned like the item wording. Version 1 is the owner's
  design bundle's sentence per scale (`proto-core-v5.js`, `SDEF`): neither the handoff nor the item bank has
  definitions. The owner may reword them as a version 2.
- **Guidance** follows handoff 7: the standing says what, the scale's own evidence rating the tone. Strong is
  direct ("Make … a priority"), moderate and not yet rated are "likely to help", mixed describes with no flag,
  low agreement says the views differ. The sentences are product copy in `messages/en.json`, one per case,
  naming the scale; they claim no research beyond the scale's rating. The evidence explanations are the
  design bundle's (`WHY`), without its "outside view", which is not built.
- **"Make this a focus area"** comes with the focus areas (milestone 12); until then the scale page has no
  dead button.
- **Assess links a released round to its results.** The sample results on the Free plan now draw the same
  rows (`components/results/ScaleRows.tsx`).
- **The fixture** adds a second released round to the round states' group, half its questions answered as in
  the first, so the overview shows both change and no change.

## D-46 — The plan: focus areas and actions (M12)

Handoff 6.13; milestone 12: "A third focus area is refused. An action without an owner is refused."
`supabase/tests/plan_invariants.sql` (17 checks) proves both in the database, a direct write included, and
`tests/e2e/plan.spec.ts` on the screens. Where the build chose:

- **At most `active_focus_areas` active, in the database.** The setting (2, platform, fixed) is read by
  `make_focus_area` and by a trigger on `focus_area` that counts under the group's lock, so neither a second
  path nor two saves at once make a third. A scale is active once at most. A closed focus area stays closed
  and keeps its row; choosing the scale again makes a new one.
- **A focus area is one of the 21 scales** of a released round of the group's Full diagnostic, never an
  outcome: the outcomes are what the scales explain. Descriptive scales may be chosen from their own page, but
  the Plan page's "Scales to consider" leaves them out, as the design does. That list is the newest released
  round's scales by standing (priority, views differ, watch, read with, strength), then by level read the way
  the scale reads, six at most. Each focus area names the round it came from, with the scale's level and
  agreement label there. A focus area holds no number of its own: no target on a survey score.
- **The owner is never empty.** `action.owner_id` is not null, and every write path checks that the owner is
  a current member. A person's removal takes the actions they own, so an action is never left without one.
  An owner whose membership ends keeps the action, shown as no longer in the group, until its owner or the
  leader gives it to someone else.
- **A due date is required,** from yesterday (a reader ahead of UTC) to two years on. A date already saved may
  stay when an action is changed, though it has passed.
- **Who.** The leader records the group's choice of focus areas and closes them, as with the charter (handoff
  2: "Choose focus areas and actions · Group"). Any member adds an action to an active focus area, for any
  current member. The action's owner or the leader marks it done, reopens it, or changes its title, owner and
  date. Every action added now belongs to a focus area; the column allows none for the live meeting's actions
  (milestone 14).
- **No count per person.** The plan's reader returns each action with its owner, as the design's list does,
  and nothing that adds them up by person (section 11). Home counts the reader's own open actions for them
  alone, in "Needs you", and lists the active focus areas (handoff 6.7). Me lists what waits for the person
  in each of their groups (handoff 6.17): their open actions, and the Full diagnostic while it asks them,
  read through each group's `get_plan` and `get_rounds`, so no new function reads who answered.
- **The Team plan's.** Everything is written only while the group's plan includes `focus_areas` and it is not
  read-only (`plan_writable`); the suite checks from the catalogue that every client function writing either
  table asks it. A read-only group reads its plan. On the Free plan the Plan page stays the sample.
- **Not yet said on screen:** "Each open action appears on the next agenda." The agenda is milestone 13, and
  the sentence joins the Plan page with it, so the page claims nothing that is not true yet.
- **Nothing in 0017 deletes a row.** Closed focus areas and done actions keep their rows with a state and a
  date; their group's removal takes them. Neither is audited: the handoff's audit list names neither.
- **The fixture** adds the plan flow's group: five people of its own and one released round, no focus area
  and no action, which the flow makes.

## D-47 — The platform's pages: every built feature, in screenshots of the real app (owner, 14 October 2026)

The owner asked for detailed platform pages in the articles' style: real features in screenshots, what each
brings to the user, the leadership group and the organisation, illustrations and visuals, nothing commercial,
and several pages under a menu.

- **One page per feature built today** (`lib/site/features.ts`, words in `data/features/`), under `/platform/`:
  the Leadership Team Scan, the team view, the Leader Profile, the charter and members, the Full diagnostic, and
  focus areas and actions. A feature not built has no page; the overview lists it as in development.
  `/platform` stays the overview, now with each feature's card, and its steps mark the charter, the Full
  diagnostic and focus areas as available (milestones 9 to 12). The diagnostic's page shows its results in
  screenshots: the overview of a released round and one scale's page (D-45). The focus areas' page shows the
  Plan page (D-46): a focus area with its actions, the scales to consider, and a member adding an action on a
  phone. It promises nothing of the agenda, which is milestone 13.
- **Screenshots of the real app, never mock-ups.** `scripts/shots/capture.mjs` signs in as the fixture's people
  on the local stack (D-23, D-27) and photographs the pages as they render, into `public/shots/*.webp` and
  `data/shots.json`. Its rows come from the generator's new `--shots` scenario: the Lumio leadership group with
  the design's names, its scan released from eight answers, its charter at version 2, a Full diagnostic
  released from all eight (each scale with a level and a spread of its own, so the results show every
  standing), Preparation chosen from it as a focus area with four actions (Kari's done), a second round
  answering at 5 of 8, Kari Nordmann's profile shared as domains, and a sales group whose scan is open at 3 of
  7. Every row goes through its write path, as each person (the fixture test holds it). The groups' ids (701,
  702) are their own, clear of the flows'. Requests carry the production host, so an invite link reads
  www.leaderpact.com, and the browser runs in British English, so a date field reads day first.
- **Every screenshot is marked.** A "Sample data" chip on the picture and, under it, "A fictional group: every
  name and answer is invented" (CLAUDE.md: sample content is always marked Sample). Desktop pictures show an
  app page's content, cropped from its top bar so the words stay readable, and open at full size.
- **What each feature brings**, in a `value` block of three: for you, for the leadership group, for the
  organisation. The claims are what the feature does today, with no outcome promised: the Leader Profile's
  "never used for selection, promotion or performance evaluation" is the product's own rule.
- **Nothing commercial.** No price, no offer and no button on a feature page; a unit test refuses prices, "per
  seat", "upgrade" and "sign up". Where a feature belongs to the Team plan, the page says so and that a leader
  can try it for 14 days with no billing details (D-33), and nothing about paying, which is not connected.
- **The Platform menu** replaces "How it works" in the header: a disclosure button whose panel lists the six
  features and the overview, Anonymity and Research. It closes on Escape (focus returns to the button), on a
  click outside, when focus leaves it and on a new page; the panel exists only while open. Under 768 px a menu
  button beside "Start the scan" opens the header's links and the same pages, which the header had no room for.
  The footer lists the features. An e2e test drives both at every width, with axe on the open menu.
- **Feature pages are wide**: figures, screenshots and the value block take the page's width, and text keeps
  the reading measure (`Blocks` with `wide`); the product pages use the same frame. A box is an `aside`
  named by its title, so two on one page are landmarks a reader can tell apart.
- **Search:** each page answers its own search (the title carries it, and the inventory refuses a search that
  is the first of two pages), with breadcrumbs, FAQPage data, a share card, the sitemap and llms.txt; the
  content inventory sends the six pages to Sentral.
- **To refresh the pictures** after a screen changes: run the fixture with `--shots`, start the app on the local
  stack, and run `node scripts/shots/capture.mjs` (the steps are in its header). A unit test fails if a page
  names a picture that does not exist, or if a picture is shipped that no page shows.
