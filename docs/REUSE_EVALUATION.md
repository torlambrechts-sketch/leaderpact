# LeaderPact: reuse evaluation of Orgpuls

Milestone 0 of the handoff (`docs/LEADERPACT_HANDOFF.md`, section A). No feature code is written until
the owner has answered section 2.

| | |
|---|---|
| Date | 11 October 2026 |
| Orgpuls read at | `torlambrechts-sketch/Orgpuls` commit `6f5d441` |
| Sentral read at | `torlambrechts-sketch/Owntheagenda_Admin` commit `f6a43bd` (attached read-only for this evaluation) |
| Method | Nine reviewers read the code read-only, one area each, and cited `file:line`. The lead verified the claims that carry a decision. No file in either repository was changed. |
| Status | **All questions answered** by the owner on 11 October 2026 (section 2.0). Milestone 0 is complete. |

Every `file:line` below is at the commit above. Migration numbers are Orgpuls's unless they say otherwise.

---

## 1. Summary

### Verdict per area

| # | Area | Verdict | In one line |
|---|---|---|---|
| 1 | Agent setup | Adapt | Keep the structure of `CLAUDE.md` and the audit method. Do not copy `.claude/settings.json`: it is bypass mode with an empty deny list. |
| 2 | CI and gates | Adapt | The one-job skeleton, the SQL suite runner and the wiring audit port. About half of the steps are Orgpuls-only. |
| 3 | Supabase clients | Reuse as it is | Six small files port unchanged. The app holds no service-role key, as claimed. Realtime needs a browser client that Orgpuls lacks. |
| 4 | Anonymous answers | Adapt | The structure ports. The write path is new: LeaderPact has a signed-in member and an open link, Orgpuls has neither. |
| 5 | Threshold as functions | Reuse the mechanism | Change the numbers to 4 and 8 and remove the path down. |
| 6 | Rounds and reminders | Adapt the SQL engine | Orgpuls computes results live on every read. LeaderPact must compute once, at close. |
| 7 | Answering a questionnaire | Adapt | The draft-on-device pattern and the radio group port. The routes do not. Orgpuls has no shared answering link. |
| 8 | Mail | Adapt | Outbox, claim and lease, the Brevo sender and the auth hook port. Cut the dispatcher by about 60%. |
| 9 | Billing state | Adapt the pattern | One state row, one access function, the deletion routine. Plans, prices and the narrow read-only rule do not port. Nothing in either system makes an invoice or records a payment. |
| 10 | Data as rows | Adapt the pipeline | Validate, hash and sync port. The module schema is fixed to Norwegian rules and refuses a threshold of 4. |
| 11 | Text and locale | Adapt | Keep five small pieces. The multilingual machinery is not needed for English only. |
| 12 | Fixtures and demo | Adapt the technique | Generate answers backwards from target figures, and copy a demo template. The scenario is new. |
| 13 | Visual checks | Adapt | Capture, probe and side-by-side tools port. The 0.1% pixel gate does not. **The design file renders only its landing page** (section 2, question B1). |
| 14 | Flags | Do not reuse the mechanism | Orgpuls flags come from an env var and change only on redeploy. LeaderPact needs a table and a 60-second cache. |
| 15 | Sign-in | Adapt | Orgpuls customers sign in with a password. The email-link parts exist and assemble into LeaderPact's flow. |
| 16 | Export | Do not reuse | "Download my data" does not exist in Orgpuls. Reuse the zip writer and the catalogue-driven deletion routine. |
| 17 | The platform API | Adapt | The command and event contract ports almost verbatim, with two defects fixed. **Sentral cannot take a second product yet.** |

### What the owner should know first

1. **Sentral is ready in its data model, not in its wiring.** It has products, installations and accounts.
   But its events endpoint, its command signer and its audience are hard-coded to Orgpuls. About seven
   changes in Sentral connect LeaderPact. Neither system makes invoices (section 6).
2. **The design file now renders in full.** As first supplied, only the landing page rendered. The owner
   then supplied `proto-core-v5.js` and `support.js`, and all 14 screens render (question B1, section 4.13).
3. **The anonymity structure ports, but the threat is different.** In Orgpuls, managers read employees'
   answers. In LeaderPact every reader answered too. Three new design points need the owner (questions
   C1 to C4).
4. **A linkage channel exists in Orgpuls and must not be carried over.** Marking a person as answered and
   writing their answers happen in one transaction. Both rows then carry the same transaction ID, so one
   SQL join names every respondent to anyone with database access. Migration 0229 closed the same class
   of leak for timestamps. LeaderPact closes this one at round close (section 4.4).
5. **Payment has no home yet.** Orgpuls collects billing details and invoices by hand. Sentral has no
   invoice. Nothing tells either product "paid", "overdue" or "failed". The handoff's plan holds: plan state
   and a `PaymentProvider` interface with a development adapter, and no vendor (question D1).

### What has no counterpart in Orgpuls

These are built new, with Orgpuls patterns where one fits:

- **The live meeting.** Orgpuls has no Realtime, no presence and no browser client.
- **The Leader Profile.** It is person-linked data by design and needs its own tables.
- **Scoring.** The agreement index, the standing rules and the 0.6 change margin.
- **A results snapshot at close,** with the outcomes released, no result and missed.
- **Close at 100% response.**
- **Pulse assembly.** Focus items first, then agreement items, then rotating items.
- **Charter versions, agendas, task match and time check, focus areas.** Orgpuls's measures table (0013)
  is a pattern for actions.
- **The shared invite link,** with its cap and replacement.
- **A table-backed flag.**
- **HTTP 429 responses.** Orgpuls returns none.
- **Per-person notification summaries.**
- **"Download my data".**
- **A `PaymentProvider` and the checkout.**

---

## 2. Questions for the owner

### 2.0 Answers received, 11 October 2026

| # | Answer | Effect |
|---|---|---|
| A1 | **Full Orgpuls authority**, including its bypass settings | `CLAUDE.md` carries Orgpuls's build-phase authority, and `.claude/settings.json` is copied as it is. Not the recommended default. The safeguard moves into `CLAUDE.md`: LeaderPact's project ref is the only Supabase project an agent may touch. |
| A2 | **Created by the agent: `leaderpact`, ref `tgxjbshdjwoemsmrtkzw`, eu-central-1, on the free plan** (organisation `vercel_icfg_TuXKkB6YTdYbFaAe3z5nN3sv`, the one the connector reaches). Created 11 October 2026; Postgres 17.11, empty, with `pgcrypto` and `supabase_vault`. | Not the default (Pro, own organisation). The owner chose free for the build. Its limits: the project pauses after a week without activity, there is no point-in-time backup, and no server-side session time-box, so the 30-day session rests on the cookie's lifetime until the project moves to Pro. `CLAUDE.md` names `tgxjbshdjwoemsmrtkzw` as the only Supabase project an agent may touch. |
| A3 | The owner links Vercel, region `fra1` | As recommended |
| A4 | shadcn/ui hybrid on Tailwind 3.4 | As recommended (section 7) |
| A5 | One CI job per pull request; heavy flows on `main` and nightly | As recommended |
| B1 | **The owner supplied `proto-core-v5.js` and `support.js`** | Committed in `design/reference/`. All 14 screens render (section 4.13). |
| Reference | **Cream v2 is the only visual reference.** The bundle's purple Manrope `LeaderPact.dc.html` is not used. | `design/reference/README.md` |
| B2 | Take what the design uses | `#ddd5c8` for secondary borders; the other colours and the 8, 9 and 16 px radii become tokens |
| B3 | Rules, axe and a person's review at 390 and 360 px | As recommended |
| C1 | Accept padding on the open link, with honest copy | As recommended |
| C2 | A sealed replace key, deleted at close | As recommended |
| C3 | Reshuffle at close | As recommended |
| C4 | The leader counts toward the cap and toward the 4 | As recommended |
| C5 | Change across versions only when a scale's core items are identical | As recommended |
| C6 | Freeze level, label and standing at close; version the cut-offs | As recommended |
| C7 | The members invited at opening are the denominator | As recommended |
| C8 | Every diagnostic item is required | As recommended |

| C9 | Answers of a round that ends below 4 are deleted at close | As recommended |
| C10 | "Never lowered" is absolute, with warnings | As recommended |
| C11 | Released means the snapshot exists and is shown | As recommended |
| D1 | Hybrid: plan state and a `PaymentProvider` in LeaderPact, card payments by provider webhook later, invoice payments marked by a new Sentral command `billing.set_status` | As recommended |
| D2a | **A 14-day Team trial.** When it ends unpaid, the group returns to Free and the Team data is kept 90 days, then deleted unless they subscribe. | Not the default (no trial). Adds a `trial` state to the plan states, `trial_started_at` and `trial_ends_at` to `billing.changed`, and a trial-ending mail. |
| D2b | On Team to Free, history is deleted after 90 days; the latest scan stays | As recommended |
| D2c | The payment provider computes tax | As recommended |
| D3 | The same Brevo account as Orgpuls, with a verified LeaderPact sender domain | As recommended. `MAIL_FROM` and the reply-to address are still to be named: `TODO(owner)` before milestone 4. |
| D4 | **Google sign-in** beside the email link; no Microsoft | Not the default (neither). Orgpuls's Google path ports: `lib/auth/google.ts` and the Google branch of `oauth.ts` and `app/auth/callback/route.ts`. |
| D5 | Reminders link to the app; the member signs in by email link | As recommended |
| D6 | "Download my data" arrives as an emailed one-time link, valid 24 hours | As recommended |
| D7 | "Delete my results" covers the Leader Profile and its shares | As recommended |
| D8 | Pilot groups are named by a Sentral command, `modules.pilot` | As recommended |
| E1 | Sentral is attached with write access at milestone 17 | As recommended |
| E2 | Sentral is extended with neutral names: one `product-events` receiver, `x-platform-*` headers, a `product` field, one key per product | As recommended |
| E3 | `member.joined`, `member.left` and a new `member.invited` | As recommended |
| E4 | `usage.daily` and `orgs.get` are trimmed | As recommended |
| E5 | No organisation number is sent for now | As recommended |
| E6 | One organisation per tenant; seats = paid groups; price per interval in USD; revenue per currency | As recommended |
| E7 | LeaderPact sends its own account mail; support by email only | As recommended |
| E8 | No erasure command for Sentral | As recommended |

Two answers differ from the recommended defaults beyond A1 and A2: the trial (D2a) and Google sign-in (D4). The tables below keep the questions as they were asked.

Each question has a recommended default. "Agree to all defaults except …" is a complete answer. The
**Blocks** column says which milestone waits for it.

### A. Before milestone 0b: repository, project and CI

| # | Question | Recommended default | Blocks |
|---|---|---|---|
| A1 | **Operating authority** (handoff question 5). Does the build-phase authority in Orgpuls's `CLAUDE.md` apply here? Orgpuls's own `.claude/settings.json` is `bypassPermissions` with an empty deny list, so the file grants in practice whatever the prose allows. The file is read once per session, so the answer must be committed before the first build session. | Grant the same build-phase authority, except: ask before the first hosted migration and before the first production deploy (as handoff section 14 says). Settings: default mode with `ask` on `apply_migration`, `execute_sql`, `deploy_edge_function` and a push to `main`. | 0b |
| A2 | **The Supabase project.** None exists for LeaderPact. Who creates it, and on which plan? The 30-day session limit is a paid-plan setting. Should it sit in a Supabase organisation of its own? The connector reaches every project in an account, so separation from Orgpuls is otherwise by discipline only. | A new project `leaderpact`, eu-central-1, Pro plan, in its own Supabase organisation. The owner creates it, and its ref goes into `CLAUDE.md` as the only project an agent may touch. | 0b |
| A3 | **The Vercel project.** I could not see Vercel from this session (the API answered "missing authentication token"). Is a project linked to this repository? | The owner links the repository. Previews per branch, production from `main`, region `fra1` as in Orgpuls. | 0b |
| A4 | **shadcn/ui or Orgpuls's own primitives,** and **Tailwind 3 or 4.** | shadcn/ui for the controls that carry behaviour (Button, Tabs, RadioGroup, Dialog, DropdownMenu, Sheet, Tooltip, Switch, Checkbox, Progress, Sonner). Restyle them to the tokens. Build the other 16 of the 21 components in `/components/lp` (section 7). Tailwind 3.4 for parity with Orgpuls (section 7). | 1 |
| A5 | **The Actions budget.** The repository is private. Orgpuls cut CI to one job to save minutes (D-215). Playwright with Realtime and two browsers is the heaviest step. | One job per pull request, as in Orgpuls. The two-browser live meeting flow runs on pushes to `main` and nightly. | 0b |

### B. Before milestone 1: design system

| # | Question | Recommended default | Blocks |
|---|---|---|---|
| B1 | **Answered: supplied.** ~~Please supply `proto-core-v5.js` and the `support.js` the design was built with, or a standalone export with its resources inlined.** The file reads every value from `window.LTCore` (design line 1654). Without it, only the landing page renders, and 17 of the 21 components cannot be captured.~~ | No default. Without the files, components are compared against hand-made specimens of the design's static markup. That is weak evidence, so it is logged. | 1 |
| B2 | **Missing tokens.** The design uses `#ddd5c8` 69 times, 64 of them as the secondary-button border. The handoff assigns that border to `#d8d0c2`, which appears 4 times. Also used but not listed: `#36342f` (26 times, text), `#ebe5da` (8, card border), `#efe9df` (7, SAMPLE chip and rules), `#2b2a26`, `#4b3a8f`, `#4f33b8`. The radius table omits 8, 9 and 16 px (35, 44 and 22 uses). | Take what the design uses: `#ddd5c8` for secondary borders, and add the others as tokens with the role measured. | 1 |
| B3 | **The 390 px check.** The design has no phone layout: it is `min-width:1280px`. | At 390 px and 360 px: no sideways scroll, body text at least 15 px, inputs at least 16 px, targets at least 44 px, axe clean, and a person reviews the screenshots. | 1 |

### C. Before milestone 2: schema and anonymity

| # | Question | Recommended default | Blocks |
|---|---|---|---|
| C1 | **Padding on the open scan link.** The cap stops more answers than members, not fake ones. A leader can declare 4 members, answer three times from private windows, and wait for one real answer. Their own three answers then give that member's six theme scores exactly. Orgpuls rejected an open link for this reason (X-064, `DECISION_LOG.md:2028-2033`). Per-member links do not help while the leader distributes them. | Accept for the free scan, and say nothing in the copy that promises more. The scan items are team-level perceptions. The diagnostic and pulses cannot be padded: one participation row per signed-in member. | 3, 4 |
| C2 | **Replacement from the same browser** (handoff 6.5). Replacing needs the database to find the earlier set. Any design that does this is a link between a browser and a response, which Orgpuls's invariant 2 forbids. | Allow it with a sealed key: its own table holding only a SHA-256, no policy and no grant for any role, deleted when the scan closes (section 4.4). The first submission's slot is reused. | 4 |
| C3 | **Linkage through the database itself** (summary point 4). Writing "answered" and the answers in one transaction gives both rows the same `xmin`. Their physical order gives a second link. | At close, inside the closing transaction: re-insert the round's response sets in random order with new IDs, delete the originals, and rewrite every participation row. What remains is the open window, WAL and backups, and API logs (the JWT subject and time of each submit). Keep log retention short and state this residual honestly. | 2 |
| C4 | **Who counts.** Does "number of members" include the leader? Does the leader's own scan count toward the cap and toward the 4? | Yes to both. A group of 4 is the leader and three others. | 3 |
| C5 | **Change across item versions.** When an item is reworded in a new bank version, does change still show between rounds on the two versions? | Change shows per scale only when its three core items are identical in both versions. Otherwise: "Not comparable: the questions changed". | 2 |
| C6 | **Cut-offs and stored results.** If cut-offs are rows the pilot resets, re-reading old rounds changes their standings. | Store the level, the agreement label and the standing at close in the snapshot. Version the cut-offs. A result never changes after it is made. | 2 |
| C7 | **Membership changes during an open round.** Is a member who joins or leaves while a round is open in the denominator? | The members invited at opening are the denominator. A leaver's answer, if given, stays; their participation row goes. A joiner waits for the next round. | 10 |
| C8 | **Skipping an item** in the diagnostic. | No. The review page lists gaps and submit waits for them. Every cell then has the round's n, and no per-item threshold is needed. | 10 |
| C9 | **Answers of a round that ends below 4.** | Deleted at close, with the snapshot recording "no result". | 5, 10 |
| C10 | **"Never lowered"** for the threshold. Is it absolute, even after a mistaken raise? | Absolute, as written. Warn before a raise, and warn when a round opens with fewer members than k. | 2 |
| C11 | **"Closed" and "released"** when results open at close. | Closed: the window has ended. Released: the snapshot exists and is shown. A round below 4 is closed and never released. | 2 |

### D. Before a later milestone

| # | Question | Recommended default | Blocks |
|---|---|---|---|
| D1 | **Where the invoice is made** (handoff question 3). Orgpuls collects details and invoices by hand outside code (`DECISION_LOG.md:3088`). Sentral has no invoice table and no provider (its D-22: "Stripe waits"). Neither records a payment. | LeaderPact keeps plan state and access. A `PaymentProvider` with a development adapter. Card payments later through a provider webhook into LeaderPact. Invoice payments marked by a new Sentral command, `billing.set_status`, under `billing:write`. | 8 |
| D2 | **Trial, downgrade, tax.** Is there a trial? On Team to Free, is history deleted after 90 days or hidden? Is tax computed by the provider? | No trial. History is deleted 90 days after the downgrade, and the latest scan stays. The provider computes tax. | 8 |
| D3 | **Mail** (handoff question 4). Is it the same Brevo account as Orgpuls, with LeaderPact's own sender domain? Which `MAIL_FROM` and reply-to? Sentral already keys senders per product (`sender_domains.product`). | Same Brevo account, a verified LeaderPact sender domain, a reply-to the owner names. | 4 |
| D4 | **Google and Microsoft sign-in.** | Neither in the MVP. If Microsoft comes later, port Orgpuls's identity binding (0155, 0156), not only the provider switch. | 4 |
| D5 | **Diagnostic reminder links.** Does a reminder open the questionnaire without sign-in, or does the member sign in by email link? | Sign in by email link. No second credential to carry or leak. | 10 |
| D6 | **How the export arrives.** | An emailed one-time link to a file served by the app, valid 24 hours. | 16 |
| D7 | **"Delete my results".** What does it cover, since group answers cannot be linked to anyone? | The Leader Profile and its shares. Group answers are already anonymous and stay. The page says so. | 16 |
| D8 | **Pilot groups** for the 24 candidate items. Who names them? | A Sentral command, `modules.pilot`, as in Orgpuls. | 10 |

### E. Sentral (handoff questions 1 and 2, and the contract)

| # | Question | Evidence and recommended default | Blocks |
|---|---|---|---|
| E1 | **Which repository is Sentral?** (handoff question 1) | **Answered by Orgpuls's own log:** `Owntheagenda_Admin`, Supabase project `zuvqbaejoktpekfsiyyr`, eu-central-1 (X-106, `DECISION_LOG.md:3342`). It is attached read-only to this session. Default: attach it with write access at milestone 17, in a session whose `CLAUDE.md` is Sentral's own. | 17 |
| E2 | **Does Sentral support a second product?** (handoff question 2) | **No, not yet.** The data model does, the wiring does not (section 6.2). Default: extend Sentral first, with neutral names: one `product-events` receiver, headers `x-platform-timestamp` and `x-platform-signature`, a `product` field, and one signing key per product. | 17 |
| E3 | **Event names.** The handoff proposes `user.invited`, `user.joined` and `user.removed`. Orgpuls emits, and Sentral projects, `member.joined` and `member.left`. | Use `member.joined` and `member.left`, and add `member.invited`. | 17 |
| E4 | **A smaller `usage.daily`** and a trimmed `orgs.get`. A round's close date tells Sentral that every member answered, and an extension tells it fewer than 4 did. For a one-group organisation that is a response count for a named round. | `usage.daily`: `members`, `groups`, `rounds_started` and `meetings_held` (both cumulative), and `last_sign_in_on` (a date). No open or closed counts, and no close dates. | 17 |
| E5 | **Organisation numbers.** Sentral requires nine digits (`^\d{9}$`), and one wrong value fails the whole event batch. | Send no organisation number until Sentral accepts other formats. | 17 |
| E6 | **What a tenant is** in Sentral, and how revenue in USD is counted. Sentral sums NOK only. | One organisation per tenant. `seats` is the number of paid groups, and `price` is the total per interval. Revenue is reported per currency. | 17 |
| E7 | **Lifecycle mail and support.** Who sends renewal and cancellation mail? How does a customer reach support? | LeaderPact sends its own account mail. Support by email only in the MVP, with no `support.requested` event. | 8, 17 |
| E8 | **Erasure by command.** Should Sentral be able to delete an organisation now (`orgs:write`)? | No. Deletion follows the retention rules and the person's own request. | 17 |

---

## 3. How the two products differ

These differences explain most verdicts below.

| | Orgpuls | LeaderPact |
|---|---|---|
| Who reads results | Managers, about employees' answers | The same people who answered, in a group of 4 to 15 |
| Who answers | Employees with no account, through a personal token link | Signed-in members for the diagnostic and pulses. Anyone with the shared link for the scan. |
| The tenant | An organisation. Memberships are organisation-wide with an `active` flag (`0001_foundation.sql:57-66`). "Groups" are respondent cells for k, not tenants. | A group (`team`) inside an organisation. Membership is per group and time-bound (valid from, valid to). A person can be in several groups. Billing is per group. |
| When results exist | Computed live on every read, gated on `status='lukket'` (0042) | Computed once at close and stored |
| Subgroups | Yes, with k per cell and complementary suppression | None. A subgroup filter must never exist. |
| Languages | `no` and `en`, survey languages pl, uk, lt, sv and da, market packs | English only |
| Real time | None | The live meeting over Realtime with presence |
| Sign-in | Password, Google, Microsoft | Email link |

**The reader is a respondent.** This matters most. At k = 4 a reader can subtract their own answers, so
the anonymity set against any one member is 3. Three members who share their answers learn the fourth's
exactly. That is inherent in a threshold of 4, and it is why handoff section 7 forbids lowest, highest,
spread and per-member marks. The build adds nothing to that list.

---

## 4. Area by area

Each area gives the verdict, the Orgpuls files, what changes, the tests that travel with it, and the risks.
Coupling to strip is listed where it is not obvious from the change list.

### 4.1 Agent setup

**Verdict.**
- Adapt `CLAUDE.md` (keep the structure, rewrite the content), the audit skill (keep the method) and `docs/CLOUD_SETUP.md`.
- Reuse as they are: `.mcp.json`, `scripts/playwright-mcp.sh` and `scripts/cloud-env-setup.sh`.
- Reuse `scripts/cloud-session-start.sh`, and wire it. It calls itself a SessionStart hook, but no hook runs it in Orgpuls.
- **Do not copy `.claude/settings.json`.**

**Files.** `CLAUDE.md` (222 lines), `.claude/settings.json` (16), `.mcp.json` (10), `.claude/skills/audit/`
(`SKILL.md` 229, `journeys.md` 111, `allowlist.json` 81, `sql/security.sql` 50, `sql/wiring.sql` 21),
`scripts/cloud-*.sh`, `scripts/playwright-mcp.sh`, `docs/CLOUD_SETUP.md` (153).

**`CLAUDE.md`, section by section.**

| Orgpuls section (lines) | For LeaderPact |
|---|---|
| Intro (1-13): § 4-3, QPS Nordic, Arbeidstilsynet | Rewrite around the three promises of handoff section 1 |
| Stack (15-23) | Keep. Restate the font rule for Figtree and Poppins: the same files in the app and in the visual check. |
| Design fidelity (25-39) | Does not carry. Keep only "every UI string comes from next-intl" and "match the design where it is right", with section 11 of the handoff as the named exceptions. |
| Security invariants (41-75) | Keep the structure. k values become 4 and 8. Use the answer table names of handoff section 8. Drop the X-103 exception. Add "no service-role client in the app". |
| Data-not-code (77-82) | Keep, as "Model as data" |
| Translations (84-92) | Drop: English only |
| Never fabricate data (94-100) | Keep word for word (the handoff asks for this) |
| Control substitution (102-107) | Drop. It is a pixel-fidelity rule and conflicts with shadcn/ui. |
| Immutability triggers (109-115) | Keep word for word |
| Testing gates (117-126) | Drop the pixel gate and the "61 / 28 av 34" figures. Keep the rest. |
| The fixture (128-133) | Keep the rule and name the new generator |
| Definition of done (135-138) | Drop the pixel diff and `no`. Add the accessibility checks of handoff section 13. |
| Operating authority (140-166, 195-202) | Waits for question A1. Keep the parts that restrain anyway: secrets (158-160) and "when a tool refuses" (162-166). |
| Deployment playbook (168-193) | Keep the technical facts: database first; `apply_migration` with the file verbatim; no `DROP` through the connector; `git checkout tsconfig.json` after a `NEXT_DIST_DIR` build; the docker volume fix. Who may ship waits for A1. |
| Cloud sessions, When ambiguous | Keep |

Add from the handoff: the names of section 10, British spelling, sentences under 25 words, no emoji, and
"the anonymity suites pass before any merge". Add LeaderPact's Supabase project ref as the only project an
agent may touch. The connector's `apply_migration` takes any project ID, so a LeaderPact session could
otherwise write to Orgpuls's database.

**`settings.json`.** It holds `defaultMode: "bypassPermissions"`, an allow list covering every tool, and
empty `deny` and `ask` lists. That is deliberate in Orgpuls (`CLOUD_SETUP.md:27-33`): the judgement lives
in the prose of the operating authority, which is the part that does not carry over. Copying the file
would grant the authority in practice before the owner has. The proposal is in question A1. `ask` is
better than `deny` for hosted actions: a `deny` rule stays for the whole session, and one once blocked
`git push` for a working day (`CLOUD_SETUP.md:10-13`).

**Audit skill.** Rules 1 to 9, phases 0 to 8, the P0 to P3 severities and the `allowlist.json` structure
are generic. The role matrix, the Norwegian promise-extraction regex, the pixel run, the Oslo schedule,
`journeys.md` and every allowlist entry are Orgpuls's. Rewrite the journeys from handoff section 13.

**Risks.**
- The local database gates cannot run in a cloud session as set up. `cloud-env-setup.sh` does not install
  the Supabase CLI, and `supabase` is not on the path in this container. Docker and `psql` are. Until that
  changes, CI is the only place the database is rebuilt.
- Playwright MCP is pinned to 0.0.82, and its viewport is Orgpuls's 1440 by 900. Set 1280.

### 4.2 CI and gates

**Verdict.**
- Adapt: `ci.yml`, `scripts/qa/*`, `scripts/audit/wiring.mjs` with `security.sql`, `supabase/config.toml` and `next.config.ts`.
- Adapt the pattern, not the script: `functions.yml` and `scripts/functions/deploy.mjs`.
- Reuse as they are: `tsconfig.json`, `vitest.config.ts`, `vercel.json` (keep `"framework": "nextjs"`, D-43) and `artifact-cleanup.yml`.
- Do not reuse: `i18n-fold.yml`.

**How Orgpuls's CI works.** One job, "checks, security invariants and screens" (`ci.yml`, 328 lines):

1. Quick checks: `tsc`, lint, `modules:validate`, Vitest and `verify:i18n` (29-42).
2. Supabase CLI 2.118.0 (46-48), plus a PostgREST re-tag that works around a v16.2 defect (61-84).
3. `supabase start` with most services excluded, retried four times with a fallback registry (91-103).
4. `supabase db reset`, which applies all 187 migrations (107-108).
5. Seeding with `psql` (113-164), then the design's figures (172-175).
6. Every `supabase/tests/*_invariants.sql`. All of them run, and the step fails at the end (186-195).
7. `supabase db lint` (197-198).
8. `wiring.mjs --security-only` (203-204).
9. A build against the local database (219-224).
10. A smoke test that fails on any `[read]`, `[write]`, `[org]` or `[middleware]` line in the server log
    (231-252).
11. Playwright and artifacts (285-328).

98 of 99 suites write to `public._inv` and raise `invariants failed` in a final block. Under
`ON_ERROR_STOP=1` that gives a non-zero exit. Because they share `_inv`, the suites run one at a time.

**The wiring audit.** S1 to S7 cover:
- RLS on every table;
- no readable answer table;
- a `search_path` on every definer function;
- every anon-callable function on the allowlist by its full signature;
- every direct client write on the allowlist;
- the k floor;
- no linkage column on `responses`.

W1 to W2 and R1 find unread columns, settings with no effect and uncalled RPCs. CI runs the S checks only.
`security.sql` hard-codes the answer tables, k = 3 and 5, and `app.responses`. It stops with an error, not
a finding, if those objects do not exist. So LeaderPact either creates them in its first migration or
switches to `to_regclass`.

**What changes.**
- Keep the order above.
- Do not exclude `realtime` from `supabase start`: the live meeting flow needs it. Keep `mailpit` for
  email-link sign-in in tests.
- Pin a CLI whose PostgREST is v16.3 or later, and drop the re-tag.
- Remove the design figures, the `gb` fixture, the wheel tick, the i18n registry steps and the
  Norwegian routes.
- Add three things Orgpuls never runs in CI:
  - the SQL half of `tests/invariants/invariants.sql` (`invariants.mjs:10`);
  - `deno check` on pull requests (it runs only on `main`, `functions.yml:43-44`);
  - a scheduled full wiring audit.
- `config.toml`:
  - set `project_id = "leaderpact"`;
  - keep `app` in `[api] schemas`;
  - **delete `[auth.hook.custom_access_token]`** (148-150). It points at an Entra function from 0156,
    and without that function every sign-in is refused.
- Versions Orgpuls runs (lockfile): Next 15.5.25, React 19.3.0, TypeScript 5.9.3, Tailwind 3.4.19,
  next-intl 4.14.6, Zod 4.6.5, supabase-js 2.116.0, @supabase/ssr 0.12.7, Vitest 2.1.9,
  Playwright 1.63.0, axe 4.13.0, Node 22. ESLint 8.57.1 is out of support. Start LeaderPact on ESLint 9
  with a flat config.

**Risks.**
- **A copied deploy script would deploy into Orgpuls.** `deploy.mjs:21` falls back to Orgpuls's hosted
  project ref when `SUPABASE_PROJECT_REF` is unset (verified), and an access token reaches every project on
  the account. LeaderPact's script has no default and stops when the variable is unset.
- **`local_account.sql` has no guard inside the SQL.** It writes `auth.users` with a known password. The
  shell scripts refuse non-local stacks, but run through the connector's `execute_sql` it would make a back
  door. Put the guard in the SQL.
- **A docs-only pull request starts no CI run** (`paths-ignore`, `ci.yml:7,10`). If the check is required,
  such a pull request can never merge. Use a path filter inside the job instead.
- **Lint and Vitest miss files.** Lint covers only `app components lib`, and Vitest only
  `tests/unit/**/*.test.ts`, so a `.test.tsx` never runs.

### 4.3 Supabase clients

**Verdict.**
- Reuse as they are: `lib/supabase/env.ts` (84), `server.ts` (41), `anon.ts` (14), `read.ts` (81), `write.ts` (82) and `skew.ts` (72).
- Adapt `lib/supabase/middleware.ts` (259).
- Do not reuse the five ad hoc anon clients (`lib/i18n/overrides.ts:35` and others). Fold them into `anonClient()`.

**Verified.**
- **No service-role key in the Next app.** A search for `service_role|SERVICE_ROLE|sb_secret_|SUPABASE_SECRET`
  finds nothing in `app/`, `lib/`, `components/`, `middleware.ts` or `scripts/`. The app reads two
  `NEXT_PUBLIC_` variables (`env.ts:31-32`).
- **No browser client.** All 86 call sites use the server client.
- **Revalidated sessions.** The middleware calls `getUser()`, which revalidates with Auth. The call has a
  5-second bound and fails closed.
- **Privileged work in edge functions.** Edge functions hold `SUPABASE_SERVICE_ROLE_KEY` and call only
  `.rpc()`. They reach about 30 functions that are revoked from anon and authenticated and granted to
  `service_role` alone (`0032_dispatch.sql:270-276`).
- **Routing.** RPCs live in `public`, and tables are read through `.schema('app')` under RLS. There is no
  `rpc` schema: Orgpuls's `CLAUDE.md` says `rpc.submit_response`, but the function is
  `public.submit_response` (`0004_rpcs.sql:40`).
- **Rows are parsed with Zod.** Errors are logged as a code and a path, never a value
  (`lib/modules/measures.ts:51-53`). Lint does not enforce this, and a few reads skip it
  (`app/auth/callback/route.ts:157`).

**What changes.**
- Accept the `sb_publishable_…` key name that new projects issue.
- Make the middleware deny by default. Orgpuls makes every unknown kebab-case path public
  (`middleware.ts:131-134`).
- Add a browser client for Realtime. It is new; nothing in Orgpuls can be copied.
- Add a CI grep for `service_role` over the source and `.next/static`.

**Tests.** `tests/unit/helpers.test.ts`, `skew.test.ts`, `app-roots.test.ts`, `definer_grants_invariants.sql`,
`dispatch_invariants.sql` 1-3.

**Risks.** `service_role` bypasses RLS, so only the absence of table grants keeps it off the answer tables.
`respondent_invariants.sql:135-138` checks anon and authenticated only; LeaderPact adds `service_role`.
Because `app` is exposed, a signed-in user can call PostgREST directly with their own token and skip any
limiter in Next. RLS is the only guard on that path.

### 4.4 Anonymous answers

**Verdict: adapt.** The structure carries over:
- answer tables protected by having no linking column;
- one definer write path that never returns an ID;
- definer readers;
- immutability triggers that let cascades through;
- the catalogue firewall, `app.anonymity_firewall()` (0206:613-686).

Their tests carry over with them. The write path is new.

**How Orgpuls holds it.**
- **Columns.** `app.responses` has id, org_id, round_id, group_id and `submitted_hour`, with a CHECK that
  keeps the hour truncated (0003:101-114). No later migration adds a column.
- **Answer tables.** `answers`, `extra_answers` and `response_comments` have RLS on, no policy and all
  grants revoked (0003:228, 0010:35, 0012:35).
- **Token.** Stored only as `token_hash`: 16 random bytes looked up by SHA-256 (0078:13-17, 0204:323).
  A replay is refused (0204:328).
- **Participation.** It is the invitation row, which no client reads since 0042:628. Since 0229,
  `responded_at` holds the round's opening time, so it says whether someone answered, never when.
- **Readers.** They work on closed rounds only and apply k per cell with complementary suppression
  (0042:36-205).

**The linkage channel (verified by the lead).** The latest `submit_response` (0204:294-518) updates the
person's invitation (0204:427, patched in place by 0229) and inserts the response (0204:433) in one
transaction. Both new row versions carry the same transaction ID.

```sql
select i.employee_id, r.id from app.invitations i join app.responses r on r.xmin = i.xmin;
```

That query names every respondent to anyone with SQL access: the SQL editor, a service-role connection,
or the Supabase MCP's `execute_sql`, which runs as `postgres`. The physical order of rows (`ctid`) gives a
second, weaker link. Nothing in Orgpuls's migrations, tests or docs mentions `xmin`. This is the threat
0229 defended against for timestamps, so it belongs in the same rule.

**LeaderPact's design.**

| Object | Shape |
|---|---|
| `response_set` | `id` (random UUID), `org_id`, `round_id`. **No time column at all.** Orgpuls's hour is read only by growth analytics, which LeaderPact does not have. No group column: the round identifies the group. |
| `response` | `response_set_id`, `item_id`, `value` 1..5. Append-only, with the cascade-safe trigger. |
| `scan_response_set`, `scan_response` | The same shape, under `scan_session`. `org_id` stays null until sign-up. |
| `participation` | `round_id`, `person_id`, `answered boolean`. No timestamp and no `updated_at`. One row per current member, created when the round opens. |
| `submit_response(round_id, answers)` | Definer, `search_path=''`. Finds the caller's participation row by `auth.uid()` under `for update`. Refuses a second submission, a closed round, or an item outside the round's version. Requires every item. Returns `{ok}` only. |
| `submit_scan(code, answers, replace_key)` | Granted to anon. Applies the cap and the replacement below. Returns `{ok, replace_key}` only. |
| `close_round`, `close_scan` | Compute the snapshot once. Then, in the same transaction: re-insert the round's sets in random order with new IDs, delete the originals, rewrite every participation row (question C3), and delete every replace key. |
| `factor_score` | Holds the agreement number, which is never shown. No client grant. Readers return labels only. |
| Firewall | Port `anonymity_firewall()` over all answer tables, `scan_replace_key` and `participation`. Its rule 1 also denies `service_role`, which is the handoff's "staff cannot read answers". Add a check that no `op_*` function reads these tables. |

**Three tensions in the handoff, with recommendations.**

- **a) Replacement from the same browser (6.5).**
  - Mechanism: a `scan_replace_key` table, `(key_hash primary key, scan_session_id, scan_response_set_id on delete cascade)`, with RLS on, no policy and no grant to any role.
  - The server mints 32 random bytes and returns them once. The browser keeps them in local storage.
  - A replacement deletes the old set, inserts a new set with a new ID, and rotates the key, all in one
    transaction.
  - `close_scan` deletes every key. No function reads answers by key.
  - Residual: anyone holding the device can overwrite until close, and a second browser uses a second slot.
- **b) The cap.** One statement:
  `update scan_session set answered = answered + 1 where id = $1 and status = 'open' and answered < member_count returning answered`.
  - Zero rows means the scan is full. A replacement skips the increment.
  - When the count reaches `member_count`, the scan closes in the same transaction.
  - Padding remains (question C1).
- **c) The personal view** is computed on the device by the same pure function in `/lib/scoring` that
  `close_scan` uses. No server read of a single response exists. Once the view is shown, the device keeps
  only the replace key.

**Partial progress (6.11).** Orgpuls keeps the draft on the device only. It is keyed by a hash of the
token, holds the choices and the page, never text, and is cleared on submit (`RespondFlow.tsx:192-227`).
LeaderPact does the same: keyed by SHA-256 of round and user, expiring at close. There is no resume on
another device, because a server draft would be answers stored against a person.

**The Leader Profile** is a different class of data: person-linked by design and readable by its owner only.
It gets its own tables and RPCs, with no `service_role` grant and no Sentral operation. A share exposes
domain and facet levels, never item answers. Never share a device key, cookie or analytics ID between the
scan and the profile, since a visitor takes both in one browser.

**Process comments (6.15)** are new.
- `process_comment(meeting_id, agenda_item_id, kind)`: no person and no precise time.
- Written only by a definer function. It checks membership and counts at least 4 distinct online persons
  in a server presence table that shares no key with the comments.
- Broadcast from the database, and deleted at the end of the meeting.

**Tests that travel.**
- From `respondent_invariants.sql`:
  - keep 1-5, 7-12, 16-17 and 19-21;
  - extend 16-17 to every answer table and to `service_role`;
  - make 13's column denylist an exact allowlist;
  - turn 14-15 into "no time column";
  - drop 6 and 18.
- Build the suite on a synthetic organisation in a rolled-back block, as `k_floor_invariants.sql` does.
  Do not depend on the fixture's IDs.
- Carry over `responded_at` 1-3 (as "participation has no time column") and `hardening` 1, 2 and 11.
- New, from handoff section 13:
  - anon, a member and a leader each fail to select from each answer table;
  - `get_results` is empty for an open round and for 3 answers;
  - a catalogue check finds no client-reachable relation that carries both a person and a response set;
  - after close, no `xmin` is shared between `participation` and `response_set`.

### 4.5 Threshold as functions

**Verdict: reuse the mechanism, with new numbers and no way down.**

**Files.** 0001:27-30 and 110-118, 0150 (`k_floor` :41, `round_k_fixed` :77-98, `k_round` :101-110, the
guard that fails the migration if any reader still uses the organisation's setting :196-206),
`lib/org/threshold.ts`.

**What changes.**
- `app.k_floor()` is immutable and returns 4. Drop `k_min()`, or keep it returning 4. It never returns 5.
- `organisation.threshold` defaults to the floor, with `check (threshold between 4 and 8)`.
- A trigger refuses `new.threshold < old.threshold` for every role, Sentral operations included. Each change
  writes an `audit_event`.
- `k_threshold(org)` is `greatest(threshold, k_floor())`, with no market term.
- `assessment_round.k` and `scan_session.k` are checked 4..8.
  - A round's k follows the organisation while the round is `scheduled`, and freezes at `answering`.
  - A scan has no organisation when it opens, so its k freezes when the session becomes a group, before any
    member has the link.
- `close_round` compares n with `k_round`. Port the 0150 guard.
- `threshold.ts`: `K_FLOOR = 4` and `K_MAX = 8`. Delete the default, the below-default warning and the
  market floor.
- A `config` row may display "4 to 8". It must never be the source of the floor, because a row can be
  lowered.

**Tests.** From `k_floor_invariants.sql`:
- keep 1-3, 5-10, 13-16 and 23-24 with new numbers;
- rewrite 4 (raise 4 to 6), 11 (lowering 6 to 5 refused) and 12 (a planned round follows upward only);
- drop 17-22 (groups, comments, segments).

**Risks.** Raising k above a group's size means no later round of that group can release, and "never
lowered" makes that permanent (question C10). Keep 0073's rule: no participation count for a group asked
fewer than k people.

### 4.6 Rounds and reminders

**Verdict.** Adapt the SQL engine. Do not reuse the TypeScript readers in `lib/rounds/`; they serve
Orgpuls screens. Adapt `lib/rounds/reminders.ts` and `lib/participation/read.ts` (89).

**What Orgpuls has.**
- **States.** A three-state enum, `planlagt`, `apen` and `lukket` (0003:40). Clients cannot write it
  (0042:635).
- **Fixing at open.** Settings are fixed once open (`round_settings_fixed`, 0076:103-121), and k is frozen
  (`round_k_fixed`, 0150:77-99).
- **The tick.** An hourly `wheel_tick()` (0020:350; live body 0133:300-445) opens, reminds and closes. It
  is idempotent through partial unique indexes on the outbox, under a per-organisation advisory lock.
- **Extension** (0096). Once, plus 3 days, when fewer than half have answered.
- **The reminder ledger** (`round_reminders`, 0133:68-86), capped at two per round.
- **The dispatcher re-checks** that a person has not answered when it claims a reminder (0219:100).
- **Leader counts.** `reminder_status` returns counts only (0133:717).
- **The leader's alert** about the response rate (`queue_participation_alerts`, 0099:137-158). It is the
  pattern for the scan's reminder to the leader.

**What changes.**
- **Round kinds and phases.** A round belongs to a group. Kinds are `scan | diagnostic | pulse`, and the
  phases are `scheduled | answering | closed | released`.
- **The tick loops over due rounds.** Orgpuls's loops over active year-wheels (0133:316), so a round in an
  organisation with no active wheel never closes on time.
- **Close at 100% is new.** Check it after each submit under the same lock, not hourly.
- **Extension:**
  - when fewer than 4 have answered, plus 7 days, always on, once;
  - then the outcome `no_result`, which for the scan means no team view;
  - a pulse has no extension and ends as `missed`.
- **The leader cannot close early.** Do not port `close_round_now`.
- **Compute once.** A snapshot table written in the closing transaction, append-only with a cascade-safe
  trigger. The Free plan deletes older scans, so the trigger must allow the cascade. Drop the
  publish-date machinery (0105, 0129). Released means the snapshot exists.
- **Reminders.**
  - The ledger is keyed `(round, day)` for days 3, 7 and 12. The handoff's three reminders replace
    Orgpuls's limit of two.
  - The scan's reminder goes to the leader only. Members get no mail.
- **Opening a diagnostic** is modelled on `start_next_pulse` (0038): advisory lock, refuse while another
  round is open, invite every current member.
- **Pulses** follow a rhythm in weeks (2 to 8), replacing the year-wheel months.

**Tests.** `extend_invariants.sql` (rewritten), `wheel_month_invariants.sql` 15-22, `start_pulse_invariants.sql`,
`wheel_invariants.sql` 1 and 14, `responded_at_invariants.sql`, `participation_invariants.sql` (simplified),
`release_invariants.sql` (rewritten against the snapshot).

**Risks.** `wheel_tick` was rewritten five times. Port only the 0133 body, split per kind. Closing at 100%
races with submit, so both take the same lock. A snapshot next to live readers would be two sources of
truth: the snapshot is the only one.

### 4.7 Answering a questionnaire

**Verdict, by part.**
- Adapt the write path (server action, Zod, RPC).
- Reuse, renamed: the draft-on-device code, `components/respond/ChoiceGroup.tsx` (86) and
  `lib/respond/radiogroup.ts` (20).
- Adapt heavily: `RespondFlow.tsx` (814).
- Do not reuse: `app/s/[token]`, `app/inn/[code]`, comments, threads and reply notices.

**How Orgpuls does it.**
- **Rendering.** One discriminated union with eight question kinds, one renderer per kind, built from rows
  and message keys (`questions.ts:44-185`).
- **Order.** The server shuffles per token. But the client groups a factor's statements on one page
  (`paginate`, `RespondFlow.tsx:174`, D-150), which conflicts with "one per screen, not grouped by scale".
- **No review page.**
- **Submit.**
  - The server action parses with Zod, which strips unknown keys.
  - It never logs or reads the error message (`app/s/[token]/actions.ts:93-122`).
  - It parses the RPC's answer.
- **`/inn/[code]` is not a shared answering link.** It is a QR-poster door: a person types an email or
  phone number and receives their own personal link (0076).

**What changes.**
- **The public scan.** Fixed order (Appendix C), one item per screen, drafts with a 7-day life, and the
  personal view computed on the device.
- **`/j/[code]`** is new: code to scan session through an anon RPC, with the cap and the replacement of
  section 4.4.
- **The authenticated runner:**
  - submit looks up participation by `auth.uid()`;
  - mixed order from a per-round seed;
  - one question per screen;
  - a new intro page and a new review page.
- **One question kind,** a five-point statement, plus an `agreement` kind for pulses whose text comes from
  the charter.
- **The Zod payload** is `answers[{item, value 1..5}]`, at most 72. The response is `{ok}`.
- **The leader's own scan** is answered before any account or group exists. It stays on the device across
  the email sign-in, then goes to the new session.

**Tests.** `tests/unit/radiogroup.test.ts` as it is. The pattern of `respond-payload-locale.test.ts`, which
asserts that no device token or person ID reaches the RPC. `qa/e2e/respondent-flow.spec.ts` and
`respondent-keyboard.spec.ts`: axe, overflow at 320, 360 and 390 px, and keyboard.

### 4.8 Mail

**Verdict, by part.**
- Adapt: the outbox with claim, lease, done and release; the renderer `_shared/mail.ts`; the auth hook;
  the mail-events webhook; and the dispatcher, keeping its loop and cutting about 60%.
- Reuse as it is: the email half of `_shared/brevo.ts`.
- Do not reuse: SMS, Teams, Slack, Entra, lead copies, reply notices and "send test".

**Files.** `supabase/functions/orgpuls-dispatch/index.ts` (737), `orgpuls-mail-events/index.ts` (154),
`orgpuls-auth-mail/index.ts` (99), `_shared/brevo.ts` (117), `_shared/mail.ts` (853),
`scripts/functions/deploy.mjs` (83). Migrations 0020 (`app.outbox` 43-81), 0032 (302), 0053 (222),
0060 (256), 0134 (230) and 0219 (309, the current `dispatch_claim`, its tenth definition).

**How it works.**
- **Trigger.** pg_cron runs every 5 minutes. It calls the function through `pg_net` with a header secret
  from Vault, and stays inert when Vault is empty, so CI never sends (0032:285-302).
- **Claim.** `for update skip locked` with a 10-minute lease. At claim time it re-checks that the round is
  open and the person has not answered. It mints the respondent token then and stores only its hash.
  After five failures a row is given up.
- **Quiet hours.** No invitation or reminder between 21:00 and 07:00 local time (0219:57-61).
- **Links.** Token links are plain text, so Brevo's click tracking never sees them (`mail.ts:296-302`).
  Opens and clicks are not stored.
- **Sign-in mail.** It goes through Supabase's send-email hook, verified with Standard Webhooks. The hook
  is configured in the dashboard, not in `config.toml`.

**What changes.**
- **A generic outbox** with English kinds: `member_invite`, `diagnostic_invite`, `pulse_invite`, `reminder`,
  `scan_reminder_leader` and `summary`. Every row carries a group.
- **Member-invite mail.** Orgpuls never mails member invitations: the leader copies a link (0028:22-24).
  LeaderPact mails it, minting the token at claim and storing its hash.
- **50 invitations per group per day.** Checked in the claim. At the limit, `due_at` moves to the next
  local midnight.
- **Real suppression.** Orgpuls flags bounced addresses for the customer to fix (`app.address_problems`)
  but keeps mailing them (0219:137 checks them for Teams only). LeaderPact skips an address with a hard
  bounce, a spam report or an unsubscribe until the address changes.
- **Per-person summary frequency** needs a preference table, a time-zone-correct tick and an outbox kind.
- **Configuration in `config.toml`:** the send-email hook, the 15-minute link, the 30-day session and the
  site URL. Orgpuls set these by hand in the dashboard (`DEVIATIONS.md:2256-2262`).
- **Neutral names.** Rename `ORGPULS_*` secrets and the `orgpuls-*` functions and cron jobs. Remove the
  wordmark, the footer, `Europe/Oslo` (`mail.ts:266`) and the seven languages.

**Tests.** `dispatch_invariants.sql` (drop the SMS checks 19-28; add rate-limit deferral and suppression),
`mail_events_invariants.sql`, `lifecycle_invariants.sql`, and `tests/unit/mail.test.ts` (521), rewritten.
Two suites with mail-like names are not about mail:
- `suppression_invariants.sql` proves complementary cell suppression (k-anonymity);
- `digest_invariants.sql` proves a results reader.

**Risks.** Without suppression, repeated bounces hurt a new sender domain. Port `dispatch_claim` from 0219
only. A hook configured only in the dashboard means CI tests a different system.

### 4.9 Billing state

**Verdict.** Adapt the pattern:
- one state row per billed entity, read-only to clients and written by RPCs;
- one `app.org_access()` deciding access;
- the `billing.changed` event;
- the cancellation and deletion routine (0064, 0136), which is the most valuable part.

Do not reuse:
- the plan model;
- the trial;
- price storage;
- the narrow read-only rule;
- NOK, EHF, MVA and UK VAT.

**What Orgpuls does.**
- **No code makes an invoice.** The product collects plan, interval, invoice email, reference and VAT
  number, and the leader confirms (`save_billing`). The invoice is made by hand outside code
  (`DECISION_LOG.md:3088`). Nothing records a payment, and no past-due state exists.
- **Grace is not payment grace.** It is the 14 days after a trial.
- **Read-only blocks only starting a survey** (0052:1-17). Every other write stays open.
- **Plans are not data.**
  - `check (plan in ('small','usual','group'))` (0048:29).
  - Prices are in TypeScript (`lib/site/pricing.ts:9-12`) and in `app.plan_monthly_nok`.
  - Free-plan limits are hard-coded functions (0201:83-172).
- **Platform commands.** `billing:write` has only `extend_trial`, `cancel` and `cancel_withdraw`
  (0205:530-533). PLAN.md §5.3 promises "set plan and interval, move to free", but neither was built.

**What changes.**
- **Plans as rows:**
  - `plan` (key, active, `max_groups`, `max_members` = 15);
  - `plan_feature`;
  - `plan_price` (plan, interval, currency, amount, version, valid from);
  - one gate, `app.plan_allows(group, feature)`.
- **Billed per group.** A subscription row keyed by group, not by organisation.
- **States:** free, active, past_due (7 days' grace), read_only, cancelled, then deleted.
- **Read-only covers every group write:** charter, meetings, actions and rounds. One guard function is used
  by every write RPC and policy. A catalogue-driven test proves that no new table escapes it.
- **Retention.** An organisation setting, 90 days by default (30 to 365), replaces Orgpuls's fixed 30 days
  (0065:11-14).
- **Upgrade carries data over trivially.** State changes; data does not move. Orgpuls already works this
  way.
- **New:**
  - the three-step checkout;
  - the `PaymentProvider` interface (`createCheckout`, `createInvoiceCustomer`, `cancel`, `parseWebhook`)
    with a development adapter;
  - a path for payment results (question D1).

**Tests.**
- `retention_invariants.sql` (350): the catalogue-wide proof that no ID or email is left.
- `cancellation_invariants.sql`, `customer_cancel_invariants.sql`, `downgrade_invariants.sql` and
  `billing_invariants.sql`.
- Recast `trial_end_invariants.sql` as an access-state suite.
- Recast `free_plan_invariants.sql` as feature gating.
- Drop `billing_gb_invariants.sql`.

**Risks.** 0201 contains a `drop function` (line 456). Port it as rename and revoke. Deletion runs per
organisation in Orgpuls; LeaderPact may need it per group when one group's subscription ends.

### 4.10 Data as rows

**Verdict.** Adapt the pipeline. Do not reuse the module schema or the module tables.

**Why the schema does not fit.**
- **Fixed rules that refuse LeaderPact's data:**
  - `locale: z.literal('nb-NO')` (`lib/modules/schema.ts:241`);
  - a minimum of 5 responses in Zod (schema.ts:261) and in the database (0067:50), which refuses a
    threshold of 4;
  - a scale mapped to 0 to 100 (307-314);
  - exactly three statements per factor (439), and three per simplified factor (148), where a scan theme
    has two.
- **No place for LeaderPact's attributes:** layer, reading type, evidence rating, or core, scan and
  candidate use.
- **Accretion.** The schema was redefined five times (`module_seed`: 0067, 0072, 0083, 0089, 0090).
- **No versions in the core instrument.** Its wording sits in the message files, so a reword silently
  changes what closed rounds "asked" (0002).

**What to keep.**
- **The pipeline:** files, then Zod validation, then `seed.ts` printing one
  `select app.x_sync('<canonical json>', '<hash>')` for `psql` or the connector.
- **Canonical JSON and the body hash** (schema.ts:551-576). The database numbers versions.
- **Sync rules** (0122, 0191):
  - the same body is a no-op;
  - a changed published body becomes the next version;
  - rounds already open keep their version.
- **Immutability written as content rules** (0067:158, 192), with status moving only from draft to
  published to retired.
- **Text as `jsonb` keyed by locale,** checked `text ? 'en'`.
- **Answers point at a versioned item row.**
- **Pilot visibility** through a command (0068), which fits the candidate items.

**What changes.**
- **Data files:** `instrument/bank.json` (24 scales, 96 items with stable codes such as `clear_purpose.1`),
  `instrument/scan.json` (6 themes over 12 codes), `config/cutoffs.json` and `config/plans.json`.
- **Zod refinements:**
  - 21 scales and 3 outcomes, split 6, 11, 4 and 3 by layer;
  - 3 core items and 1 candidate per scale;
  - 12 distinct scan items;
  - no evidence rating on outcomes;
  - no reverse-keyed group item;
  - a British-spelling word list.
- **Tables:** `instrument`, `instrument_version`, `scale`, `item`, `scan_theme` and `theme_item`. Every
  score stores its instrument version and charter version.
- **The sync function** is reimplemented in about 150 lines, without the Norwegian branches.

**Tests.**
- `tests/unit/modules.test.ts` as the template.
- `module_sync_invariants.sql` 1-6 and 9.
- `module_invariants.sql` 3-7 and 12-15.
- `module_validation_invariants.sql`.
- Not `module_wording_invariants.sql`: it covers kindergarten and school wordings, not versions.

**Risk.** Keep the hash in TypeScript over canonical JSON; `jsonb` reorders keys.

### 4.11 Text and locale

**Verdict.** Adapt: keep five small pieces.

**Keep.**
- **The request config,** as about 15 lines: `locale: 'en'`, one catalogue, and the visible
  `namespace.key` fallback (`lib/i18n/request.ts:74`).
- **`icu-rules.ts`** with the syntax and plural checks of `scripts/verify/i18n.mjs`. next-intl throws at
  render on bad ICU.
- **`dates.ts`:** `en` becomes `en-GB` for British dates, in the person's own time zone.
- **`client.ts` `pickMessages`,** so a page does not serialise the whole catalogue.
- **`keyed.ts`,** as a QA mode that finds hard-coded text.

**Drop.** The locale registry, the fallback chain, the registry overlay, admin overrides, translation
packages, the pseudo-locale, the market overlay, the language switch and cookie, `respondent-ui.mjs`, the
GSM-7 check and X-089.

**Add.**
- **Typed messages from day one** (`AppConfig.Messages`). Orgpuls leaves them untyped on purpose (D-132)
  and relies on parity between catalogues. With one catalogue, parity catches nothing.
- **A hard-coded-text lint** (`react/jsx-no-literals` over `app/` and `components/`). None exists.
- **A British-spelling check** over `en.json` and `bank.json`. None exists.

Item, scale and theme wording lives in the versioned rows of 4.10, not in messages.

### 4.12 Fixtures and demo

**Verdict.** Adapt the generator technique and the demo copy mechanism. Do not reuse the scenarios.

**How Orgpuls does it.**
- **The solve.** `scripts/seed/design-fixture.mjs` (1,214 lines) solves backwards from printed figures.
  It reproduces Postgres rounding in integers (409), lists every sum that rounds to a target (412),
  distributes by largest remainder (428-470), and throws when a figure cannot be reached.
- **Writes.** It writes rows with exactly the shape `submit_response` writes, as the database owner,
  idempotently.
- **The demo.** `app.demo_build` (0094) copies a template organisation table by table, following a copy
  plan. A test fails if any organisation table is missing from the plan.
- **The self-check.** `demo-org.mjs` refuses to commit if any quoted figure is off.

**What changes.**
- **One generator** emits the Lumio AS template: 8 members led by Kari Nordmann, the scan, rounds,
  charter, meetings and actions.
- **It solves two targets:** means at one decimal and agreement labels, using the same rounding as the SQL
  scoring.
- **`demo:write` commands** (`demo.create`, `demo.reset`, `demo.remove`) copy the template on the 0094
  pattern. A demo organisation emits no events.
- **Sample pages** on the Free plan read the template, marked Sample.
- **One generator instead of three.** Orgpuls runs three (design fixture, demo, QA tenant). LeaderPact runs
  one, with a `--local` flag for known passwords.

**Risks.** Orgpuls's fixture tokens are derivable from IDs (`design-fixture.mjs:530-534`), and the fixture
does not refuse hosted databases. In LeaderPact, deterministic tokens and passwords are local only, and the
generator refuses anything else. The generator bypasses the write path, so the respondent suite runs
against its output to prove the shapes match.

**A naming note.** Orgpuls's QA tenant is already "Lumio AS" with "Kari Nordmann"
(`scripts/qa/seed.mjs:2,47,171`). The handoff reuses the names. Screenshots from the two products will
look alike.

### 4.13 Visual checks

**Verdict, by part.**
- Reuse as they are: `scripts/verify/probe.mjs` and `crop.mjs`.
- Adapt: `shoot.mjs`, `region-diff.mjs`, `mobile.mjs`, `qa/visual/shoot.ts` and `playwright.config.ts`.
- Adapt the idea of the claims file in `v3-run.mjs`.
- Do not reuse: `pixel.mjs` as a gate, or `design-reference/orgpuls/`.

**What changes.**
- **`shoot.mjs`.** Default viewport 1280. Sign in through a development-only `storageState`, or by
  following the link from the local mail catcher. Orgpuls signs in with a password. Keep the settle wait
  and the rule that a console error fails the run.
- **`region-diff.mjs` becomes the side-by-side tool.** It already writes a baseline, shot and diff sheet.
  Parameterise its 1440 by 900, and add a tolerance per region.
- **`design-claims.json` per screen.** It names the regions that must match, each with a tolerance, and the
  regions excluded on purpose, each citing a row of handoff section 11 or the contrast fixes. Only
  claimed regions gate; everything else is reported.
- **A new computed-style probe.** It compares font, size, weight, colour, radius and padding of named
  components in the design DOM and the app DOM, and lists differences by name.
- **`mobile.mjs` for 390 and 360 px,** where no design exists: sideways overflow, squeezed text, and the
  minimum sizes.
- **`qa/visual/shoot.ts`** carries over whole: a screenshot, axe with a known-issues list, and the app's own
  previous screenshot.
- **Line height.** Port Orgpuls's fix for Tailwind preflight's `line-height: 1.5`, which the design does not
  set (`app/globals.css:76-87`).

**The design render (verified by the lead).** The design file is a Claude Design `.dc.html`, the same
format as Orgpuls's. Its component reads every value from `window.LTCore`, which `proto-core-v5.js` defines
(design lines 1653-1669). It was not supplied with the handoff; the owner supplied it afterwards.

| Attempt | Result |
|---|---|
| The file as supplied, network blocked | All 23 screens stacked into a 35,638 px page, with 898 literal `{{` |
| With Orgpuls's `support.js`, React 18.3.1 and Babel served locally, and local fonts | A clean render at 1280 px, landing page only, with no unresolved bindings. It already shows rows of handoff section 11: "Team Scan", "Research / Templates / For coaches" and "Open the demo group". |
| With the supplied `support.js` and `proto-core-v5.js`, the same local vendor files and fonts, one fresh context per state | All 14 screens render with no unresolved binding, no page error and no blocked request: landing, scan, personal, invite, home (Free and Team), group, people, assess, results, develop, meetings, live, me and settings. |

Every component of the list can now be captured. The prototype opens in its sidebar layout, so the
render switches it to the top bar before comparing. The screens still show what section 11 removes, such
as 360, "Assessment schedule" and the CXO tile, so the claims file excludes those regions.

`proto-core-v5.js` also holds older drafts of the scan items. For example, it has "We know which few
priorities matter most right now" where Appendix C has "The issues on our agenda are ones that need the
whole team". The handoff wins: item wording comes from Appendix C, as data.

The bundle's own README asks for pixel-perfect output and says not to render the files. The handoff
overrides both (`design/reference/README.md`).

**The pipeline.** One design-render script:
- serves the file;
- serves React and Babel at `/cdn/` (the SRI hashes in `support.js` match the unpkg files);
- routes Google Fonts to the committed font files and iconify to a local copy;
- reaches states through the prototype's own controls, each from a fresh browser context.

The design and the app are rendered in the same CI run, on the same Chromium with the same fonts, so no
design baselines are stored. The design runs its own code, so it runs in headless Chromium with every other
request aborted.

### 4.14 Flags

**Verdict.** Do not reuse the mechanism. Keep the typed list of names, and adapt the 60-second cache from
`lib/site/notice.ts`.

**How Orgpuls does it.** Flags come from the `ORGPULS_FLAGS` env var and a signed-off JSON list. They are
read once when the module loads (`lib/flags.ts:59-62`), so a change means redeploying the app and the
functions. `flags.ts` lacks `server-only`.

**What changes.**
- A table `feature_flag(key, on, updated_at)`, with RLS and a definer reader.
- An async `flag()` cached for at most 60 seconds, and invalidated with `revalidateTag` when a Sentral
  command changes it.
- `FLAG_NAMES` holds only `live_meeting`.
- When the flag is off or the read fails: no Realtime join, agendas stay editable, nothing is deleted.
- Routes that depend on a flag render dynamically.

**Tests.** Orgpuls has none. New: an SQL suite (no client write) and a unit test of the expiry.

### 4.15 Sign-in

**Verdict, by part.**
- Adapt the email-link parts: the auth hook, `brevo.ts`, `authLink` and `renderAuth` (`mail.ts:680-726`),
  `app/auth/confirm/route.ts` (64), and the request side from `lib/demo/actions.ts:78-85`, which already
  maps Auth's 429.
- Do not reuse: password sign-in, sign-up, invitation acceptance and Entra.
- Reuse Google only if wanted (question D4).

**How the link works.** The hook gets `token_hash` and builds
`/auth/confirm?token_hash=…&type=email&next=…`. The route calls `verifyOtp` on the server and sets the
cookie. There is no PKCE, so the link works on another device. Auth makes the token single-use.

**What changes.**
- **Scanner-proof links.** `/auth/confirm` signs in on GET, and mail scanners such as Outlook Safe Links
  open links first, which uses up a single-use link. Show a button that posts. Orgpuls already does this
  for unsubscribe (`DEVIATIONS.md:4322`).
- **5 links per email per hour,** enforced inside the hook, which sees every Auth mail, including direct
  `/auth/v1/otp` calls. Count by SHA-256 of the lower-cased address in a function only `service_role` can
  call. Answer `http_code: 429`, the same whether or not the account exists.
- **Settings in `config.toml`:** `otp_expiry = 900`, `[auth.sessions] timebox = "720h"`, a cookie
  `maxAge` of 30 days, the hook and `site_url`. The `@supabase/ssr` default cookie lasts 400 days.
- **Keep** the open-redirect guard on `next`.

**Risks.**
- The session limit is a paid-plan setting (question A2).
- Supabase's mail limit is project-wide.
- `shouldCreateUser: true` creates an account for any address, so sign-up follows the scan's group
  creation only.

### 4.16 Export

**Verdict.** Do not reuse; the feature does not exist in Orgpuls. Reuse `lib/xlsx.ts` (263 lines), a ZIP
and XLSX writer with no dependencies and no production consumer today. Adapt the deletion routine.

**What changes.**
- **An `export_request` table** and a `request_export()` RPC that enforces 5 per person per day in the
  database. The route answers 429.
- **Building the file.** A claim for the dispatcher, and a definer `export_person()` that builds JSON from
  person-scoped tables.
- **A coverage table** like `demo_copy_plan`, so a new table must declare include or exclude, or a test
  fails.
- **Bundled with `zip()`** and delivered by a one-time link (question D6).
- **The export cannot contain the person's group answers,** because no link exists. It says so.
- **Account deletion** derives its tables from the catalogue, as `app.org_row_counts()` does (0136:55),
  and also removes the person's Auth audit rows.

**Risks.**
- Formula injection if a CSV writer is added: prefix `= + - @`.
- Leaking other members' data, such as agenda items they proposed.

### 4.17 The platform API

See section 6.

### 4.18 Other patterns worth naming

| Pattern | Orgpuls | For LeaderPact |
|---|---|---|
| Actions with an owner and a due date | `app.measures` (0013:37-51): `factor_key`, owner, `due_date`, a step enum, and a trigger keeping rows in one tenant | Adapt the pattern for `focus_area` and `action`. At most 2 active focus areas and an owner on every action are enforced in the database. |
| Analytics without identity | `lib/analytics/scrub.ts` (44) drops capability-token paths and query strings | Reuse, with `/j` as the capability prefix. The five funnel events go to a table with RLS and no policy, written by a definer function, with no name, email or answer. |
| Rate limits | In-memory limits per network (/24 or /48) in `lib/brreg/throttle.ts`, and database counters inside definer functions (0094, 0127, 0206). No HTTP 429 anywhere. | Store no whole IP address: read "per IP" as per network hash. Public scan: at the edge, plus the database cap. Sign-in: in the hook. Invitations: in the claim. Export: a database counter. Live events: dropped on the server. The 120-per-minute API limit needs a PostgREST pre-request function, because direct PostgREST calls skip Next. |
| Security headers | `next.config.ts:37-63`: `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` | Reuse as they are |

---

## 5. Where Orgpuls is stricter than the handoff (followed)

- **Participation carries no time** (0229). LeaderPact goes further: no time on response sets either.
- **`service_role` has no grant on answer tables,** and the firewall denies it (0206:613).
- **No participation count when fewer than k were asked** (0073).
- **Drafts stay on the device.**
- **Every definer function has a fixed `search_path`.**
- **Every anon entry point is reviewed by its full signature** (`security.sql` S4).
- **No respondent free text in logs.** Errors are logged as codes only.
- **No whole IP address is stored.**
- **Sign-in answers the same whether or not an account exists.**
- **CI fails on a silent read error in the server log.**
- **Seeds refuse anything that is not a local stack.**

---

## 6. Sentral (handoff A.3)

### 6.1 The Orgpuls side of the contract

**Verdict, by part.**
- Adapt the commands: `platform_command`, the JWT check, the command map and the audit.
- Adapt the events: the registry, `platform_emit`, the outbox, claim and done, and the dispatcher.
- Reuse the installation and resync (0207) as they are, renamed.
- Do not reuse market (0228).
- Adapt the suites.

**How it works.**
- **Commands.** `public.platform_command(token, command, args)` is a definer function that anon may call
  through PostgREST with the public key (0205:390-459). There is no route; the `/api/platform/v1` named
  in PLAN.md was never built.
- **The token.** `app.platform_jwt_claims` (0205:347-383) verifies HS256 with pgcrypto against a Vault
  secret. It checks `alg`, `aud`, `sub`, a `jti` of 8 to 128 characters, `exp` and `iat` with 30 seconds
  of skew, and a lifetime of at most 300 seconds.
- **Order of checks:** unauthorized, unknown command, scope, invalid arguments, then the audit insert,
  whose unique `jti` makes a replay fail.
- **The call.** The mapped function is called by parameter name through `USING`, so values never enter the
  SQL text.
- **Audit.** `app.platform_commands` stores argument names, not values. Its append-only trigger refuses
  every DELETE.
- **Events.** `app.platform_emit` is the only writer. It refuses an unregistered kind and any field the
  kind does not list, and a demo organisation emits nothing (0205:123-147).
- **Delivery.** The dispatcher posts 50 events per run, signed with HMAC-SHA256 under the headers
  `x-orgpuls-timestamp` and `x-orgpuls-signature` (`orgpuls-dispatch/index.ts:629-639`).

**Two defects, fixed in the port.**

1. **The claim checks fail open (verified by the lead).** Lines 370-377 join the checks with `or`. A missing
   `aud`, `exp` or `iat` makes its comparison NULL, and PL/pgSQL's `IF` does not fire on NULL. A correctly
   signed token with no audience, or with no lifetime, is accepted. Exploiting this needs the signing
   secret, so it matters most if Sentral ever signs for several products with one key. The port writes
   every check null-safe and requires `exp` and `iat` to be numbers.
2. **A refused command leaves no audit row.** Scope, unknown-command and invalid-argument refusals return
   before the insert (0205:403-415), although the comment at 0205:22-23 says every verified call is
   audited. Handoff section 13 requires the row. The port inserts it right after the signature passes.

**Also changed.**
- **Names.** Audience `leaderpact`. Secrets `platform_token_secret` and `platform_webhook_secret`, made in
  LeaderPact's own Vault and never shared with Orgpuls.
- **The audit trigger** allows a DELETE only for rows older than 24 months (handoff section 8).
- **The dispatcher** parses the claim with Zod, loops until the queue is empty, and raises an alert when an
  event reaches its attempt limit.
- **`users:write`** must never add, invite into a group or promote a member. Membership gates results, so
  such a command would let Sentral staff read them.

**Tests.**
- `platform_api_invariants.sql` 1-14 port directly, as do `platform_resync_invariants.sql` 1-5 and firewall
  rule 2 (no trigger on an answer table reaches `platform_emit`).
- New:
  - an exact snapshot of every kind's fields;
  - more block-list terms (`profile|standing|result|level|agreement|participation|process`);
  - tokens signed with the wrong key, tampered, `alg: none`, missing `aud`, `exp` or `iat`, or with `iat`
    in the future;
  - a refusal leaves an audit row;
  - DELETE on the audit is refused;
  - no function except `platform_command` sets `app.platform_actor`.
- Drop `platform_split_invariants.sql`, which proves Orgpuls's admin removal.

### 6.2 The Sentral side (`Owntheagenda_Admin` at `f6a43bd`)

**Verdict.** The data model takes a second product. The wiring does not.

**What is already generic.**
- The tables `products`, `installations`, `accounts`, `account_products`, `subscriptions`, `members`,
  `usage_daily` and `events_in`, all keyed by product (Sentral `0001_foundation.sql:41-133`).
- `application_connect` creates a product and its installation from the UI (0044:2294-2320).
- Secret intake already accepts `leaderpact_token_secret` and `leaderpact_webhook_secret` (0065:113-198).
- Senders are chosen per product (0061:9-15).
- The signature check (`_shared/signing.ts:41-58`) and the ingest function `ingest_events(p_product, …)`
  (0067:67-176) are generic.

**What is hard-coded to Orgpuls.**

| What | Where in Sentral | What LeaderPact needs |
|---|---|---|
| The event receiver: secret, headers, product | `supabase/functions/orgpuls-events/index.ts:31-33,50` | One receiver that takes the product, with neutral headers |
| The command sender refuses any other product | `supabase/functions/product-command/index.ts:38,60,62,86` | The product from the request, checked against an enabled installation |
| `aud: 'orgpuls'` and the command list | `_shared/orgpuls.ts:8-53` | Audience = product key, with the list read from `app.product_commands` |
| The app's command helper | `lib/platform/command.ts:3,15,26` and 8 call sites | A `product` parameter |
| Installation scopes | 0044:37-39 and 2307, `lib/data/platform-shared.ts:27-30` | Add `users:*` and `demo:*` (refused today) |
| Organisation number `^\d{9}$` | 0001:61, 0006:83 | Accept other formats, or receive none (question E5) |
| Revenue in NOK only | 0034:496-509 | Per currency (question E6) |
| Customer, ticket and module screens use the Orgpuls tenant | `customers/actions.ts`, `OrgDetail.tsx`, `platform/actions.ts:50,73,99` | Pick the chosen product's tenant |
| About 50 strings naming Orgpuls | `messages/en/*.json` | The product's name as a variable |

**Missing on both sides.**
- No invoice and no payment provider.
- No lifecycle mail.
- No `users:write` or `demo:write` command.
- Health is judged from events alone (`integration_calls` is never written).
- A poison batch: one bad field fails a whole batch with HTTP 500, retried up to 20 times.

### 6.3 Events, LeaderPact to Sentral

| Event | Fields | Verdict |
|---|---|---|
| `org.created` | org ID, name, group size at creation, `created_at` | Confirm, and add `created_at`. No organisation number until question E5 is answered. |
| `member.invited`, `member.joined`, `member.left` | org ID, user ID, role, email (joined only) | **Amend the names** from `user.*` to what Sentral parses (question E3). These are account holders. They answer diagnostics, so never send participation or per-person activity. |
| `billing.changed` | plan, interval, `confirmed_at`, `cancelled_at`, `cancel_effective_at`, `deletion_due_at`, `price`, `currency`, `seats` | Confirm, with the dates named. Add price, currency and seats, which Sentral expects and Orgpuls never sends (so every Orgpuls subscription shows zero revenue). |
| `org.deleted` | (empty) | Confirm. Purge the organisation's queued events first (0205:161). |
| `usage.daily` | `members`, `groups`, `rounds_started`, `meetings_held`, `last_sign_in_on` | **Amend** (question E4). Drop open and closed counts and close dates. |

Never in an event: an answer, a score, a standing, a profile, a process comment, a participation, or any
count or date tied to a named round.

### 6.4 Commands, Sentral to LeaderPact

| Scope | Commands | Verdict |
|---|---|---|
| `orgs:read` | `orgs.list`, `orgs.get`, `orgs.resync` | Confirm. `orgs.get` returns no per-round dates or status and no per-person sign-in time. |
| `billing:write` | `billing.set_plan`, `billing.cancel`, `billing.cancel_withdraw`, `billing.move_to_free`, `billing.set_status` | Confirm, and add `set_status` (question D1). All new code except cancel and withdraw. |
| `users:write` | `users.deactivate`, `users.resend_invite` | Confirm. New code. Never create, add or promote. |
| `modules:read`, `modules:write` | `modules.list`, `modules.set_status`, `modules.pilot` | Confirm, narrowed. No `sync`: the item bank ships by migration. Keep Orgpuls's reply shape, so Sentral's modules screen works unchanged. |
| `demo:write` | `demo.create`, `demo.reset`, `demo.remove` | Confirm. New code. |

---

## 7. shadcn/ui or Orgpuls's primitives

**Recommendation.** Use both, each where it earns its place.

- **shadcn/ui** (Radix) for every control with real interaction behaviour, restyled to the tokens. That
  covers roving focus, focus traps, Escape handling, portals and ARIA wiring. Orgpuls hand-rolled these,
  and its versions drifted: its result tabs have no arrow keys or `aria-controls` (`Workspace.tsx:95-110`),
  and its wizard has a hand-made focus trap (`Veiviser.tsx:193-215`).
- **Small transcribed components in `/components/lp`,** in the Orgpuls style, for the visual pieces. Cards,
  pills, bars and dots gain nothing from shadcn. Its defaults (`shadow-sm`, `rounded-xl`, ring focus) would
  all be overridden.
- **Do not reuse Orgpuls's own primitives.** They carry Orgpuls's colours and a yellow primary button.

| Component | Source |
|---|---|
| Button | shadcn Button: variants, and Radix Slot for links |
| Tabs | shadcn Tabs for in-page panels. Tabs that change the URL are links with `aria-current`. |
| OptionRow | shadcn RadioGroup, restyled |
| ProgressBar | shadcn Progress, restyled to 6 px |
| Toast | Sonner, restyled: `#111111`, radius 12, 13.5 px at 500 |
| TopBar | Bespoke, with shadcn DropdownMenu for the group switcher, and Sheet for the phone's More |
| NavItem, PlanPill, HeroBlock, Card, SectionHeader, ListRow, Pill, LevelBar, CountDots, HintBox, WarningBox, SampleBanner, EvidenceChip, StandingLabel, Avatar | Bespoke in `/components/lp` |
| Not in the 21, also from shadcn | Dialog and AlertDialog (upgrade and consent modals), Tooltip, Switch, Checkbox, Label |

**Two traps.**
- **The `--muted` name clash.** The handoff's `--muted` is a text colour. shadcn's `--muted` is a
  background, and `--muted-foreground` is its text. Map the handoff's colour to `--muted-foreground`, or
  grey text colour will paint fills.
- **Tailwind version.** Current shadcn targets Tailwind 4. Orgpuls runs 3.4. On Tailwind 3, use the
  `shadcn@2.3.0` CLI with HSL-channel variables (question A4).

**Fonts and icons.**
- **Font usage.** The design uses Poppins at 500 only, and Figtree at 400, 500, 600 and 700.
- **Font files.** Commit Figtree, a variable font (latin and latin-ext), and Poppins 500, with a
  `fonts.css`. The app and the design render load the same files, as Orgpuls's D-07 requires
  (`docs/DEVIATIONS.md:189`).
- **Icons.** Use `lucide-react` pinned to one Lucide release. Serve the same release's data to iconify in
  the design render.

---

## 8. Findings in Orgpuls and Sentral (reported, not changed)

The handoff says to change nothing in Orgpuls unless the owner asks. These are for the owner to decide.

| # | Where | Finding | Severity |
|---|---|---|---|
| 1 | Orgpuls `submit_response` (0204) | The invitation update and the response insert share an `xmin`. One join names every respondent to anyone with SQL access. | High: the same class as 0229 |
| 2 | Orgpuls 0205:370-377 | Platform token checks fail open on a missing `aud`, `exp` or `iat` | Low: needs the signing secret |
| 3 | Orgpuls 0205:403-415 | A refused platform command leaves no audit row, contrary to the comment at 22-23 | Low |
| 4 | Orgpuls 0219:137 | Mail to hard-bounced addresses is retried on every notice. Only Teams checks `address_problems`. | Medium: sender reputation |
| 5 | Orgpuls `scripts/functions/deploy.mjs:21` | Falls back to the hosted project ref when unset | Low inside Orgpuls; high if copied |
| 6 | Orgpuls `supabase/tests/local_account.sql` | A known password into `auth.users`, with no guard inside the SQL | Medium if run through the connector |
| 7 | Orgpuls `.claude/settings.json` | Bypass mode, empty deny list, no hooks. `cloud-session-start.sh` never runs. | Information |
| 8 | Orgpuls CI | The SQL half of `tests/invariants/invariants.sql` never runs in CI. Only the S half of the wiring audit gates. | Medium |
| 9 | Orgpuls 0205 and Sentral 0067 | `billing.changed` carries no price, currency or seats, so Sentral shows zero revenue and assumes NOK | Medium |
| 10 | Sentral 0001:61 | A non-nine-digit organisation number fails a whole event batch with HTTP 500 | Medium for Orgpuls's UK market |

---

## 9. Provenance register

Every file copied or adapted from Orgpuls names its origin in its first line, with the commit `6f5d441`.
This register lists them. Milestone 0b copied the files marked *0b*; the others are planned.

| Orgpuls path at `6f5d441` | LeaderPact path | How | When |
|---|---|---|---|
| `CLAUDE.md` | `CLAUDE.md` | Structure kept, content rewritten (4.1) | 0b |
| `.claude/settings.json` | same | As it is (A1), plus the SessionStart hook | 0b |
| `.mcp.json`, `scripts/cloud-env-setup.sh`, `scripts/cloud-session-start.sh` | same | As they are | 0b |
| `scripts/playwright-mcp.sh` | same | Viewport 1280 by 900 | 0b |
| `.github/workflows/ci.yml` | same | Adapted (4.2): no `paths-ignore`, Realtime kept, service-role grep, Playwright smoke | 0b |
| `scripts/qa/test-db.sh` | same | Adapted: no design figures, any local database | 0b |
| `scripts/audit/wiring.mjs` | same | LeaderPact code roots | 0b |
| `.claude/skills/audit/sql/security.sql` | same | LeaderPact answer tables, k = 4 and 8, `service_role` in S2, exact column list in S7 | 0b |
| `.claude/skills/audit/sql/wiring.sql` | same | As it is | 0b |
| `.claude/skills/audit/allowlist.json` | same | Structure only, no entries | 0b |
| `supabase/config.toml` | same | Adapted: no Entra hook, auth settings declared | 0b |
| `supabase/migrations/0001_foundation.sql`, `0150_k_floor_three.sql` (pattern) | `supabase/migrations/0001_foundation.sql` | Written fresh, citing the pattern | 0b |
| `supabase/tests/k_floor_invariants.sql` (harness) | `supabase/tests/foundation_invariants.sql` | The `_inv` harness, new checks | 0b |
| `next.config.ts` | same | Security headers kept; redirects, analytics origin and template tracing removed; `wss:` for Realtime | 0b |
| `middleware.ts`, `lib/supabase/middleware.ts` | same | Deny by default, no host gate | 0b |
| `lib/supabase/{env,server,anon,read,write,skew}.ts` | same | As they are | 0b |
| `lib/i18n/icu-rules.ts` | same | As it is | 0b |
| `lib/i18n/{dates,client}.ts`, `lib/i18n/request.ts` | same | English only | 0b |
| `scripts/verify/i18n.mjs` | same | Rewritten for one locale, with the copy rules | 0b |
| `tsconfig.json`, `vitest.config.ts`, `vercel.json`, `postcss.config.mjs` | same | As they are (Vitest also runs `.test.tsx`) | 0b |
| `playwright.config.ts` | same | en-GB, UTC, 1280, 390 and 360 px | 0b |
| `tests/unit/skew.test.ts`, `tests/unit/helpers.test.ts`, `tests/stubs/server-only.ts` | same | As they are; helpers without the one-organisation rule | 0b |
| `.gitignore` | same | Trimmed | 0b |
| `lib/analytics/scrub.ts` | same | `/j` as the capability prefix | planned |
| `lib/xlsx.ts` | same | As it is | planned |
| `components/respond/ChoiceGroup.tsx`, `lib/respond/radiogroup.ts` | `components/lp/…`, `lib/respond/…` | If not replaced by Radix RadioGroup | planned |
| `scripts/verify/{probe,crop}.mjs`, `{shoot,region-diff,mobile}.mjs` | same | Adapted (4.13) | planned |
| `supabase/functions/_shared/brevo.ts` (email half) | same | As it is | planned |
| `.claude/skills/audit/SKILL.md`, `journeys.md` | same | The method kept, the journeys rewritten from handoff section 13 | planned |

The SQL is not copied file by file. Each LeaderPact migration is written fresh and cites the Orgpuls
migration and lines it follows, because Orgpuls's functions were redefined many times
(`dispatch_claim` ten times, `module_seed` five, `wheel_tick` five). Its suites are ported with it.

---

## 10. Where a shared package would pay off later

Not proposed now (handoff A.2). Worth it once both products are stable:

- **The platform contract.** The SQL JWT verifier, `platform_command`, `platform_emit`, claim and done, the
  dispatcher's signer, and a schema of the event and command contract that Sentral's receiver validates
  against. This pays off first: Sentral and both products must agree byte for byte.
- **The test pattern.** The `_inv` suite harness and runner, `wiring.mjs` and `security.sql` made
  configurable, and the anonymity firewall.
- **Server helpers.** `lib/supabase/*`, the QA guards in `env.mjs`, the security headers and
  `scrub.ts`.
- **Mail.** The outbox claim protocol with its suite, `brevo.ts`, and the mail renderer's escape and
  plain-link rules.
- **Data and output.** The canonical-JSON data-file sync, `icu-rules.ts`, and `xlsx.ts` and zip.
- **The design-render harness** for `.dc.html` files, and the visual tools.

---

## 11. Assumptions in this evaluation

- **"Group" is `team` in the schema** (handoff section 8) and "group" everywhere in the interface.
- **One leader per group in the MVP.** The only leader cannot be removed.
- **The diagnostic requires every item** (question C8). If the owner says otherwise, per-item k and
  complementary suppression from 0042 come back into scope.
- **Results are read only through definer functions over the snapshot.** No client reads `factor_score`.
- **Sentral changes are made in Sentral's repository, by a session working there.** This repository holds
  only LeaderPact's side and its tests.
- **This pull request contains no code.** It holds this document, the handoff
  (`docs/LEADERPACT_HANDOFF.md`) and the design reference (`design/reference/`), which nothing imports.
