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
