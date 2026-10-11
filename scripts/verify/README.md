# Visual checks

Three scripts and one data file, for handoff section 4 and REUSE_EVALUATION section 4.13. The owner's
decisions stand over all of them: this is **not a pixel-perfect gate**; match the design **where it is right**
(handoff section 11 and the contrast fixes of section 4 say where it is not); at 390 and 360 px there is no
design, so the phone check is rules, axe and a person looking at screenshots (answer B3).

| File | What it does | Gates on |
|---|---|---|
| `design-render.mjs` | Renders the design at a prototype state in headless Chromium | page errors, unresolved `{{`, aborted requests |
| `claims.json` | One claim per component: where it is in the design, what to compare, what not and why | (data) |
| `side-by-side.mjs` | Design beside app per component: computed styles, plus a design / app / diff sheet | a claimed property that differs, a missing locator |
| `mobile.mjs` | The app at 390 x 844 and 360 x 780: overflow, sizes, axe, console | any rule |

In a cloud session, prefix every command with `PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium`. Output goes to
`artifacts/` (gitignored).

## design-render.mjs

```
node scripts/verify/design-render.mjs --route home --plan team          # artifacts/design/home-team-leader-horizontal.png
node scripts/verify/design-render.mjs --route results --plan team --role member --full
node scripts/verify/design-render.mjs --all                             # 14 routes x free and team
node scripts/verify/design-render.mjs --route home --layout vertical    # the sidebar, for comparison only
```

Options: `--route`, `--plan free|team`, `--role leader|member`, `--layout horizontal|vertical`,
`--seed '<json>'` (merged into the prototype's store), `--out`, `--full`, `--keep-proto`.

**The design runs its own code**, so it runs only here, in headless Chromium, and every request is routed:
the design files from `design/reference/` under a fake origin; React 18.3.1, ReactDOM 18.3.1 and
Babel 7.29.0 from `node_modules/.cache/dc-vendor/` (fetched once from unpkg and checked against the SRI hashes
`support.js` declares, on download and on every read); Google Fonts to the app's own `app/fonts.css` and
`public/fonts/`, so both sides draw with the same files (if those are missing, Google is let through with a
warning); `code.iconify.design` and `api.iconify.design` through to the network for icons. Everything else is
aborted and reported. Behind a proxy that Node's `fetch` does not use, run the first time with
`NODE_USE_ENV_PROXY=1`.

**A state** is seeded before the first script runs: `localStorage['lt-proto-p6'] =
{ v: 'v5.0', route, plan, role, ui: { nav, wide: false }, ...seed }`, one fresh browser context per state.
`createStore()` in `proto-core-v5.js` keeps a stored object whose `v` is `v5.0` and fills every missing key
from `initial()`, so any key of the prototype's state can be seeded (for example `{"sel":"a5"}` for the
agenda's task-match warning).

**The top-bar layout.** The prototype opens in its sidebar layout: `initial()` holds
`ui: { nav: 'vertical', wide: false }`, and `view()` derives `ui.horizontal = s.ui.nav !== 'vertical'`
(`proto-core-v5.js` lines 370 and 929-932). Its own controls flip it with `A.setNav('horizontal')` or
`A.toggleNav()` (lines 501-503). Every state is seeded with `ui.nav: 'horizontal'` unless `--layout vertical`
is asked for. We build the top bar only (handoff section 4 Layout and section 11).

**The settle** waits for the runtime to mount with the store, every font weight the design names to load,
icon requests to go quiet and every visible icon to draw. The floating "Prototype" control is hidden
(handoff section 11 removes it). The browser's parser reports SVG attributes holding a binding
(`points="{{ g.p }}"`) once, before the runtime renders the template; that is filtered as noise, and the
rendered text is checked for a leftover `{{` instead.

As a module: `launchBrowser()`, `openDesign(browser, state)` returns `{ page, errors, blocked, close }` for
locating elements; `state.steps` can press a control (`{ click }`) or call a prototype action (`{ act }`)
after the settle, for a state the store cannot hold (a toast).

## claims.json

One entry per component of handoff section 4 *Components to build*: `topbar`, `nav-item-active`, `nav-item`,
`plan-pill`, `hero-block`, `card`, `section-header`, `list-row`, `button-primary`, `button-secondary`,
`button-small`, `button-danger`, `pill`, `tabs`, `option-row-off`, `option-row-on`, `progress-bar`,
`level-bar`, `level-bar-results`, `count-dots`, `hint-box`, `warning-box`, `sample-banner`, `evidence-chip-strong`,
`evidence-chip-moderate`, `evidence-chip-other`, `standing-label`, `avatar`, `toast`, `icon-tile`.

Each claim names:

- `design.state` and `design.locator`: a Playwright selector that resolves to exactly one visible element.
  `side-by-side.mjs --design-only` proves it for every claim and part.
- `app.locator`: `[data-specimen="<id>"]` on `/specimens`, or a list tried in order. A marker on an unstyled
  wrapper (`<span data-specimen="pill"><Pill/></span>`) is followed down to the first element that draws
  something.
- `properties`, compared by computed style. Group names expand (`padding`, `border`, `border-top`,
  `border-radius`, `gap`); `font-family` is the first family; a radius is the one drawn (50 %, 9999px and
  17px on a 34 px circle are the same); `box-width`/`box-height` are the rendered box (icons).
- `parts`: sub-elements, located in the app by `data-part="<name>"` first, then by a semantic fallback where
  one exists (a role, a heading, the first child, `svg` for a lucide icon).
- `expect`: where a higher source corrects the design, the app is held to that value, with the reason.
  Today: `--text-2` for the hero's date (contrast fix: `--muted` on `--hero`). The button sizes and the
  warning's ink sentence follow the design, not the handoff's numbers (D-12): the handoff's 12 px and 600
  describe the large button, and in the design only the warning's action is `--flag-ink`.
- `excluded`: what is deliberately not compared, each with its reason (a section 11 row, a contrast fix, or
  "data, not style").
- `mask`: design regions section 11 removes, painted magenta before the pixel diff (the 360 nav item, the
  layout and width toggles, the Assessment schedule button).
- `tolerance`: the share of differing pixels the sheet calls close. Informational only.

**What the specimens page must mark** for every claim to resolve without fallbacks:
`data-part="bar"` (the pill inside the top bar), `date`, `greeting`, `status` (hero), `title`, `count`, `meta`
(section header), `kind`, `title`, `meta` (list row), `number` (option circle), `fill` (progress and level
bars, whose `[role="progressbar"]` / `[role="meter"]` is the track), `dots`, `dot-on`, `dot-off` (count dots),
`chip`, `text`, `upgrade` (sample banner), and `icon` where the icon is not an `svg`.

## side-by-side.mjs

```
NEXT_DIST_DIR=.next-sbs npx next build            # then remove '.next-sbs/types/**/*.ts' from tsconfig.json's include
NEXT_DIST_DIR=.next-sbs npx next start -p 3100 -H 127.0.0.1 &
node scripts/verify/side-by-side.mjs                                   # every claim
node scripts/verify/side-by-side.mjs --only button-primary,tabs
node scripts/verify/side-by-side.mjs --design-only                     # design locators alone, no app
```

Options: `--app <base>` (default `http://127.0.0.1:3100`), `--path` (default `/specimens`), `--only`,
`--claims`, `--out` (default `artifacts/side-by-side`). Stop the server by its PID afterwards. The build also
points `next-env.d.ts` at `.next-sbs`; put it back to `.next-build` if your type check relies on it.

Writes `<id>.png` (design | app | diff, padded to the larger size, pixelmatch threshold 0.1), `report.md`
and `report.json`. Status per claim: **match**, **differs** (the properties by name, with design, app and
expected values), **design-not-found** or **app-not-found** (an app that is not served is reported per claim,
not a crash). Exit 1 on any differs or not-found; the pixel share never fails the run.

**What it proves:** each claimed property of each component computes to the design's value, or to the value a
higher source sets, at 1280 px in the same Chromium with the same font files. **What it does not:** layout
between components, widths, copy, data, states other than the ones claimed, hover and focus, and anything the
claims leave out.

## mobile.mjs

```
node scripts/verify/mobile.mjs                                         # /specimens and / at 390 and 360
node scripts/verify/mobile.mjs --app http://127.0.0.1:3000 /specimens /scan
node scripts/verify/mobile.mjs --widths 360 /specimens
```

Per path and width, in a fresh mobile context (`isMobile`, `hasTouch`): no sideways scroll (a table scrolling
inside its own scroller is allowed, section 4 Layout); body text at least 15 px (handoff section 4 Type: the body
role, told apart by size and weight; meta, micro labels, chips and control labels keep their sizes, and
`data-allow-small` exempts anything else on purpose); inputs at least 16 px; links, buttons, form controls and interactive roles at
least 44 x 44 (a checkbox or radio is measured by its label; visually hidden inputs and an off-page skip link
are not targets); no serious or critical axe violation; no console error. Offenders are listed with a
selector in `artifacts/mobile/report.md`; full-page screenshots are in `artifacts/mobile/<width>/`. Exit 1 on
any rule failure or a path that is not served.

## What a person still reviews

- **Every sheet in `artifacts/side-by-side/`**, especially claims marked over tolerance: a matching style can
  still sit in a wrong layout, and an icon or a wrap can look wrong while every property agrees.
- **Each `expect` and `excluded` entry**: they are judgements against the handoff, and the owner may decide
  otherwise (for example buttons at 11 px as the design draws them).
- **Every phone screenshot** in `artifacts/mobile/390/` and `360/`: bad wraps, truncated meaning, cramped or
  squeezed cards, the bottom bar over content or a button, a table that should scroll inside its card, focus
  rings cut off, anything that reads as a desktop page shrunk. The rules cannot see these, and the design has
  no phone layout to compare with.
- **Everything section 11 removes stays removed**: the masks hide those regions in the sheets, so their
  absence in the app is a person's check.
