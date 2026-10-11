# LeaderPact: Claude Code handoff

Version of 11 October 2026. One document for building the MVP.

LeaderPact is the working name. The trademark check is not done, so keep the name in one constant and ship nothing public under it yet.

## 0. How to use this document

Do section A first: it is the evaluation of Orgpuls, and it shapes everything after it. Then read sections 1 to 3 and build in the order of section 12. Sections 4 to 11 are reference.

Two repositories are attached to your session.

| Repository | State on 11 October 2026 | What you do with it |
|---|---|---|
| `torlambrechts-sketch/leaderpact` | Empty | Build here |
| `torlambrechts-sketch/Orgpuls` | An existing product on the same stack | Read it and reuse from it. Change nothing in it unless the owner asks |

Four sources exist. When they disagree, the order below decides.

| Rank | Source | Use it for |
|---|---|---|
| 1 | This document | Rules, scope, data, behaviour, copy rules |
| 2 | `design/reference/LeaderPact App - Cream v2.dc.html` | Layout, visual style, component shapes, screen structure |
| 3 | The Orgpuls repository | How to build it: proven patterns, code and tests to reuse |
| 4 | Your own judgement | Anything no source covers. Say what you assumed in the pull request |

Orgpuls has its own `CLAUDE.md`. It governs work in that repository, not in this one. Two of its rules do not carry over. Its pixel-perfect rule does not, because this design is wrong in known places. Its operating authority does not, because the owner must grant that for LeaderPact separately.

The design file is a clickable prototype from Claude Design. It is the reference for how things look and where they sit. It is not production code, and it still carries older rules. Section 11 lists every place where the design is wrong. Do not copy those parts.

Put the design file in the repository at `design/reference/` and do not import from it.

**Never invent:** scores, norms, item wording, prices, legal text, customer names or pilot numbers. Where a value is missing, this document says so. Stop and ask, or leave a clearly named `TODO(owner)`.

## A. First task: evaluate Orgpuls and connect to Sentral

Orgpuls is the owner's survey product for the psychosocial work environment. It runs on the same stack and already solves the hardest parts of LeaderPact: anonymous answers, rounds, reminders, billing state and a tested database. Start by reading it.

### A.1 What to produce

Write `docs/REUSE_EVALUATION.md` in the LeaderPact repository before any feature code. Open it as the first pull request and wait for the owner's answer on the questions in it.

For each area in the table below, give a verdict: reuse as it is, adapt, or do not reuse. Name the files, say what changes, and name the risk.

| Area | Where to look in Orgpuls | What LeaderPact needs |
|---|---|---|
| Agent setup | `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/audit`, `.mcp.json`, `scripts/cloud-*.sh`, `scripts/playwright-mcp.sh` | The same working setup, with LeaderPact's own rules |
| CI and gates | `.github/workflows/`, `package.json` scripts, `scripts/qa/`, `scripts/audit/wiring.mjs` | Type check, lint, build, database rebuilt from migrations, both test suites, the wiring audit |
| Supabase clients | `lib/supabase/` | The same split. Note that the app holds no service-role client |
| Anonymous answers | The `responses` tables, `rpc.submit_response`, the result RPCs, `supabase/tests/respondent_invariants.sql`, `k_floor_invariants.sql` | The same structure, with LeaderPact's threshold of 4 |
| Threshold as functions | `app.k_floor()`, `app.k_min()`, `app.k_round()`, `lib/org/threshold.ts` | The mechanism: functions, not columns, and a round freezes its threshold when it opens |
| Rounds and reminders | `lib/rounds/`, `lib/participation/` | Scan, diagnostic and pulse rounds, with release at close |
| Answering a questionnaire | `lib/respond/`, `components/respond/`, `app/s/[token]`, `app/inn/[code]` | The scan, the invite link and the questionnaire runner |
| Mail | `lib/delivery/`, the outbox tables, `supabase/functions/orgpuls-dispatch`, `orgpuls-mail-events`, `_shared/brevo.ts` | Invitations, reminders and sign-in mail |
| Billing state | `lib/billing/`, `app.billing`, `app.org_access`, `docs/BILLING_RECOMMENDATION.md` | A plan that gates access, grace, then read-only |
| Data as rows | `modules/*/v1.json`, `scripts/modules/` (validate, seed, publish, registry) | The item bank and the scales as a versioned, validated data file |
| Text and locale | `messages/`, `lib/i18n/`, `scripts/verify/i18n.mjs` | Every string keyed, with English as the only locale |
| Fixtures and demo | `scripts/seed/design-fixture.mjs`, `lib/demo/` | One generator as the only source of fixture rows, and the Lumio demo group |
| Visual checks | `scripts/verify/` (shoot, pixel, probe), `scripts/qa/visual.mjs` | Side-by-side checks against the design where the design is right |
| Flags | `lib/flags.ts` | Server-checked flags |
| Sign-in | `lib/auth/`, `app/auth/` | Sign-in by email link. Google and Microsoft sign-in only if the owner wants them |
| Export | `lib/csv/`, `lib/xlsx.ts`, `lib/report/` | "Download my data" |
| The platform API | `docs/platform/PLAN.md`, migrations `0205`, `0207`, `0228`, the platform invariants suite | Section A.3 |

Do not carry over: the Norwegian market and legal packs, the industry modules, the Teams, Slack, SMS and Entra integrations, the marketing site, and anything specific to the statutory report.

### A.2 How to reuse

- LeaderPact gets its own Supabase project in `eu-central-1`. It never shares a database with Orgpuls.
- Copy and adapt code into this repository. Note the origin of each copied file in the evaluation, with the Orgpuls commit.
- Carry the tests over with the code. A pattern without its invariants test is not reused, it is rewritten.
- Where Orgpuls and this document give different numbers, this document wins. Orgpuls has a threshold floor of 3 and a default of 5. LeaderPact's threshold is 4 and can be raised to 8.
- Where Orgpuls is stricter than this document on security, follow Orgpuls. Four cases are known:
    - no service-role client in the app;
    - one write path for answers, which never returns a row ID;
    - answer tables with security on and no policy;
    - Zod at every server boundary.
- Do not propose a shared package between the two products in this evaluation. Say where one would pay off later.

### A.3 Sentral: the same management platform, by API

The owner runs one management platform for several products. In the Orgpuls repository it is called Sentral, or "the platform". It holds admin, customers, support and invoicing. Orgpuls is its first product, and LeaderPact is the second.

This has three consequences for the build.

- **LeaderPact has no admin, CRM or support screens.** Sentral does that work.
- **Sentral steers LeaderPact through commands, and LeaderPact tells Sentral what happened through events.** Sentral never owns product data.
- **Nothing about an answer ever leaves LeaderPact.**

Implement the contract Orgpuls already has. Read `docs/platform/PLAN.md` section 5 and migration `0205_platform_api.sql` in Orgpuls, and port them.

| Part | How Orgpuls does it | For LeaderPact |
|---|---|---|
| Commands in | `public.platform_command(token, command, args)`, called with the public key. The token is a short HS256 JWT that the database verifies itself with a Vault secret | The same function, with audience `leaderpact` |
| Token checks | Audience, the admin as subject, scopes, a unique ID never seen before, at most 5 minutes long | The same |
| Command map | One row per command in `app.platform_command_map`, naming one function and one scope | The same, with LeaderPact's commands below |
| Audit | Every call that passes the signature is written to `app.platform_commands`, append-only | The same |
| Events out | One function builds events and refuses any field its kind does not list. The dispatcher posts batches to the installation's webhook, signed with HMAC-SHA256 | The same |
| Installation | `app.platform_installation` holds the webhook address and an on switch | The same |
| Resync | A command that re-sends every organisation's state | The same |

The two lists below are proposals, cut down from the Orgpuls lists. Confirm them in the evaluation.

Events, LeaderPact to Sentral. Numbers and account facts only.

| Event | Fields |
|---|---|
| `org.created` | Organisation ID, name, organisation number if given, group size |
| `user.invited`, `user.joined`, `user.removed` | Organisation ID, user ID, role, email. These are customer contacts with an account, never scan respondents |
| `billing.changed` | Organisation ID, plan, interval, dates |
| `org.deleted` | Organisation ID |
| `usage.daily` | Per organisation: members, rounds open and closed, meetings held, last sign-in |

Never in an event: an answer, a score, a standing, a profile, a process comment, who answered, or a response count for a named round.

Commands, Sentral to LeaderPact.

| Command | Scope |
|---|---|
| List and read organisations: summary, users, billing, usage. Never answers or scores | `orgs:read` |
| Set plan and interval, cancel, move to Free | `billing:write` |
| Deactivate a user, resend an invitation | `users:write` |
| Publish or withdraw an instrument version | `modules:write` |
| Create, reset or remove a demo group | `demo:write` |

Put these questions in the evaluation, since only the owner can answer them:

- Which repository is Sentral, and can it be attached to the session? The contract must be checked from both sides.
- Does Sentral already support a second product, or must it be extended first? Orgpuls names its secrets and headers after itself.
- Where is the invoice made? In Orgpuls the product keeps the billing state and Sentral makes the invoice. Section 6.18 describes a checkout in the product.
- Does mail go through the same Brevo account as Orgpuls, with a sender of LeaderPact's own?
- Does the operating authority in the Orgpuls `CLAUDE.md` apply to LeaderPact too?

## 1. The product in one page

A leadership team sees how it really works in 3 minutes, then improves it meeting by meeting.

**Who uses it.** A leadership team of 4 to 15 people: a team leader (the buyer) and members. Later also a coach and an organisation admin.

**The loop.** This is the whole product, and the navigation follows it.

1. **Scan.** A free 12-question Leadership Team Scan, with no account.
2. **Invite.** One link for the group. The team view opens when the scan closes.
3. **Subscribe.** The Team plan, per group.
4. **Design.** A charter: purpose, team tasks, working agreements.
5. **Diagnose.** A 72-question diagnostic. Results show level and agreement per scale.
6. **Focus.** At most 2 focus areas, with actions.
7. **Meet.** Agendas with outcomes, and a live meeting view.
8. **Re-measure.** A pulse every 4 weeks, and a new diagnostic after 6 months.

**What sets it apart.** The link from assessment to meetings. Keep that link visible in the build: actions appear on the next agenda, and agenda items point to team tasks.

**Three promises the code must keep.**

- **Anonymous by construction.** An answer is never stored with a person. Nobody, including staff, can select raw answers.
- **Nothing before close.** No result shows while a round is open. A result is computed once.
- **Honest labels.** Every score carries "Research-based, not yet validated". No claim of validation anywhere.

### Plans

Prices are test prices. Hold them as data.

| Plan | Price | Includes | Limits |
|---|---|---|---|
| Free | $0 | Leadership Team Scan, team view, Leader Profile in both lengths | 1 group. Latest scan only, no history |
| Team | $1,800 per group per year, or $180 a month | Charter, full diagnostic, pulses, meetings, focus areas and actions | 1 group per subscription, up to 15 members |
| Organisation | Not in the MVP | | |
| Coach | Not in the MVP | | |

Pricing is per group, never per seat.

## 2. Scope

### Build now: the MVP

Sixteen capabilities. Section 6 gives the screen for each, and section 12 the order.

| # | Capability | Who |
|---|---|---|
| 1 | Take the scan without an account | Visitor |
| 2 | Save the result and create a group | Leader |
| 3 | Answer the scan as an invited member | Member |
| 4 | See the team view | Leader, member |
| 5 | Take and control the Leader Profile | Any user |
| 6 | Subscribe to the Team plan | Leader |
| 7 | Set up the group | Leader |
| 8 | Write and agree the charter | Leader drafts, group agrees |
| 9 | Run the full diagnostic | Leader opens, members answer |
| 10 | Read the results | All members |
| 11 | Choose focus areas and actions | Group |
| 12 | Build the agenda | Leader, member |
| 13 | Run the live meeting | Participants |
| 14 | Run pulses | Group |
| 15 | Export or delete my data | Any signed-in person |
| 16 | Get invitations and reminders | All users |

### Do not build yet: Phase 2 and later

These appear in the design file. Leave them out, and do not stub screens for them unless section 6 says to show a sample page.

| Area | Items |
|---|---|
| Meetings | Check-in after meetings, meeting series and year plan, pre-reads, decision rights per item, decision log, agenda audit, meeting roles |
| Results | Pattern cards, the 90-minute results session, slides and PDF, radar and priority matrix (see section 11) |
| Plan | Initiatives with milestones, the practices library, reflection session |
| People | Team map, team-leader feedback, contribution view, development notes, profile modules |
| Assess | Schedule view, shorter diagnostic, outside view |
| Workshops | The workshop module with its board, and the personal user manual |
| Public site | Research, Templates, For coaches, the demo group, comparison pages |
| Other | Coach workspace, organisation admin, single sign-on, benchmark, languages other than English, calendar sync, any AI feature |

### Never build

- A rating of a person by people outside the group. The design's "360" tab is removed.
- A view that ranks people, a team-fit score, or any use for selection, promotion or performance evaluation.
- A target on a survey score.
- A subgroup filter on results.
- A lowest, highest or median score, or a chart of members' scores.

## 3. Stack and repository

### Stack

Match Orgpuls, so that code and tests move across without change.

- One Next.js app (App Router) in strict TypeScript, with React 19 and Tailwind, hosted on Vercel. Use the versions Orgpuls runs.
- One Supabase project of its own in `eu-central-1`: Postgres with row-level security, Auth, Realtime, Storage, Cron and Vault.
- Zod at every server boundary. `next-intl` for all text, with English as the only locale and no locale in the path.
- GitHub holds the source and the database migrations. Every branch gets a Vercel preview.
- Icons: `lucide-react`. The design uses the same Lucide set through a web component.
- Fonts: Figtree and Poppins. Serve the same font files in the app and in any visual check.
- Tests: Vitest for units, SQL invariant suites for the database, Playwright with axe for the flows in section 13.

One difference is open. The product requirements name shadcn/ui. Orgpuls does not use it and keeps its own small set of primitives. Say in the evaluation which is better for this design, and keep shadcn/ui as the default until the owner answers.

### Mail and payment

- **Mail.** Orgpuls sends through Brevo, with an outbox table, a dispatcher function and mail events. Reuse that path by default, and confirm the account and sender with the owner.
- **Payment.** Not settled. In Orgpuls the product holds the billing state and Sentral makes the invoice. Build the plan state and its access rules first, behind a `PaymentProvider` interface, with a development adapter that succeeds or fails on demand.
- Add no payment vendor until the owner names one. Any provider must process in the EU and offer a processor agreement.

### Repository layout

```
/app                     Next.js routes
/components/ui           shadcn/ui primitives, themed
/components/lp           LeaderPact components (section 4)
/lib/scoring             Pure functions: level, agreement, standing, change
/lib/rules               Release rules, thresholds, pulse assembly
/lib/providers           Payment interface and adapters
/lib/platform            The Sentral connection: events and commands
/messages                Every user-facing string, keyed
/supabase/migrations     SQL migrations, one concern per file
/supabase/functions      The mail dispatcher and scheduled jobs
/supabase/seed           Model data and the demo organisation
/supabase/tests          Invariant suites, anonymity first
/design/reference        The Claude Design file. Reference only
/docs                    This handoff, and decisions taken during the build
CLAUDE.md                Short rules for the coding agent (below)
README.md                Setup, scripts, environments
.env.example             Every variable, with no secrets
```

### CLAUDE.md, to create first

Start from the Orgpuls `CLAUDE.md` and keep its structure. It should hold:

- The three promises from section 1, written as security invariants that fail a pull request.
- "Model as data": scales, items, instruments, cut-offs, plans and templates are rows, never constants in code.
- Row-level security on every table, with no exceptions. No service-role client in the app.
- "Never fabricate data in the user interface", as Orgpuls words it.
- Schema changes only through migrations. Never edit an applied migration.
- The names in section 10. One name per thing.
- British spelling in user-facing copy. Sentences under 25 words.
- No emoji in the product.
- How to run tests, and that the anonymity tests must pass before any merge.

### Working method

- Work in vertical slices, one milestone of section 12 per pull request.
- Plan the schema and the security policies before writing screens. Use your strongest model for migrations, policies and scoring, since errors there are costly.
- Each pull request states what was assumed and what was left out.

## 4. Design system

Take the look from the design file. The values below are measured from it.

### Character

Warm and quiet. A cream page, white cards, black ink and black primary buttons. One soft lavender accent for fills and pills. Colour carries meaning only together with a word.

### Colour tokens

Define these as CSS variables and map them to the shadcn/ui semantic tokens.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f1ede6` | Page background |
| `--surface` | `#ffffff` | Cards |
| `--surface-sunk` | `#f8f5ef` | Inset boxes inside a card |
| `--surface-soft` | `#f5f1ea` | Search field, quiet fills |
| `--bar` | `#e4ddd2` | Top bar pill, sidebar |
| `--hero` | `#e4d9c9` | Greeting block, landing hero |
| `--track` | `#ece6dc` | Bar and gauge tracks |
| `--divider` | `#f0ebe2` | Lines inside a card |
| `--border` | `#e2dbcf` | Card and control borders |
| `--border-strong` | `#d8d0c2` | Secondary buttons |
| `--border-dashed` | `#cfc6b6` | Dashed hint boxes |
| `--ink` | `#111111` | Text, primary buttons, active states |
| `--text-2` | `#55524a` | Secondary text |
| `--text-3` | `#46433c` | Body text on the hero colour |
| `--muted` | `#77736a` | Meta text. See the contrast note below |
| `--accent` | `#cccbdc` | Pills, selected option, icon tiles |
| `--accent-strong` | `#8a87b3` | Bar fills |
| `--accent-mid` | `#b5b3cf` | Hover borders, gauge middle |
| `--accent-ink` | `#3a3950` | Text on `--accent` |
| `--accent-deep` | `#2b2a3d` | Text on white chips |
| `--danger` | `#c0502e` | Remove and delete text |
| `--danger-border` | `#f0c9d2` | Border of delete buttons |
| `--flag` | `#d08a12` | Border of a warning box. Not for text |
| `--flag-bg` | `#fff9ef` | Warning box fill |
| `--flag-ink` | `#7a4e03` | Text in a warning box |
| `--step-current` | `#e07049` | Current step marker. Not for text |

Status and evidence pairs, background then text:

| Meaning | Background | Text |
|---|---|---|
| Active, done | `#e6f5e9` | `#22603a` |
| Pending | `#fff1c9` | `#6b5208` |
| Evidence: strong | `#ebe5fb` | `#2b2a3d` |
| Evidence: moderate | `#f6f1e3` | `#6b5208` |
| Evidence: other | `#f1eff5` | `#55524a` |

Avatar pairs, background then text, picked by a stable hash of the person: `#ffe2cf`/`#7a3a12`, `#e4ecff`/`#25407a`, `#e6f5e9`/`#22603a`, `#cccbdc`/`#3a3950`, `#fde3f0`/`#8a2459`, `#fff1c9`/`#6b5208`, `#e3f4f7`/`#1f5b66`, `#eeeaf3`/`#4d4659`.

Tile tints for the "This week" row: `#cccbdc`, `#c3e1e6`, `#fdea8a`, `#e4d9c9`.

### Contrast fixes

The design fails contrast in four places. Fix them in the build.

| Pair | Ratio | Fix |
|---|---|---|
| `--muted` on `--bg` | 4.05 | Use `--text-2` for small text on the page background |
| `--muted` on `--bar` or `--hero` | 3.4 to 3.5 | Use `--text-2` |
| White on `--accent-strong` | 3.39 | Never put text on this colour |
| `--flag` or `--step-current` as text | 2.7 to 3.2 | Use them only for borders and marks |

`--muted` on white is 4.72 and is fine.

### Type

| Role | Font | Size, weight, tracking |
|---|---|---|
| Landing headline | Poppins | 58 px, 500, line-height 1.03, -0.035em |
| Section headline | Poppins | 36 px, 500, -0.03em |
| Page greeting | Poppins | 34 px, 500, -0.03em |
| Card headline | Poppins | 28 to 30 px, 500, -0.02em |
| Sub-headline | Poppins | 22 px, 500 |
| Big number | Figtree | 40 px, 700, -0.03em, line-height 1 |
| Section title | Figtree | 18 to 21 px, 700, -0.02em |
| Body | Figtree | 14 to 15 px, 400 to 500, line-height 1.55 |
| Control label | Figtree | 13.5 to 14 px, 600 |
| Meta | Figtree | 12 to 12.5 px, 400 |
| Micro label, capitals | Figtree | 10.5 to 11 px, 700, 0.05em |

Poppins is only for headlines. Everything else is Figtree. Use `text-wrap: balance` on headlines.

The design sets most text at 12 to 13.5 px. Keep that on desktop. On phones, body text is at least 15 px and inputs at least 16 px.

### Shape and space

| Thing | Value |
|---|---|
| Card radius | 18 px. 20 px for large cards. 28 px for the landing hero |
| Button radius | 12 px. 10 px for small buttons |
| Input and option radius | 14 px for options, 11 to 12 px for inputs |
| Pill radius | 99 px |
| Icon tile | 36 px square, radius 11 px, fill `--accent` |
| Small chip | radius 5 to 6 px |
| Card padding | 22 px by 24 px. 20 px by 22 px for compact cards |
| Page gutter | 32 px on desktop, 16 px on phones |
| Gap between cards | 20 px |
| Gap inside rows | 8, 10 or 12 px |
| Content width | 1240 px in the app, 1360 px on the landing page, 640 px for a questionnaire |

Cards have a white border, so they read as flat shapes on cream. Shadows are rare: the main landing button, the landing sample card and the questionnaire card only.

Focus: a 2 px `--ink` outline with 1 px offset, on every interactive element.

### Components to build in `/components/lp`

Build each once, from the design, and reuse it.

| Component | Reference in the design | Notes |
|---|---|---|
| `TopBar` | App shell, horizontal layout | Sticky. Page colour at 92% with a 10 px blur. Inside it a pill in `--bar`, min-height 58 px: logo, navigation, plan pill, settings, avatar |
| `NavItem` | Top bar | 12.5 px, 600, icon 16 px. Active: black fill, white text, radius 10 px |
| `PlanPill` | Top bar | `--accent` fill, `--accent-ink` text. Links to plan and billing |
| `HeroBlock` | Home greeting | `--hero` fill, radius 20 px, padding 28 by 32. Date, greeting in Poppins, status line |
| `Card` | Everywhere | White, radius 18 px, padding 22 by 24 |
| `SectionHeader` | Card tops | Title 18 px 700, optional count pill, meta text right |
| `ListRow` | "Needs you" | Icon tile, kind chip, title 14 px 700, meta 12 px, action button right, divider above |
| `Button` | Everywhere | Primary: black, white text, 600. Secondary: white, `--border-strong`. Small: radius 10 px, 12.5 px, 700. Danger: white, `--danger` text, `--danger-border` |
| `Pill` | Everywhere | 11.5 to 12 px, 600, padding 4 by 10 |
| `Tabs` | Group, Results, Plan, Settings | Active tab: black fill, white text. Others: `--text-2`, no fill |
| `OptionRow` | Scan and all questionnaires | Min-height 52 px, radius 14 px, border 1.5 px. Off: white, `--border`. On: `--accent` fill, `--ink` border. A 26 px numbered circle on the left |
| `ProgressBar` | Questionnaires | Height 6 px, track `--border`, fill `--ink` |
| `LevelBar` | Team view, results | Height 8 px, track `--track`, fill `--accent-strong`. Width is (level − 1) ÷ 4. Level in 700 beside it, agreement label after |
| `CountDots` | Scan status | 16 px squares, radius 5 px. On `--ink`, off `--border`. Always with the count in words |
| `HintBox` | Scan status | `--surface-sunk`, dashed `--border-dashed`, radius 12 px |
| `WarningBox` | Agenda task match | `--flag-bg`, 1.5 px `--flag` border, radius 12 px, text `--flag-ink` |
| `SampleBanner` | Paid pages on the Free plan | Black, white text, radius 18 px, a white SAMPLE chip, an Upgrade button for the leader |
| `EvidenceChip` | Results | The three evidence pairs above |
| `StandingLabel` | Results | A word, never colour alone |
| `Avatar` | Everywhere | 34 px circle, initials, the avatar pairs |
| `Toast` | Global | For saved, copied and errors |

Use real elements. The design uses `div` with a click handler everywhere. Build buttons as `button`, links as `a`, and inputs with a `label`.

### Layout

- **Navigation.** Build the horizontal top bar only. The design also has a sidebar layout and a width switch. Do not build either.
- **Phone.** The design is fixed at 1280 px. The build is responsive from 360 px. Below 768 px the top bar shows the logo, plan pill and avatar, and a bottom bar carries Home, Group, Meetings, Plan and More.
- **Grids.** Two-column pages use about 1.5 to 1, and collapse to one column below 900 px. The "This week" row has five tiles and wraps.
- **Questionnaires.** One question per screen, in a centred 640 px column, at every width.
- **Tables.** Wide tables scroll sideways inside their card on small screens.

## 5. Routes

Proposed paths. The design's route names are in the last column so you can find the reference screen.

| Path | Screen | Design route |
|---|---|---|
| `/leadership-team-assessment` | Landing page with the scan | `landing`, `public` |
| `/scan` | The 12 questions | `scan` |
| `/scan/result` | Personal view, then the email step | `personal` |
| `/j/[code]` | A member answers from the invite link. After close, the team view | `scan`, `personal`, `team` |
| `/leader-profile` | Public page for the Leader Profile | none, use the landing layout |
| `/sign-in` | Email link sign-in | none |
| `/app/[group]/home` | Home | `home` |
| `/app/[group]/group` | Charter and members | `group` |
| `/app/[group]/people` | Members and shared profiles | `people`, roster tab |
| `/app/[group]/assess` | Rounds and pulses | `assess`, overview tab |
| `/app/[group]/assess/[round]/answer` | Answer a questionnaire | `run` |
| `/app/[group]/results` | Results in three depths | `results` |
| `/app/[group]/plan` | Focus areas and actions | `develop`, focus tab |
| `/app/[group]/meetings` | Agenda | `agenda` |
| `/app/[group]/meetings/[meeting]/live` | Live meeting | `live` |
| `/app/me` | Leader Profile, sharing, my actions, open surveys | `me` |
| `/app/[group]/settings` | Account, group, notifications, privacy, plan and billing | `settings` |

The title and first heading of the landing page say "leadership team assessment". The page name is Leadership Team Scan.

Navigation order: Home, Group, People, Assess, Results, Plan, Meetings, Me. Settings sits behind the gear. A group switcher shows for anyone in more than one group.

## 6. Screens

Each screen lists what to build and the rule that governs it. Where the design differs, section 11 has the correction.

### 6.1 Landing page

- A hero with the headline, one primary button "Start the scan" and a sample team view card marked Sample.
- The primary button starts the scan at once. There is no form before the first question.
- A three-step strip: answer 12 questions, invite your group, read it together.
- Menu: Leadership Team Scan, Leader Profile, Sign in.
- Footer links to a privacy page and a data-processing page. Create both as plain pages with a `TODO(owner)` for the legal text.

### 6.2 The scan

- 12 questions, one per screen, five options from Strongly disagree to Strongly agree.
- Answers stay on the device until the last question. Say so under the card.
- An abandoned scan resumes on the same device for 7 days.
- The items are the twelve marked "scan" in Appendix B, in the order of Appendix C.

### 6.3 Personal view

- Shows within 2 seconds of the last answer. It is labelled "One person's view".
- Six theme scores, each the mean of its two items, each called indicative.
- Then one ask: email, group name and the number of members, 4 to 15.
- Text: "The team view opens when the scan closes."
- An email link signs the leader in. A link is valid for 15 minutes and works once.
- If the email is already registered, sign in and add the group.

### 6.4 Invite and scan status

- One invite link for the whole group. Responses are capped at the member count.
- Show the count of answers and the closing date. Never a score and never a name.
- The scan closes when every member has answered, or after 7 days.
- The leader cannot close it early.
- Reminders go to the leader, with a prompt to share the link again. Members have no account and get no email.

### 6.5 A member answers

- The member opens `/j/[code]`, answers the 12 questions and sees their personal view.
- The page says how answers are stored and when the team view opens.
- "Submit anonymously" stores the response without any person ID.
- A second submission from the same browser replaces the first, until the scan closes. Use a random token in local storage for this. It is not a person ID.

### 6.6 Team view

Three states.

| State | Shows |
|---|---|
| Open | The count and the closing date only |
| Closed, 4 or more answers | Level and agreement label per theme, computed once. "You agree on" and "Your views differ most on". The upgrade card |
| Closed, fewer than 4 | One 7-day extension. Then a page that says no team view was made |

- Everyone sees the team view at the same moment.
- A group of 3 or fewer never gets a team view. Say so when the leader sets the size.
- Answers after the close are not added. A new scan gives a new result.
- The Free plan keeps the latest scan only.

### 6.7 Home

Two versions, by plan.

- **Free.** The greeting block. A "Needs you" list: answer the scan, share the link, take the Leader Profile. A scan status card with count, dots, closing date and link. One card on what the Team plan adds, with meetings in the list.
- **Team.** The greeting block. A "Needs you" list of open questionnaires and the person's actions. Open rounds with counts. The current focus areas. The next meeting.

Do not show an "Assessment schedule" button in the MVP. Do not repeat the same message in several cards.

### 6.8 Group

Two tabs: Charter and Members.

- **Charter.** Purpose, team tasks with decision rights, and working agreements. It starts from a template.
- One version is in force. Editing a charter in force creates a new draft. Earlier versions stay readable.
- The leader drafts, and "The group agrees · put in force" makes it the version in force.
- **Members.** Add and remove members, name the leader. Up to 15.
- A member who leaves loses access at once. Past rounds stay intact. The only leader cannot be removed.
- The member list shows no counts of tasks or actions per person.
- Each membership has a start and an end date. A person can be in several groups.

### 6.9 People

In the MVP this is a simple list: each member, their role, and their Leader Profile if they share it. No scores show for a profile that is not shared, and no preview.

### 6.10 Assess

- A plain list of rounds and pulses: name, phase, dates and the count of answers.
- A round has four phases: scheduled, answering, closed and released.
- The leader opens a diagnostic round. Every current member is invited. There is no picker for who takes part.
- Only the 72-question form exists. No shorter form and no open questions.
- While a round is open the page shows a count such as "5 of 8 answered". Never a score, never a name.
- Reminders go on days 3, 7 and 12, to people who have not answered. Nobody sees who they are.

### 6.11 Answering a questionnaire

- An intro page: name, purpose, number of questions, time, and how answers are stored.
- One question per screen, shown in mixed order, not grouped by scale.
- Progress saves if the person stops.
- A review page before submit, listing unanswered questions.
- Submit stores a response set with a random ID and marks the person as having answered. The two are never linked.

### 6.12 Results

- Opens only after the round closes, to all members at the same moment.
- Three depths: overview, one scale, the scale's items.
- **Overview.** The three outcomes, marked self-rated. Then the 21 scales grouped by layer. Each row: scale, evidence chip, level, change, agreement label, standing.
- **Scale.** The definition, level, agreement label, standing, the guidance text, and a button to make it a focus area.
- **Items.** Each item's text and its mean to one decimal. Nothing else.
- A first round shows no change.
- Section 7 has every rule for level, agreement, standing and change.

### 6.13 Plan

- At most 2 active focus areas. A third needs one to be closed first.
- Each action has an owner and a due date. An action without an owner cannot be saved.
- Each open action appears on the next agenda.
- No target on a survey score.

### 6.14 Meetings: agenda

- Any member proposes an item.
- An item is ready when it has a type, a desired outcome, an owner and a time box. Types: information, discussion, decision, follow-up.
- **Task match.** An item that fits no team task gets a warning. It stays if the leader confirms it. With no team tasks defined, the check is off and the page prompts the leader to define them.
- **Time check.** The items' total time against the meeting's length.
- The agenda template ends with a closing item: one thing to keep, one to change. The leader can remove it.
- The agenda shows ready items out of total.

### 6.15 Meetings: live meeting

- Shows the current item with type, desired outcome, team task and a timer. Controls: start, pause, plus 5 minutes.
- State syncs to all participants within 1 second, over Supabase Realtime.
- Two process comments, sent without a name: "What are we trying to achieve?" and "We are off track".
- With fewer than 4 participants online, process comments are disabled.
- Each item closes as reached, carried over or parked. A decision and actions save per item.
- A parking lot holds side topics.
- If the connection drops, the page is read-only until it reconnects.
- At the end: a summary of items, decisions and new actions.

### 6.16 Pulse

- Every 4 weeks, open for 7 days. At most 10 questions.
- Built in this order: the items of the focus scales, then one item per working agreement, then up to 2 rotating items from other scales.
- If the agreements do not fit, they rotate between pulses.
- Results open when the pulse closes. Fewer than 4 answers: no result, logged as missed.
- The wording of the working-agreement item is not set. Proposed: "In the last 4 weeks we kept this agreement: «text»". Confirm before launch.

### 6.17 Me and the Leader Profile

- Two tests, both free: a quick test of 20 questions and a full test of 120.
- Save and resume. The quick test is labelled "a first look".
- **Quick result.** The position on the answer scale in three bands: lower, middle, higher. Say that no norm group is used.
- **Full result.** Lower, middle or higher than a named group: a US sample of 320,128 people. Say the sample is general, not leaders.
- Never show good or bad.
- **Sharing.** Private by default. Three levels: nothing, domains, or domains and facets. It applies at once. A retake resets sharing to nothing.
- Delete removes the profile within 30 days. Admins and coaches have no path to it.
- Me also lists the person's actions and open questionnaires.

Two things are not supplied and must not be invented. Section 9 says where to get them: the test items with their keys, and the norm table.

### 6.18 Settings

Five tabs: Account, Group, Notifications, Privacy, Plan and billing.

- **Account.** Email, sign-in by email link, time zone, sign out everywhere, delete account. English only, so no language picker.
- **Group.** Name, members link, anonymity threshold. The threshold is 4 and can be raised to 8, never lowered.
- **Notifications.** Each person sets how often summaries arrive. A reminder never says who has not answered.
- **Privacy.** My consents, delete my results, and "Download my data". The export arrives as a file within 24 hours.
- **Plan and billing.** Compare plans, then a three-step checkout: billing period, company details and payment method, review. Card or invoice. An invoice carries the organisation number and a reference. Tax follows the customer's country.
- A failed payment or overdue invoice gives 7 days of grace, then the group is read-only. After a cancel, data is kept 90 days, then deleted.
- Group, members and scan results carry over on upgrade.

### 6.19 Sample pages on the Free plan

On the Free plan, the paid areas show seeded sample content under the `SampleBanner`. The leader sees the price and an Upgrade button. A member sees "Ask your team leader to upgrade", with no price.

## 7. Measurement rules

Put these in `/lib/scoring` as pure functions with unit tests, and enforce the release rules again in the database.

### Scales and layers

There are 21 scales and 3 outcomes. Never write "24 scales". Appendix A lists each with its layer, reading type and evidence rating.

### Answer format

- Five points, 1 Strongly disagree to 5 Strongly agree.
- No group item is reverse-keyed. Agreeing always means more of what the scale measures.
- The Leader Profile tests keep their published keys, which do include reversed items.

### Level

- A person's scale score is the mean of the scale's three core items.
- The level is the mean across respondents, shown to one decimal.
- A scan theme is the mean of its two items. It is called indicative.

### Agreement

- Agreement is a within-group agreement index. It is shown only as a label: high, medium or low. Never show the number.
- Cut-offs, proposed: high above 0.70, medium from 0.51 to 0.70, low at 0.50 or below.
- Formula, proposed and to confirm: 1 minus the variance of respondents' scale scores divided by 2.0, with a floor of 0. The 2.0 is the variance of a flat five-point distribution.
- Identical answers give high agreement.

### Standing

Every scale shows one standing, in words. Apply the cut-offs to the level as shown, at one decimal.

| Reading type | Priority | Keep watching | Strength |
|---|---|---|---|
| Higher is better | Below 3.0 | 3.0 to 3.3 | 3.4 or above |
| Lower is better | 3.5 or above | 2.8 to 3.4 | Below 2.8 |

Apply in this order:

1. A descriptive scale shows "Fact, no target".
2. Task conflict shows "Read with relationship conflict".
3. Low agreement shows "Views differ".
4. Otherwise the table above.

All five cut-offs are rows of data. The pilot will reset them.

### Guidance wording

Guidance follows the scale's own evidence rating.

| Evidence rating | Tone |
|---|---|
| Strong | Direct guidance |
| Moderate | Worded as likely to help |
| Mixed or weak | Describes what it sees. No flag |
| Not yet rated | Treated as moderate |

Low agreement changes the message from "improve this" to "your views differ on this".

### Change

- A change shows only between two closed rounds of the same instrument.
- It shows only when it is at least 0.6 scale points. A smaller change reads "within normal variation".
- A scan theme and a diagnostic scale are different measures. Their difference is never shown as change.

### When results open

Nothing shows before a round closes. Until then every page shows the count of answers, never a score.

| Instrument | Closes | Fewer than 4 answers at close |
|---|---|---|
| Leadership Team Scan | When every member has answered, or after 7 days | One 7-day extension, then no team view |
| Full diagnostic | On its date, or at 100% response | One 7-day extension, then no result |
| Pulse | After 7 days, or at 100% response | No result, logged as missed |

- A result is computed once, at close. Answers after the close are not added.
- A closed round is not reopened. This is a proposed rule.
- In the MVP, results open to all members when the round closes.

### What a result may show

| Element | Rule |
|---|---|
| Scale level | Mean to one decimal |
| Agreement | Label only |
| Item level | Mean to one decimal |
| Lowest, highest, median | Never |
| Standard deviation, the agreement number, confidence bands | Never |
| A dot or bar per member | Never |
| Answer distribution per item | Not in the MVP |
| Subgroup cut | Does not exist |

The reason is the same each time. With 4 to 7 answers, each of these shows one person.

## 8. Data and security

### Model

A two-entity spine, group and person, joined by a time-bound membership. The table names follow the architecture document, where a group is called a team.

| Area | Tables |
|---|---|
| Spine | `organisation`, `team`, `person`, `membership` (team, person, role, valid from, valid to) |
| Model as data | `factor`, `instrument`, `instrument_version`, `item`, `template`, `workflow_definition`, `plan`, `cutoff` |
| Scan | `scan_session` (public, becomes a group at sign-up), `scan_response_set`, `scan_response` |
| Group design | `charter`, `charter_version`, `team_task`, `working_agreement` |
| Assessment | `assessment_round`, `participation`, `response_set`, `response`, `factor_score` |
| Individual | `personality_profile`, `profile_share` |
| Meetings | `meeting`, `agenda_item`, `process_comment`, `decision` |
| Development | `focus_area`, `action` |
| Platform | `subscription`, `invoice`, `notification_preference`, `audit_event`, `analytics_event`, `feature_flag`, `config` |

Add tables for Phase 2 only when Phase 2 starts.

### Rules that hold everywhere

- Every row carries an organisation ID. Row-level security is on for every table.
- Group data is readable only through a current membership. Access ends on the membership's end date.
- `participation` says who has answered. `response_set` holds the answers under a random ID. No column, log or timestamp links the two.
- Follow the Orgpuls structure: the answer tables have no column that could hold a link, and time is stored too coarsely to match a person.
- One write path for answers, as in Orgpuls' `submit_response`: one transaction, and it never returns the ID of the row it wrote.
- No client role can select from `response` or `response_set`. They have security on, no policy and no grant. Aggregates come only from database functions.
- Those functions enforce the threshold and the release at close. They return nothing for an open round, and nothing below the threshold.
- `process_comment` carries no person ID.
- `personality_profile` is readable only by its owner. A `profile_share` row is what lets a group see it, at the level shared.
- Every score stores the instrument version and the charter version in force.
- All user-facing text, item wording included, is keyed by locale, with English as the only locale.
- The app holds no service-role client. Scheduled jobs and the dispatcher claim work through narrow database functions.
- Sentral can act on account and billing data through commands. It cannot read answers, profiles or results.
- A round freezes its threshold when it opens, as in Orgpuls.

### Functions to write in SQL

- `close_scan(scan_id)` and `close_round(round_id)`: set the phase, apply the extension rule, compute scores once if the threshold is met.
- `get_team_view(scan_id)` and `get_results(round_id)`: return scores only for a closed round at or above the threshold.
- `get_participation_count(round_id)`: a count only.
- A scheduled job opens pulses, sends reminders and closes rounds.

### Authentication

- Sign-in by email link, valid 15 minutes, usable once.
- A session lasts 30 days on a device.
- Invited scan members answer through the link and never get an account.

### Roles in the MVP

| Role | Can | Cannot |
|---|---|---|
| Visitor | Take the scan and the Leader Profile | See any group data |
| Member | Answer, read group results, propose agenda items, own actions, manage their own profile | See individual answers, or a profile that is not shared |
| Leader | Everything a member can. Edit the charter, open rounds, manage members, manage billing | See who answered what, or a profile that is not shared |

### Rate limits

| Surface | Limit | On breach |
|---|---|---|
| Public scan submission | 60 per IP per hour | HTTP 429 with a retry time |
| Sign-in link requests | 5 per email per hour | HTTP 429 |
| Invitation emails | 50 per group per day | Queue until the next day |
| Authenticated API | 120 requests per user per minute | HTTP 429 |
| Live meeting events | 10 per participant per second | Drop the event and resync |
| Data export | 5 per person per day | HTTP 429 |

A whole group may answer from one office address. That is why the scan limit is per hour, and the response cap per group does the rest.

### Configuration

Hold these as rows, with the defaults and ranges below.

| Setting | Set at | Default | Range |
|---|---|---|---|
| Anonymity threshold | Organisation | 4 | 4 to 8, never lowered |
| Scan window | Group | 7 days | 2 to 14 days, fixed once the scan opens |
| Diagnostic rhythm | Group | Every 6 months | 3 to 12 months |
| Diagnostic window | Group | 14 days | 7 to 30 days |
| Reminder days | Group | 3, 7 and 12 | Any days inside the window |
| Pulse rhythm | Group | Every 4 weeks | 2 to 8 weeks |
| Pulse window | Group | 7 days | 3 to 14 days |
| Active focus areas | Platform | 2 | Fixed |
| Change margin | Platform | 0.6 | Fixed until pilot data exists |
| Agreement cut-offs | Platform | 0.70 and 0.50 | Fixed until pilot data exists |
| Standing cut-offs | Platform | 3.0, 3.4, 3.5, 2.8 | Fixed until pilot data exists |
| Members per group | Platform | 15 | Fixed |
| Retention after cancel | Organisation | 90 days | 30 to 365 days |

### Retention

| Data | Kept |
|---|---|
| Scan answers before sign-up | 90 days, then deleted if no group was created |
| Free group data | While the account is active. Deleted after 12 months without a sign-in |
| Diagnostic and pulse answers, participation, scores | While the subscription is active, plus 90 days |
| Leader Profile | Until the owner deletes. Removed within 30 days of the request |
| Charter, agendas, decisions, actions | While active, plus 90 days |
| Process comments | As long as the meeting |
| Audit and access log | 24 months |
| Analytics events | 24 months |

All data is stored in the EU.

### Audit and analytics

- Audit these events: group created, round opened, round closed, results released, reminder sent, charter version agreed, consent given, sharing changed, profile deleted, plan change, payment failure.
- Record five funnel events, each with its landing page: scan started, scan completed, group invited, team view opened, plan started.
- An analytics event carries no name, no email and no answer.

### Feature flags

Check flags and plan limits on the server on every request. A change takes effect within 60 seconds. Turning a flag off never deletes data. In the MVP only `live_meeting` matters: when off, agendas stay editable and meetings run without sync.

## 9. Seed data

Seed everything in this section through migrations or seed scripts, as rows.

- **Scales.** The 24 rows of Appendix A.
- **Items.** The 96 rows of Appendix B. The diagnostic uses the 72 core items. Store the 24 candidates too, flagged as candidate, and do not show them outside pilot groups.
- **Scan.** The 12 items and six themes of Appendix C.
- **Cut-offs and config.** Section 7 and section 8.
- **Plans.** Section 1.
- **Templates.** A charter template with the three parts. An agenda template that ends with the closing item. The four agenda item types.
- **Demo organisation.** Lumio AS, with the Lumio leadership group of 8 members led by Kari Nordmann. Use invented names for everyone and everything else. It powers demos, tests and the sample pages.

### Leader Profile items and norms

Do not write these from memory.

| Needed | Where it is |
|---|---|
| IPIP-NEO-120 items and keys | The open-source set at `github.com/Alheimsins/b5-johnson-120-ipip-neo-pi-r` |
| Mini-IPIP, 20 items and keys | The International Personality Item Pool site, `ipip.ori.org` |
| Norm table for the full test | The published US sample of 320,128 people. The file is not supplied yet |

Both item sets are public domain. Until the norm table is in the repository, the full result shows the position on the answer scale, as the quick test does, and says so. The band limits against the norm are also not set. Ask before choosing them.

## 10. Names and copy

One name per thing.

| Use | Not |
|---|---|
| LeaderPact, from one constant | Throughline |
| Leadership Team Scan | Team Scan |
| 21 scales and 3 outcomes | 24 scales |
| Team view | Team report |
| Full diagnostic | Extensive or standard diagnostic |
| Task match, time check | Fit check |
| Group | Team, in navigation and settings. "Leadership team" is fine in marketing copy |
| They, for the team leader | She, herself |
| Research-based, not yet validated | Validated, proven |
| Views differ | Low agreement, as a standing |

Copy rules:

- British spelling. Plain words. Sentences under 25 words.
- "Counts only, never names" wherever a response count shows.
- No claim that is not true today. No "most chosen", no pilot numbers, no customer names.
- Sample content is always marked Sample.
- No emoji.

## 11. Where the design file is wrong

The design predates several decisions. Build the right-hand column.

### Whole product

| The design shows | Build |
|---|---|
| A fixed 1280 px layout | Responsive from 360 px |
| A sidebar layout, a width switch and an Appearance tab | The top bar only |
| Click handlers on `div` | Real buttons, links and labelled inputs |
| A floating "Prototype" control and "simulate an answer" buttons | A development-only seed switcher. Nothing of it in production |
| A 360 item in the navigation, and the `cxo` screens | Nothing. The feature is removed |
| "Team Scan" | Leadership Team Scan |
| "24 scales", "ALL 24 SCALES" | 21 scales and 3 outcomes |
| A language picker | English only |

### Scan and Home

| The design shows | Build |
|---|---|
| "At 4 answers the team view opens" | "The team view opens when the scan closes" |
| "3 more answers needed", and a live count toward 4 | The count and the closing date |
| A team view that recalculates with each answer | One result, computed at close |
| "Reminders go only to people who have not answered", on the scan | Reminders to the leader |
| An "Assessment schedule" button on Home | No such button in the MVP |
| The same "more answers needed" message in three cards | Say it once |
| "Biggest change · 0.3 points or more" | 0.6 points |
| A "Contribution feedback" tile | Leave out |
| Landing menu with Research, Templates, For coaches. "Open the demo group" | Leave out |

### Results

| The design shows | Build |
|---|---|
| "How far apart are we?": one dot per anonymous answer, with a 95% band | Leave out. It shows individuals |
| SD, rwg as a number, lowest, median, highest | Leave out |
| "How the 8 members spread", a histogram of members' scores | Leave out |
| Item tables with SD, share who agree, and answer bars | Item text and mean only |
| A priority matrix with a 3.2 line and an rwg axis | Leave out of the MVP. If built later, use the cut-offs of section 7 and three agreement bands |
| A radar chart called Team shape | Leave out of the MVP |
| "Change shown at 0.3 points or more" | 0.6 points |
| Standing with other cut-offs | The one table in section 7 |
| "Strong evidence says" on a scale rated moderate | Tone follows the scale's own rating |
| "Run the results session · 90 minutes", slides and PDF | Leave out |
| "Initiative in the improvement plan", "Add to plan" | "Make this a focus area" |
| Pattern cards and linked practices | Leave out |
| Open questions shown as themes | Leave out |
| "Standard round" and "extensive diagnostic" | One diagnostic of 72 questions |

### Assess

| The design shows | Build |
|---|---|
| Six phases, with session and follow-up | Four: scheduled, answering, closed, released |
| A library with "Standard or extensive", 48 and 74 items | One 72-question diagnostic |
| A picker for who takes part | Every current member |
| "Release results": a choice for the leader | Results open at close |
| Schedule, coverage and library tabs | A plain list |
| Outside view, team-leader feedback, contribution view, profile modules | Leave out |
| "Trend margin 0.3 points" | 0.6 points |

### Group, People, Plan

| The design shows | Build |
|---|---|
| Tasks, open actions and done actions per member | Leave out. It reads as a ranking |
| Composition, coach access | Leave out |
| Team map, person pages with feedback | A simple member list with shared profiles |
| "Positions are against a norm group", on bands that are thirds of the scale | The wording of section 6.17 |
| Initiatives, milestones, a target for round 3, a business measure | Focus areas and actions only |
| The practices tab | Leave out |

### Meetings and Settings

| The design shows | Build |
|---|---|
| "Fit check" for the time check | Task match and time check, two names |
| Meeting series, year plan, "seven typical purposes", meeting roles | Leave out |
| The check-in, with three questions per item | Leave out |
| Decision right per item, "Everyone has given their view" | Leave out |
| Decision log, action log and audit tabs | Leave out. Decisions and actions still save per item |
| A practice prompt in the live meeting | Leave out |
| "VAT 25%" in checkout | Tax by the customer's country |
| A plan list that leaves out meetings | Meetings in every plan list |
| A fixed test card number in the form | A real provider form, or the fake adapter in development |

## 12. Build order

One pull request per milestone. Each ends with its checks passing.

| # | Milestone | Done when |
|---|---|---|
| 0 | The reuse evaluation of section A, as `docs/REUSE_EVALUATION.md` | The owner has answered its questions |
| 0b | Repository, CLAUDE.md, environments, Supabase project in `eu-central-1`, CI, carried over from Orgpuls | A preview deploys from a branch. The gates run in CI, and the database is rebuilt from migrations there |
| 1 | Design tokens and the `/components/lp` set, with a page that shows each | The page matches the design file side by side, at 1280 px and at 390 px |
| 2 | Schema, security policies, seed data, the scoring functions | Anonymity tests and scoring tests pass. No client role can read a response |
| 3 | Landing page, the scan, the personal view | A visitor completes the scan with no account, on a phone, and sees the personal view within 2 seconds |
| 4 | Email sign-in, group creation, the invite link, member answers | Eight browsers answer through one link. The leader sees counts only |
| 5 | Scan close and the team view, with all three states | The team view appears only at close. The under-4 path gives one extension, then no view |
| 6 | App shell, Home on the Free plan, sample pages | Every paid area shows a sample page with the banner |
| 7 | Leader Profile, both lengths, sharing and delete | A profile is unreadable by anyone else until shared. A retake resets sharing |
| 8 | Plans and checkout with the fake payment adapter | Upgrade carries the group, members and scan over. Grace and read-only states work |
| 9 | Group: members and charter with versions | A draft does not change the version in force until the group agrees |
| 10 | Diagnostic round: open, invite, answer, remind, close | Reminders go only to people who have not answered. Close computes scores once |
| 11 | Results in three depths | Every row shows level, agreement label and one standing. No forbidden element appears |
| 12 | Plan: focus areas and actions | A third focus area is refused. An action without an owner is refused |
| 13 | Agenda with task match and time check | An unmatched item is flagged and can be confirmed. Open actions appear on the agenda |
| 14 | Live meeting over Realtime | Two browsers stay in sync within 1 second. Comments carry no sender |
| 15 | Pulses | A pulse assembles in the right order, closes after 7 days and shows change only from 0.6 |
| 16 | Export, delete, notifications, audit, rate limits | An export arrives. A delete removes personal data. Limits return 429 |
| 17 | The Sentral connection: events, commands, audit, resync | An event arrives at Sentral and a command round-trips. A replayed token is refused. The suite proves no answer field can leave |
| 18 | Hardening | The checks of section 13 pass. An accessibility pass is done |

## 13. Tests that must exist

### Anonymity, in the database

- A member, a leader and an anonymous client each fail to select from `response` and `response_set`.
- `get_results` returns nothing for an open round.
- `get_results` returns nothing for a closed round with 3 answers.
- No join of any tables reachable by a client links a person to a response set.
- A staff role cannot read answers, profiles or scores.
- A member of group A cannot read anything of group B.
- A person whose membership has ended cannot read the group.

### The Sentral connection

- No event kind lists an answer, a score, a profile or a respondent. The suite proves the registry.
- A command with a bad signature, a wrong audience, a missing scope or an expired token is refused.
- A token ID seen before is refused.
- Every command that passes the signature leaves an audit row.

### Scoring

- Level, agreement label, standing and change, each against a small fixture with known answers.
- The standing order: descriptive, then task conflict, then low agreement, then the table.
- A change of 0.5 reads "within normal variation". A change of 0.6 shows.
- Identical answers give high agreement.

### Flows, in Playwright

- Scan to personal view, on a 390 px screen.
- Leader saves, invites, members answer, scan closes, team view opens for all.
- Scan closes with 3 answers: extension, then no team view.
- Upgrade, charter, diagnostic round, results, focus area, action, agenda.
- Live meeting in two browsers.

### Accessibility

- Every control is reachable and usable by keyboard.
- Text meets 4.5 to 1, with the fixes of section 4.
- Touch targets are at least 44 px.
- No information is carried by colour alone.

## 14. Open points and gates

These are not yours to settle. Build around them and keep them visible.

| Point | Effect on the build |
|---|---|
| The name is not cleared | One constant for the name. No public launch |
| The payment provider and where the invoice is made | A payment interface and a development adapter only |
| Whether Sentral supports a second product today | Port the Orgpuls contract, and check it from Sentral's side before milestone 17 |
| shadcn/ui or Orgpuls' own primitives | shadcn/ui until the owner answers |
| The agent's operating authority in this repository | Ask before the first deploy or hosted migration |
| Legal review is not done | Privacy and data-processing pages hold a `TODO(owner)` |
| The item bank is a draft | Items are data with a version. Expect wording changes |
| The norm table is not supplied | The full profile falls back to the answer scale |
| The agreement formula is proposed | One function, easy to change |
| The working-agreement pulse item is not worded | A proposed wording, flagged |
| Cut-offs and the 0.6 margin are provisional | Rows of data |
| Whether a closed round can reopen | Proposed: no |
| The theme "Dialogue and conflict" may be renamed "Dialogue" | A label in data |

Ask the owner before you settle any of them.

## Appendix A. Scales

Seed these 24 rows. The key is a proposal. Outcomes carry no evidence rating, since they are what the scales are meant to explain.

| # | Key | Scale | Layer | Reading type | Evidence rating |
|---|---|---|---|---|---|
| 1 | `clear_purpose` | Clear purpose | Conditions | Higher is better | Strong |
| 2 | `team_tasks` | Team tasks | Conditions | Higher is better | Moderate |
| 3 | `size_and_membership` | Size and membership | Conditions | Descriptive | Mixed or weak |
| 4 | `composition` | Composition | Conditions | Descriptive | Mixed or weak |
| 5 | `rewards` | Rewards | Conditions | Higher is better | Moderate |
| 6 | `information_and_support` | Information and support | Conditions | Higher is better | Moderate |
| 7 | `preparation` | Preparation | Processes | Higher is better | Not yet rated |
| 8 | `meeting_goals` | Meeting goals | Processes | Higher is better | Moderate |
| 9 | `focus` | Focus | Processes | Higher is better | Moderate |
| 10 | `dialogue` | Dialogue | Processes | Higher is better | Moderate |
| 11 | `task_conflict` | Task conflict | Processes | Conditional | Moderate |
| 12 | `relationship_conflict` | Relationship conflict | Processes | Lower is better | Strong |
| 13 | `political_behaviour` | Political behaviour | Processes | Lower is better | Moderate |
| 14 | `behavioural_integration` | Behavioural integration | Processes | Higher is better | Strong |
| 15 | `external_relations` | External relations | Processes | Higher is better | Not yet rated |
| 16 | `learning` | Learning | Processes | Higher is better | Moderate |
| 17 | `team_leadership` | Team leadership | Processes | Higher is better | Strong |
| 18 | `psychological_safety` | Psychological safety | States | Higher is better | Strong |
| 19 | `trust` | Trust | States | Higher is better | Strong |
| 20 | `cohesion` | Cohesion | States | Higher is better | Strong |
| 21 | `norms` | Norms | States | Higher is better | Not yet rated |
| 22 | `direction_alignment_and_commitment` | Direction, alignment and commitment | Outcomes | Higher is better | None, self-rated outcome |
| 23 | `viability` | Viability | Outcomes | Higher is better | None, self-rated outcome |
| 24 | `member_growth` | Member growth | Outcomes | Higher is better | None, self-rated outcome |

Counts: 6 conditions, 11 processes, 4 states and 3 outcomes.

## Appendix B. Item bank

Seed these 96 rows as version 1 of the bank. They are drafts, so expect wording changes as new versions.

- **Core**: one of the 72 items of the full diagnostic.
- **Core, scan**: also one of the 12 scan items.
- **Candidate**: stored, and shown only to pilot groups.

| # | Scale | Item | Use |
|---|---|---|---|
| 1 | Clear purpose | We agree on what this leadership team is for. | Core, scan |
| 2 | Clear purpose | We know what this team adds beyond what each of us does in our own unit. | Core |
| 3 | Clear purpose | Our purpose tells us what to say no to. | Core |
| 4 | Clear purpose | I could explain this team's purpose to a new member in two sentences. | Candidate |
| 5 | Team tasks | The issues on our agenda are ones that need the whole team. | Core, scan |
| 6 | Team tasks | We know which decisions belong to this team and which belong elsewhere. | Core |
| 7 | Team tasks | We spend our time together on what only this team can do. | Core |
| 8 | Team tasks | We know which tasks we own together. | Candidate |
| 9 | Size and membership | We agree on who belongs to this team. | Core |
| 10 | Size and membership | The team is small enough for everyone to take a real part in discussions. | Core |
| 11 | Size and membership | The right people are members of this team. | Core |
| 12 | Size and membership | Membership of this team has been stable over the past year. | Candidate |
| 13 | Composition | Together we have the expertise our tasks require. | Core |
| 14 | Composition | Members have clearly different professional backgrounds. | Core |
| 15 | Composition | The viewpoints we need are present when we discuss major issues. | Core |
| 16 | Composition | Every important area of the organisation has a voice in this team. | Candidate |
| 17 | Rewards | Part of how each of us is assessed depends on shared results. | Core |
| 18 | Rewards | Helping a colleague's unit succeed is recognised here. | Core |
| 19 | Rewards | Our goals reward working together. | Core |
| 20 | Rewards | What gets rewarded here matches what we say matters. | Candidate |
| 21 | Information and support | We have the facts we need in time to decide well. | Core |
| 22 | Information and support | The team gets the support it needs to improve how it works. | Core |
| 23 | Information and support | We have the specialist help we need for difficult issues. | Core |
| 24 | Information and support | The figures we are given are accurate. | Candidate |
| 25 | Preparation | The meeting papers arrive several days ahead. | Core |
| 26 | Preparation | Members come to our meetings prepared. | Core |
| 27 | Preparation | Items for decision come with a written proposal. | Core |
| 28 | Preparation | Whoever owns an agenda item knows what is expected of them. | Candidate |
| 29 | Meeting goals | For each agenda item, it is clear what we are meant to achieve. | Core, scan |
| 30 | Meeting goals | We know before each item whether we are there to listen, to discuss or to decide. | Core |
| 31 | Meeting goals | We know when an agenda item is finished. | Core |
| 32 | Meeting goals | We agree at the start of an item what a good result would be. | Candidate |
| 33 | Focus | Our discussions stay on the item at hand. | Core, scan |
| 34 | Focus | We finish one question before we move to the next. | Core |
| 35 | Focus | When a side issue comes up, we leave it for later. | Core |
| 36 | Focus | We return quickly to the topic when a discussion moves away from it. | Candidate |
| 37 | Dialogue | When someone offers an idea, others add to it. | Core |
| 38 | Dialogue | We explore an issue before we take positions. | Core, scan |
| 39 | Dialogue | We ask questions to understand each other's views. | Core, scan |
| 40 | Dialogue | Members change their view when they hear a better argument. | Candidate |
| 41 | Task conflict | When members see an issue differently, they tell the team. | Core |
| 42 | Task conflict | We tell each other where a proposal is weak. | Core |
| 43 | Task conflict | We debate the options before we decide. | Core |
| 44 | Task conflict | Disagreements are stated in the meeting itself. | Candidate |
| 45 | Relationship conflict | Disagreements about issues turn personal. | Core |
| 46 | Relationship conflict | Some members clearly irritate each other. | Core |
| 47 | Relationship conflict | Some members are unfriendly to each other. | Core |
| 48 | Relationship conflict | Some members avoid each other. | Candidate |
| 49 | Political behaviour | Members hold back information to protect their own position. | Core |
| 50 | Political behaviour | Some members agree on the outcome between themselves before the meeting. | Core |
| 51 | Political behaviour | Members say one thing in the meeting and another outside it. | Core |
| 52 | Political behaviour | Some members put their own interests ahead of the team's. | Candidate |
| 53 | Behavioural integration | We share the information colleagues need without being asked. | Core, scan |
| 54 | Behavioural integration | Each member's view counts in our major decisions. | Core, scan |
| 55 | Behavioural integration | We help each other in practical ways when a unit is in difficulty. | Core |
| 56 | Behavioural integration | We weigh how a decision in one unit affects the others. | Candidate |
| 57 | External relations | We keep close contact with the people outside the team who matter for our results. | Core |
| 58 | External relations | Our units coordinate well between meetings. | Core |
| 59 | External relations | Before a major decision, we ask the people it will affect. | Core |
| 60 | External relations | People affected by a decision hear about it from us first. | Candidate |
| 61 | Learning | Our own teamwork is a regular item on our agenda. | Core |
| 62 | Learning | We change how we work when something fails. | Core |
| 63 | Learning | When we make a mistake, we find out why. | Core |
| 64 | Learning | We ask people outside the team how they think we are doing. | Candidate |
| 65 | Team leadership | The team leader makes sure our priorities are clear. | Core |
| 66 | Team leadership | It is easy to disagree with the team leader. | Core |
| 67 | Team leadership | The team leader makes sure decisions are followed up. | Core |
| 68 | Team leadership | The team leader deals with tension in the team before it grows. | Candidate |
| 69 | Psychological safety | I can admit a mistake here without paying a price for it. | Core, scan |
| 70 | Psychological safety | I can say what I really think here, even when others disagree. | Core |
| 71 | Psychological safety | I can point out a problem here as soon as I see it. | Core |
| 72 | Psychological safety | I can raise a concern here before I am sure I am right. | Candidate |
| 73 | Trust | The other members do what they say they will do. | Core, scan |
| 74 | Trust | I trust the intentions of the other members. | Core |
| 75 | Trust | When I ask other members to keep something private, they do. | Core |
| 76 | Trust | The other members lead their own units well. | Candidate |
| 77 | Cohesion | We are committed to this team's shared tasks. | Core |
| 78 | Cohesion | Members put the whole organisation before their own unit. | Core |
| 79 | Cohesion | Membership of this team matters to the people in it. | Core |
| 80 | Cohesion | We feel like one team. | Candidate |
| 81 | Norms | We have a shared set of working agreements. | Core |
| 82 | Norms | We follow our working agreements in practice. | Core |
| 83 | Norms | We speak up when someone breaks our agreements. | Core |
| 84 | Norms | A new member quickly learns how we work together. | Candidate |
| 85 | Direction, alignment and commitment | People in the organisation know which priorities this team has set. | Core, scan |
| 86 | Direction, alignment and commitment | Our units work towards the same goals. | Core |
| 87 | Direction, alignment and commitment | What we decide here gets done. | Core, scan |
| 88 | Direction, alignment and commitment | After a meeting, we all support what we decided. | Candidate |
| 89 | Viability | I want to keep working in this team. | Core |
| 90 | Viability | After a hard discussion, we cooperate as well as before. | Core |
| 91 | Viability | We would choose to work together again. | Core |
| 92 | Viability | We work better together now than we did a year ago. | Candidate |
| 93 | Member growth | I leave our meetings better equipped to lead my own unit. | Core |
| 94 | Member growth | I learn from the other members of this team. | Core |
| 95 | Member growth | I leave our meetings with more energy than I came with. | Core |
| 96 | Member growth | The team makes me a better leader. | Candidate |

## Appendix C. Leadership Team Scan

Twelve items in six themes, shown in this order. A theme score is the mean of its two items.

| Order | Theme | Item | Bank item |
|---|---|---|---|
| 1 | Purpose and priorities | We agree on what this leadership team is for. | 1 |
| 2 | Purpose and priorities | The issues on our agenda are ones that need the whole team. | 5 |
| 3 | Meetings | For each agenda item, it is clear what we are meant to achieve. | 29 |
| 4 | Meetings | Our discussions stay on the item at hand. | 33 |
| 5 | Dialogue and conflict | We explore an issue before we take positions. | 38 |
| 6 | Dialogue and conflict | We ask questions to understand each other's views. | 39 |
| 7 | Working as one team | We share the information colleagues need without being asked. | 53 |
| 8 | Working as one team | Each member's view counts in our major decisions. | 54 |
| 9 | Safety and trust | I can admit a mistake here without paying a price for it. | 69 |
| 10 | Safety and trust | The other members do what they say they will do. | 73 |
| 11 | Results | People in the organisation know which priorities this team has set. | 85 |
| 12 | Results | What we decide here gets done. | 87 |

Answer options for every item run from 1, Strongly disagree, to 5, Strongly agree. The design names only the two end points. Proposed for the middle: 2 Disagree, 3 Neither agree nor disagree, 4 Agree.


## Appendix D. Sources

The owner's documents hold the reasoning behind this handoff. This document is enough to build from.

- Product requirements: `https://claude.ai/code/artifact/fb270b9f-df9d-444b-a623-63c79caf888e`
- Product specification and Questionnaires tab: `https://claude.ai/code/artifact/963c39a9-f7e4-47f3-89e8-a5d8c7f586be`
- Structure and architecture: `https://claude.ai/code/artifact/2983de75-548c-41b7-9eef-8cce30c7f34a`
- Design change brief: `https://claude.ai/code/artifact/80b6afc5-e5fd-4ee4-bec7-e18357e7bc1d`
- Design reference: `LeaderPact App - Cream v2.dc.html`, read in full on 11 October 2026
- Orgpuls repository at commit `6f5d441`, surveyed on 11 October 2026: `CLAUDE.md`, `package.json`, the directory layout, `docs/platform/PLAN.md` and migration `0205_platform_api.sql`. Its code was not read file by file, which is the job of section A
