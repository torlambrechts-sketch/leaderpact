# Component specs, measured from the design

Measured on 11 October 2026 from `design/reference/LeaderPact App - Cream v2.dc.html` ("the design"), with
every `{{ binding }}` resolved against `design/reference/proto-core-v5.js` ("PC") and the theme object in
the design (L1638-1650). The rules come from `docs/LEADERPACT_HANDOFF.md` section 4 (design system) and
section 11 (where the design is wrong), and from the owner's answer B2 in `docs/REUSE_EVALUATION.md`
section 2.0.

## How to read this file

- `L742` is a line of the design file. `PC L742` is a line of `proto-core-v5.js`.
- Values are quoted from the inline styles. Bindings were resolved by running PC's `view()` with the
  design's theme in a sandbox, so a resolved value is what the prototype renders, not a guess.
- Where one style sets a property twice (for example `padding:22px 24px;padding:20px`, a pattern the design
  uses 45 times), the later value wins and only that value is given.
- **Build:** marks the value to build where the design breaks a rule. **Conflict:** marks a place where
  the design and the handoff's own measurement disagree. Section 7 lists them all.
- Inherited defaults, unless a row says otherwise:
  - font `'Figtree',system-ui,sans-serif` and text colour `#111111`, from the root (L17);
  - `line-height` is never set globally (L15 and `support.js` set none), so it is `normal` from the font's
    own metrics. Tailwind preflight sets 1.5; reset it, or every height differs;
  - `letter-spacing` normal, `text-transform` none. The design never uses `text-transform`: its
    capitals are typed as capitals ("SAMPLE", "STRONGEST");
  - weights loaded: Figtree 400, 500, 600, 700 and Poppins 400, 500, 600 (L12).
- Icons are `<iconify-icon icon="lucide:…">`. The icon box is 1em, so an icon with no `font-size` takes
  the text size around it. The lucide-react name is given beside each one. Iconify's lucide set and
  lucide-react can be different releases, so a glyph can differ slightly. That was not checked.
- The design has no `<a>` and no `<button>`: its 237 `onClick` handlers sit on `div` and `span`. Only some
  text inputs sit in a `<label>` (L106, L1110, L1296). Build real elements (handoff section 4). The design styles no focus state except on inputs
  (L15: `outline:2px solid #111111;outline-offset:1px`). Apply that ring to every interactive element.

## Contents

0. [Design locators](#0-design-locators)
1. [Colour tokens](#1-colour-tokens)
2. [Radius scale](#2-radius-scale)
3. [Type scale](#3-type-scale)
4. [Spacing](#4-spacing)
5. [Contrast corrections](#5-contrast-corrections)
6. Components: [topbar](#topbar) · [logo](#logo) · [nav-item](#nav-item) · [plan-pill](#plan-pill) ·
   [avatar](#avatar) · [hero-block](#hero-block) · [card](#card) · [section-header](#section-header) ·
   [list-row](#list-row) · [icon-tile](#icon-tile) · [button](#button) · [pill](#pill) · [tabs](#tabs) ·
   [option-row](#option-row) · [progress-bar](#progress-bar) · [level-bar](#level-bar) ·
   [count-dots](#count-dots) · [hint-box](#hint-box) · [warning-box](#warning-box) ·
   [sample-banner](#sample-banner) · [evidence-chip](#evidence-chip) · [standing-label](#standing-label) ·
   [toast](#toast) · [phone bottom bar](#phone-bottom-bar)
7. [Conflicts with the handoff](#7-conflicts-with-the-handoff)
8. [Locator index, machine-readable](#8-locator-index-machine-readable)

---

## 0. Design locators

### Opening a state

The prototype reads its whole state from `localStorage['lt-proto-p6']` (PC L382-385). Rules that matter
for a screenshot script:

1. **`"v":"v5.0"` is required.** Any other value resets the state (PC L385).
2. **Add `"ui":{"nav":"horizontal","wide":false}` to every app-route seed.** The prototype's default is
   `ui.nav: 'vertical'` (PC L370), the sidebar layout we do not build. Without this key the top bar
   shows a breadcrumb and a search field instead of the logo and navigation.
3. **The merge is shallow** (PC L386). A seeded top-level key replaces the whole default object. Seed
   nested objects such as `set`, `res` or `rounds` whole, or reach the state through the prototype's
   own controls.
4. Toast, upgrade dialog and consent dialog are cleared on load (PC L388). A toast needs a click after load,
   and it lasts 3.8 s (PC L393).
5. Viewport 1280 px wide. The root has `min-width:1280px` (L17).
6. The public routes (`landing`, `scan`, `personal`, `invite`, `team`) show the public header (L19-28).
   It holds "Team Scan", "Research", "Templates" and "For coaches", which section 11 removes. Crop to the
   component.

### Finding the element

Each locator gives:

- **text**: a stable text inside or beside the element;
- **tpl**: the element's `data-dc-tpl` attribute. `support.js` stamps every element of the `<x-dc>`
  template with its document-order index (support.js L467-477) and copies it onto the rendered element
  (support.js L796-799). Elements inside an `sc-for` share one index, so take the `nth` match. **These
  indices were computed offline** by counting the template's elements with an HTML parser (3,514
  elements; the root `div` at L17 comes out as 6, after the helmet's six elements). Confirm one against
  the live DOM before trusting the rest. They hold only while the design file is unchanged.
- Rendered inline styles are browser-normalised: `#e4ddd2` reads back as `rgb(228, 221, 210)`. Do not
  match on the source style strings.

### Seeds

Every seed below is the full value for `localStorage['lt-proto-p6']`.

```json
{
  "S_HOME_TEAM": {"v":"v5.0","route":"home","plan":"team","role":"leader","ui":{"nav":"horizontal","wide":false},
    "cv":{"group":false,"optIn":{"leader":true,"member":true},"shared":{"leader":false,"member":false}},
    "rounds":[
      {"id":"r1","type":"ext","label":"Round 1","opens":"2 Mar","closes":"16 Mar 2026","status":"followup","answered":8,"of":8,"mine":true,"notice":"23 Feb","released":"18 Mar","session":"20 Mar","follow":"2 focus areas · 4 actions"},
      {"id":"r2","type":"std","label":"Round 2","opens":"14 Sep","closes":"28 Sep 2026","status":"followup","answered":8,"of":8,"mine":true,"notice":"7 Sep","released":"30 Sep","session":"7 Oct"},
      {"id":"r3","type":"ext","label":"Round 3","opens":"1 Mar","closes":"15 Mar 2027","status":"scheduled","answered":0,"of":8,"mine":false,"notice":"22 Feb"},
      {"id":"f2","type":"tlf","label":"Feedback round 2","opens":"2 Nov","closes":"16 Nov 2026","status":"scheduled","answered":0,"of":7,"mine":false,"notice":"26 Oct"}]},
  "S_HOME_FREE": {"v":"v5.0","route":"home","plan":"free","role":"leader","ui":{"nav":"horizontal","wide":false}},
  "S_SCAN": {"v":"v5.0","route":"scan","plan":"free","role":"leader","scan":{"idx":0,"answers":[4,null,null,null,null,null,null,null,null,null,null,null]}},
  "S_TEAM_VIEW": {"v":"v5.0","route":"team","plan":"free","role":"leader","scan":{"idx":11,"answers":[4,3,3,2,4,4,3,4,4,5,3,4]},"invite":{"answered":6,"copied":false}},
  "S_INVITE": {"v":"v5.0","route":"invite","plan":"free","role":"leader"},
  "S_GROUP_TEAM": {"v":"v5.0","route":"group","plan":"team","role":"leader","ui":{"nav":"horizontal","wide":false}},
  "S_GROUP_FREE_LEADER": {"v":"v5.0","route":"group","plan":"free","role":"leader","ui":{"nav":"horizontal","wide":false}},
  "S_GROUP_FREE_MEMBER": {"v":"v5.0","route":"group","plan":"free","role":"member","ui":{"nav":"horizontal","wide":false}},
  "S_PLAN": {"v":"v5.0","route":"develop","devTab":"focus","plan":"team","role":"leader","ui":{"nav":"horizontal","wide":false}},
  "S_PEOPLE": {"v":"v5.0","route":"people","plan":"team","role":"leader","ui":{"nav":"horizontal","wide":false}},
  "S_RESULTS": {"v":"v5.0","route":"results","plan":"team","role":"leader","ui":{"nav":"horizontal","wide":false}},
  "S_RESULTS_OVERVIEW": {"v":"v5.0","route":"results","plan":"team","role":"leader","ui":{"nav":"horizontal","wide":false},
    "res":{"round":2,"layer":"processes","depth":"overview","scale":"focus","qLayer":"all"}},
  "S_AGENDA_FLAG": {"v":"v5.0","route":"meetings","meetTab":"agenda","sel":"a5","plan":"team","role":"leader","ui":{"nav":"horizontal","wide":false}},
  "S_SETTINGS": {"v":"v5.0","route":"settings","plan":"team","role":"leader","ui":{"nav":"horizontal","wide":false}}
}
```

Why `S_HOME_TEAM` is not the plain default: with the default rounds and `cv`, "Needs you" also lists
"Hold the results session for round 2" (results session, removed by section 11) and "Rate 4 colleagues"
(contribution view, removed). This seed leaves four rows, all allowed: "Answer pulse 6", "Run a structured
round on the decision item", "Choose a second focus area" and "Henrik Bakke has not joined yet". The
greeting resolves to "Good morning, Kari" and the status line to "4 things need you · 1 open for answers ·
next up: Round 3, 1 Mar".

---

## 1. Colour tokens

Counts are occurrences in the design file. **style** counts inline `style` attributes, which includes
`style-hover`. **other** counts SVG attributes, the theme object (L1639-1649) and the global CSS (L15).
`#fff` is counted with `#ffffff` and `#111` with `#111111`. Bound colours repeat at render, so these are
source counts, not rendered counts. **Status:** H means the handoff section 4 lists it. B2 means the
owner's answer B2 adds it. **Neither** is flagged.

### Neutrals and surfaces

| Hex | style / other | Measured roles (lines) | Token | Status |
|---|---|---|---|---|
| `#f1ede6` | 2 / 1 | Page background: root L17, questionnaire overlay L1513, `body` L15. At 92% (`rgba(241,237,230,.92)`) it is the top-bar band, L194 | `--bg` | H |
| `#ffffff` | 540 / 8 | Card fill (278 `background`), the card's own 1 px border (173 `border`: "white border" cards), text on ink (89 `color`) | `--surface` | H |
| `#f8f5ef` | 22 / 1 | Inset boxes inside a card (L98, L237, L286, L311-314), selected-card fill (theme `card.on`, L1643), row hover (L454, L499 `style-hover`) | `--surface-sunk` | H |
| `#f5f1ea` | 43 / 0 | Quiet fills: link field (L130, L239), search field (L202), guidance box (L534), practice row (L302), source tiles (L469), info notes (L1528) | `--surface-soft` | H |
| `#e4ddd2` | 25 / 0 | Top-bar pill fill and border (L195), public header (L21), sidebar (L185). Border of the hero (L222), of every segmented tab strip (L327, L410, L662, L774, L1212), landing cards (L32, L46). Questionnaire header rule (L1514) | `--bar` | H |
| `#e4d9c9` | 3 / 1 | Hero fill: home greeting (L222), landing hero (L32), person header (L333). Tile tint 4 (L1648) | `--hero` | H |
| `#ece6dc` | 56 / 0 | Bar tracks (45 `background`: L95, L157, L246, L273, L478 …). Border of inset boxes (L98, L99, L238, L286, L729, L1157, L1168). Table header rule (L497, L553, L559, L643) | `--track` | H |
| `#f0ebe2` | 139 / 0 | Row dividers inside cards: `border-top:1px solid` 133 times (L231, L264, L271, L280 …) | `--divider` | H |
| `#e2dbcf` | 55 / 6 | Control borders: inputs (L1110, L1294), chips and options when off (theme `opt.off`, `chip.off`), member sample banner (L214). Scan progress track (L70). Count dot off (theme `dotOff`, L1649). Radar strokes (L429-430, removed) | `--border` | H |
| `#ddd5c8` | 69 / 0 | **Secondary-button border.** 63 clickable `div` and 1 `span` (L80, L151, L411, L417, L1113 …), 2 disabled secondary buttons (L412, L539), 3 dashed "current plan" boxes (L1149, L1150, L1192) | `--border-strong` | **B2** replaces `#d8d0c2` |
| `#d8d0c2` | 3 / 1 | One button border: the landing "Open the demo group" (L39, content removed by section 11). Answer bars in the items view (L598, L640, removed). Theme `col.on.bd` (L1644, pulse trend column) | Handoff's `--border-strong` | H, superseded by B2. Build `#ddd5c8` |
| `#cfc6b6` | 5 / 0 | Dashed borders: hint boxes (L137, L237), empty focus-area slots (L305, L714). Roster card hover border (L784) | `--border-dashed` | H |
| `#ebe5da` | 7 / 1 | Border of a selectable card when off (theme `card.off.bd`, L1643; library cards L951, L957), pattern card (L513), side cards (L797, L1066, L1073, L1083) | proposed `--border-card` | **B2** |
| `#efe9df` | 7 / 0 | Top-bar settings tray (L205). Small neutral chips: sidebar SAMPLE (L188), agenda type chip (L1285), status pill (L1067), tag (L962). Row rules (L435, L454, `border-top`) | proposed `--surface-chip` | **B2** |
| `#efeae1` | 4 / 0 | Hairline above a card's footnote: landing sample (L52), team view (L159), sidebar footer (L190). One box border (L977) | proposed `--rule` | **B2** |
| `#f3efe8` | 1 / 0 | Row divider in the Results overview table (L499, `border-bottom`) | none | **Neither.** Build `--divider` |
| `#e9e4f3` | 1 / 0 | Track of the layer mini-bars on Home (L286) | none | **Neither.** Build `--track` |

### Ink and text

| Hex | style / other | Measured roles (lines) | Token | Status |
|---|---|---|---|---|
| `#111111` | 179 / 24 | Text (63 `color`), primary button and active fill (114 `background`), progress fill (L70), count dot on (L1649), selected option border (L1639) | `--ink` | H |
| `#2b2a26` | 0 / 1 | Text of an **inactive nav item** and of an inactive settings menu item (theme `nav.off.fg`, L1641; rendered on every inactive item) | proposed `--nav-ink` | **B2** |
| `#36342f` | 26 / 1 | Body text in tinted or white boxes: landing step cards (L59-61), pattern text (L513), the comparison table (L925-933), "Magic link by email" (L1110). Text of an off chip (theme `chip.off.fg`, L1642) | proposed `--text-body` | **B2** |
| `#46433c` | 25 / 0 | Text on the hero colour (L36, L223 status line), guidance and definitions (L530, L1526), agenda type chip text (L1285) | `--text-3` | H |
| `#55524a` | 133 / 4 | Secondary text, inactive tab text (theme `tab.off.fg`, L1640), "other" evidence text (L1647) | `--text-2` | H |
| `#77736a` | 365 / 2 | Meta text (365 `color`). See section 5 | `--muted` | H, with contrast limits |
| `#aaa59a` | 1 / 0 | "Not shared" in 22 px on a person page (L860). Contrast 2.45 on white | none | **Neither.** Fails. Build `--text-2` |
| `#3a3950` | 33 / 1 | Text on `--accent` pills (L72, L91, L149, L204), text links "Schedule →" and "People →" (L279, L308), small-caps headings "STRONGEST" (L288-291), dashed prototype buttons | `--accent-ink` | H |
| `#2b2a3d` | 50 / 1 | Text on white chips and on white buttons over ink (L110, L211, L253), change values "+0.3" (L286, L479), settings tray icons (L205), accent pills with strong text (L417, L1524), evidence strong text (L1647) | `--accent-deep` | H |
| `#4b3a8f` | 1 / 0 | Landing eyebrow text "12 questions · about 3 minutes · no account" (L34) | proposed `--accent-eyebrow` | **B2** |
| `#4f33b8` | 0 / 1 | Global `a:hover` colour (L15). The design has no `<a>`, so this is never rendered | proposed `--link-hover` | **B2** |

### Accent

| Hex | style / other | Measured roles (lines) | Token | Status |
|---|---|---|---|---|
| `#cccbdc` | 41 / 3 | Pills (L72, L204), icon tiles (L231, L264), selected option fill (L1639), avatar pair 4 (L1645), tile tint 1 (L1648) | `--accent` | H |
| `#b5b3cf` | 18 / 1 | Toast icon (L1612). Hover border of "This week" tiles (L220). Dashed "+ Choose" (L515) and prototype buttons. Agreement gauge middle (L1646, L510) | `--accent-mid` | H |
| `#8a87b3` | 43 / 0 | Bar fills (31 `background`: L95, L157, L246, L478). Icon colour (11 `color`): standing icons (L480), count icons (L463, L464), source icons (L469), "This week" icons (L220) | `--accent-strong` | H. No text on it |

### Meaning: danger, flag, status, evidence

| Hex | style / other | Measured roles (lines) | Token | Status |
|---|---|---|---|---|
| `#c0502e` | 19 / 0 | Danger text: "Delete account" (L1114), "Remove" (L386), over-time text (L1272). Solid danger confirm fill (L1190) | `--danger` | H |
| `#f0c9d2` | 5 / 0 | Danger button border (L1114, L1126, L1138, L1189), downgrade panel border (L1190, 1.5 px) | `--danger-border` | H |
| `#fff6f7` | 1 / 0 | Downgrade confirm panel fill (L1190) | none | **Neither** |
| `#d08a12` | 2 / 1 | Warning box border and its action's border (L1301). Flagged agenda card border (theme `flag`, L1649, via PC L759) | `--flag` | H. Border and marks only |
| `#fff9ef` | 2 / 1 | Warning box fill (L1301), review notice fill (L1569), flagged agenda card fill (L1649) | `--flag-bg` | H |
| `#7a4e03` | 1 / 0 | The warning box's action, "Keep it on the agenda" (L1301) | `--flag-ink` | H |
| `#a86c05` | 1 / 0 | Warning icon `lucide:triangle-alert` in the task-match box (L1301). 4.17 on `#fff9ef` | none | **Neither** |
| `#b7790b` | 1 / 0 | Warning icon in the questionnaire review notice (L1569). 3.48 on `#fff9ef` | none | **Neither** |
| `#f0d7a5` | 1 / 0 | Border of the questionnaire review notice (L1569) | none | **Neither** |
| `#8a5a00` | 1 / 0 | Time-check advice "Move some of it to pre-reads" (L1272). 5.93 on white | none | **Neither** |
| `#e07049` | 2 / 2 | Live-meeting dot on the Meetings tab (L1212), round-1 legend and radar line (L427, L431, removed). Theme `stepCur` (L1648) | `--step-current` | H. Marks only |
| `#e6f5e9` / `#22603a` | 1 / 2 each | Active status pill (theme `active`, L1648; L785 via PC L939), invoice status pill (L1188), avatar pair 3 | status: active | H |
| `#fff1c9` / `#6b5208` | 1 / 2 and 1 / 3 | Pending status pill "Invited" (theme `pending`, L1648), L846, avatar pair 6. `#6b5208` is also evidence-moderate text | status: pending | H |
| `#ebe5fb` / `#2b2a3d` | 0 / 1 | Evidence strong (L1647). Kind chip "Assessment" and "Scan" (PC L1185, L1217) | evidence: strong | H |
| `#f6f1e3` / `#6b5208` | 0 / 1 | Evidence moderate (L1647). Kind chip "Leader" | evidence: moderate | H |
| `#f1eff5` / `#55524a` | 0 / 1 | Evidence other (L1647). Kind chips "Your action" and "Profile" | evidence: other | H |
| `#d4cfdd` | 2 / 1 | **Toggle track when off** (theme `toggleOff`, L1649; used by the notification toggles L1132 and the group toggles L1124, L1139). Also L994, L1011 | none | **Neither.** The Notifications tab is in the MVP, so this needs a token |

### Avatars and tints

| Pair (background / text) | Index | Lines | Status |
|---|---|---|---|
| `#ffe2cf` / `#7a3a12` | 0 | L1645 | H |
| `#e4ecff` / `#25407a` | 1 | L1645 | H |
| `#e6f5e9` / `#22603a` | 2 | L1645 | H |
| `#cccbdc` / `#3a3950` | 3 | L1645 | H |
| `#fde3f0` / `#8a2459` | 4 | L1645 | H |
| `#fff1c9` / `#6b5208` | 5 | L1645 | H |
| `#e3f4f7` / `#1f5b66` | 6 | L1645 | H |
| `#eeeaf3` / `#4d4659` | 7 | L1645 | H |

Tile tints (L1648): `#cccbdc`, `#c3e1e6`, `#fdea8a`, `#e4d9c9` (H). `#c3e1e6` and `#fdea8a` also fill two
landing step cards (L60, L61).

### Only in removed features or the prototype controls (do not tokenise)

| Hex | Where |
|---|---|
| `#e0679f` | 360 self marker (L1419, L1422, L1451) and meeting-series bars (L1232-1233). Both removed |
| `#5fb3c2`, `rgba(95,179,194,.24)` | Dot plot "How far apart are we?" (L456). Removed |
| `#e4dbfb` | Initiative timeline (L672). Removed |
| `#2a2a2a` | Gradient start of the personal-view save card (L103, `linear-gradient(160deg,#2a2a2a,#111111)`). That card is in the MVP (handoff 6.3). Not a token; keep the gradient literal or ask |
| `#9a9a9a`, `#141414`, `#ff9b8a` | The floating "Prototype" control (L1615-1633). Never built |
| `rgba(224,112,73,.12)`, `rgba(17,17,17,.08)` | Radar fills (L431-432). Removed |

### Shadows and overlays

| Value | Where | Status |
|---|---|---|
| `0 30px 60px -40px rgba(60,50,30,.18)` | Scan question card (L71) | Handoff: questionnaire card |
| `0 40px 70px -36px rgba(60,50,30,.22)` | Landing sample card (L46) | Handoff: landing sample card |
| `0 10px 24px -10px rgba(0,0,0,.35)` | Landing "Start the scan" button (L38) | Handoff: main landing button |
| `0 20px 40px -20px rgba(0,0,0,.6)` | Toast (L1612) | **Not in the handoff's list of three shadows.** Keep it: the toast floats |
| `rgba(20,18,14,.45)` | Modal scrim (L1589, L1601) | |
| `blur(10px)` over `rgba(241,237,230,.92)` | Top-bar band (L194) | H |

---

## 2. Radius scale

Counts are `border-radius` declarations in the markup.

| Value | Count | Roles (lines) |
|---|---|---|
| `99px` | 124 | Pills and chips (L72, L204, L261), bar tracks and fills (L70, L157), top-bar pill (L195), public header (L21), toggles (L1132), results depth pills (L414) |
| `999px` | 2 | Landing eyebrow pill (L34). The same shape as 99px |
| `50%` | 59 | Avatars (L206), logo mark and dot (L197), option number circles (L76), toggle knobs |
| `28px` | 2 | Landing hero (L32), landing "How the scan works" card (L55) |
| `20px` | 75 | Large cards: scan card (L71), personal view (L90), team view (L155), Results and Meetings cards (L466, L1272). The hero block (L222). "This week" tiles (L220). Ink upsell card (L167) |
| `18px` | 124 | **The card** (L228, L260, L1107 …). Sample banner (L211, L214). Ink "What the Team plan adds" card (L250). Settings menu card (L1102). Empty focus-area slot (L305). Dialogs (L1590, L1602) |
| `16px` | 22 | Small cards: "You agree on" (L162-163), agenda item card (L1283), guidance box (L534), inset tiles (L543-548, L729, L1168), downgrade panel (L1190). **B2** |
| `14px` | 36 | Option rows (L76), large hint box (L137), layer tiles (L286), questionnaire option tiles (L1554), library cards (L944-948), info notes (L1528), "The team view is open" button (L140) |
| `12px` | 71 | Large buttons (L80, L81, L224), segmented tab strip (L327), hint box (L237), warning box (L1301), inset boxes (L98), link field (L130), inputs (L1294, L1296), toast (L1612), 36 px icon tiles on Assess (L887) |
| `11px` | 68 | Default buttons (L1113, L1114, L417, L536), 36 px icon tiles (L231, L264), home link field (L239), dashed "current plan" box (L1149) |
| `10px` | 69 | Nav item (L198), small button (L231, L264), settings tray (L205), settings menu item (L1103), inputs (L106, L1110), white Upgrade on ink (L211, L253), compact secondary (L151, L1277) |
| `9px` | 44 | Segmented tab (L327, L410, L662), selectable chips (L1111, L1295), extra-small button "Answer" (L274), copy button (L130), agenda number tile (L1284). **B2** |
| `8px` | 34 | Settings tray buttons (L205), home "Copy" button (L239), warning-box action (L1301), stepper buttons (L109), prototype chips. **B2** |
| `7px` | 5 | 22 px count dots (L134), "Add to plan" chip (L481), 22 px section number tile (L1533) |
| `6px` | 27 | SAMPLE chip (L211, L214), evidence chips (L477, L501), type chip (L1285), tags (L962) |
| `5px` | 7 | Kind chip in "Needs you" (L231, L264), 16 px count dots (L236), YOU chip (L785), sidebar SAMPLE chip (L188) |
| `4px`, `3px`, `2px` | 2, 6, 2 | Chart marks only: spark bars (L300), legend squares (L510), mean tick (L456) |
| composite | 12 | Spark bars `4px 4px 1px 1px` (L300), histogram bars (L553, L559, L597, L643), timeline ends (L799, L857, L1481). All in removed or out-of-list features |

The handoff's shape table omits 8, 9 and 16 px. Owner B2 adds them. The handoff also says buttons are
12 px. In the design, 12 px is the large button and **11 px is the default button**; see [button](#button).

---

## 3. Type scale

Poppins appears only in headings. Everything else is Figtree, inherited from L17. "normal" line-height
means unset.

### Headings, Poppins 500

| Role | Size | Tracking | Line-height | Lines | Handoff |
|---|---|---|---|---|---|
| Landing headline | 58 px | -0.035em | 1.03 | L35 | Matches |
| Landing section headline | 36 px | -0.03em | normal | L57 | Matches |
| Page greeting, team view title, scale title | 34 px | -0.03em | normal | L223, L149, L529 | Matches |
| **App page title** ("Group", "Results", "Plan", "People", "Assess", "Settings", "Meetings", "Me") | **32 px** | -0.03em | normal | L325, L408, L660, L774, L872, L1100, L1210, L1464 | **Missing from the handoff** |
| Card headline | 30 px | -0.02em | normal | L92, L1525 | Matches (28 to 30) |
| Scan question | 28 px | -0.02em | 1.25, `text-wrap:pretty` | L73 | Matches |
| Questionnaire question | 27 px | -0.02em | 1.3, `text-wrap:pretty` | L1551 | Not listed |
| Review title | 26 px | -0.02em | normal | L1566, L1579 | Not listed |
| Sub-headline | 22 px | none | normal | L104, L116 | Matches |

The handoff asks for `text-wrap: balance` on headlines. The design uses `pretty` on the two question
headings and nothing elsewhere.

### Figtree

| Role | Size / weight | Tracking | Line-height | Uses, example lines |
|---|---|---|---|---|
| Big number, scale view | 64 / 700 | -0.04em | 1 | L531 |
| Big number, invite | 52 / 700 | -0.03em | 1 | L133 |
| Big number | 40 / 700 | -0.03em | 1 | L236 |
| Focus level | 34 / 700 | -0.02em | 1 | L300 |
| Stat value | 30 / 700 | none | normal | L777-780 |
| Section title, large | 21 / 700 | -0.02em | normal | 27: L220, L466, L472, L667 |
| Value in a tile | 22 / 700 | -0.02em | 1.15 | L220 |
| **Section title** | **18 / 700** | **none** | normal | 27: L229, L245, L261, L269, L279, L1108. **Conflict:** the handoff gives -0.02em for 18 to 21 px; only 21 px has it |
| Card title, small | 17 / 700 | none | normal | 31: L299, L496 |
| Emphasis value, row title | 15 / 700 | none | normal | 44: L162, L163, L417 |
| Hero status line | 15 / 400 | none | normal | L223 |
| Option label | 15 / 500 | none | normal | L76 |
| Lead paragraph | 14.5 / 400 | none | 1.55 | L93 |
| List title | 14 / 700 | none | normal | 51: L231, L264, L1111 |
| Body | 14 / 400 | none | normal, or 1.5 to 1.55 in paragraphs | 34 + 10: L117, L211, L1604 |
| Control label | 13.5 / 600 | none | normal | 73: L327, L417, L1113 |
| Control label, strong | 13.5 / 700 | none | normal | 47: L211, L1114, L1529 |
| Body, small | 13.5 / 400 | none | normal | 44: L95, L157 |
| Body, smaller | 13 / 400, 600, 700 | none | normal | 92 / 27 / 34 |
| Meta | 12.5 / 400 | none | normal | 143: L229, L1108 |
| Small button label | 12.5 / 700 | none | normal | 26: L231, L264 |
| Nav label | 12.5 / 600 | none | normal | L198 |
| Meta, small | 12 / 400 | none | normal | 112: L231, L264 |
| Count pill, accent pill | 12 / 700 and 12 / 600 | none | normal | L261, L72 |
| Small caps heading | 12 / 700 | 0.05em | normal | L288-291 ("STRONGEST", "TO WATCH") |
| Meta, smallest | 11.5 / 400 | none | normal | 54: L98, L286 |
| Status pill, plan pill | 11.5 / 700 | none | normal | L204, L785 |
| Small caps label | 11.5 / 700 | 0.05em | normal | L523, L1541 |
| SAMPLE chip | 11 / 700 | 0.06em | normal | L211, L214 |
| Evidence chip | 11 / 700 (600 at L477) | none | normal | L501, L528 |
| Table head | 10.5 / 700 | 0.03em | normal | L473, L593 |
| Kind chip | 10.5 / 700 | none | normal | L231, L264 |
| YOU chip | 10 / 700 | none | normal | L785 |

Mobile (handoff section 4): body at least 15 px and inputs at least 16 px below 768 px. The design has no
phone sizes.

---

## 4. Spacing

### Page

| Thing | Value | Lines |
|---|---|---|
| Content width | `max-width:1240px` (`ui.maxW`, theme L1648) for the top-bar pill and the content | L195, L209 |
| Page gutter | 32 px: top-bar band `padding:14px 32px`, content `padding:12px 32px 0` | L194, L209 |
| Space below the page | `padding-bottom:96px` on the root | L17 |
| Gap between page blocks | 20 px (`gap:20px` in the content column and the page stacks) | L209, L221, L323 |
| Two-column grid | `minmax(0,1.5fr) minmax(0,1fr)`, gap 20 | L227, L243, L259 |
| Stacked side cards | gap 16 | L267 |
| Tile rows | 5 columns gap 12 (L220, L463); 4 columns gap 10 (L286) or 16 (L776) | |
| Page header row | `display:flex;align-items:center;gap:20px`. Kicker and title column `gap:4px` | L324-325 |
| Public widths | landing 1360 (L31), personal and team view 1080 (L89, L148), invite 720 (L125), scan 640 (L68) | |
| Questionnaire widths | intro 960 (L1522), answering 1160 with a 270 px section column (L1539), review 720 (L1564). The handoff overrides: one 640 px column | |

### Card padding (white cards, effective value)

| Card | Padding | Radius | Uses | Lines |
|---|---|---|---|---|
| Standard | 22px 24px | 18 | 55 | L228, L260, L1107 |
| Compact, Results and Meetings | 20px 22px | 20 | 32 | L466, L467, L1218 |
| Compact | 20px 22px | 18 | 3 | L495, L719 |
| Small side card | 20px | 18 | 13 | L297, L508, L784 |
| Stat card | 18px 20px | 18 | 11 | L777-780 |
| Strip card | 14px 18px | 20 | 3 | L464, L1272 |
| Team view | 28px 30px | 20 | 2 | L155 |
| Personal view, intro | 32px | 20 or 18 | 3 | L90, L114, L1523 |
| Scan, invite | 36px | 20 | 2 | L71, L126 |
| Settings menu | 10px | 18 | 1 | L1102 |
| Hero block | 28px 32px | 20 | 1 | L222 |
| Sample banner | 16px 20px | 18 | 2 | L211, L214 |

The handoff's "22 by 24, 20 by 22 for compact" matches the two most used.

### Inside a card

| Thing | Value | Lines |
|---|---|---|
| Card stack gap | 12 most often, also 14, 16, 10, 8 | L234 (12), L244 (14), L284 (16) |
| Header to first row | `margin-bottom:8px` (list cards) or `6px` (baseline headers) | L261, L269 |
| List row | `padding:11px 0`, gap 12, `border-top:1px solid #f0ebe2` | L264 |
| Compact row | `padding:9px 0` (L280, L475), `8px 0` (L288), settings row `14px 0` with gap 16 (L1111) | |
| Inside a row | 8 (title line, L264), 10 (L269), 12 (row, L264), 14 (grid rows, L157) | |
| Inset box | `padding:10px 12px` (L237, L238, L311) or `12px 14px` (L98, L286) | |

---

## 5. Contrast corrections

Ratios are WCAG 2 contrast, computed from the hex values.

| Pair | Ratio | Where the design does it | Build |
|---|---|---|---|
| `#77736a` on `--bg` `#f1ede6` | 4.05 | Page-header kickers (L325, L408, L660, L774, L1100), "Leave the scan" (L69), the note under the scan card (L84), the results depth note (L414), stat captions on the page | `#55524a` |
| `#77736a` on the top-bar band (92% `--bg` over white, about `#f2eee8`) | 4.09 | Nothing in the horizontal top bar uses it | (none needed) |
| `#77736a` on `--bar` `#e4ddd2` | 3.50 | Sidebar and breadcrumb (L190, L201), not built | `#55524a` if ever used |
| `#77736a` on `--hero` `#e4d9c9` | 3.39 | **Hero date "Monday 5 October" (L223)** | `#55524a` |
| `#77736a` on `--surface-sunk` `#f8f5ef` | **4.34** | "You rate highest" (L98-99), team tiles (L311-314), layer tiles "6 scales" (L286). **Not in the handoff's table** | `#55524a` (proposed) |
| `#77736a` on `--surface-soft` `#f5f1ea` | **4.20** | Source tiles (L469), link-field context. **Not in the handoff's table** | `#55524a` (proposed) |
| `#77736a` on white | 4.72 | Meta text in cards | Keep |
| White on `--accent-strong` `#8a87b3` | 3.39 | The design never puts text on it | Never put text on it |
| `#8a87b3` as an icon colour on white | 3.39 | Standing icons (L480), count icons (L463) | Keep: an icon needs 3:1 and always has a word |
| `#8a87b3` icons on the tile tints | 2.12 to 2.79 | "This week" tile icons (L220) | Decorative beside a label. Use `--ink` if they must carry meaning |
| `--flag` `#d08a12` | 2.74 on `#fff9ef`, 2.87 on white | Only as borders (L1301) | Borders and marks only |
| `--step-current` `#e07049` | 3.19 on white | Only as a dot and a legend line (L1212, L427) | Marks only |
| `#aaa59a` | 2.45 on white | "Not shared" (L860) | `#55524a` |
| White on `--danger` `#c0502e` | 4.74 | Solid danger confirm (L1190) | Keep |
| `--danger` on white | 4.74 | Danger buttons | Keep |

Every avatar, status and evidence pair is at least 6.56:1. Text on `--accent` is 6.99 (`#3a3950`) or
8.75 (`#2b2a3d`).

---

## 6. Components

Each component has a locator, the anatomy, the values, the states, a specimen, and the corrections.

### topbar

**Locator.** Route `home`, seed `S_HOME_TEAM`. Band: `tpl 252`. Pill: `tpl 253`. Text: the pill that holds
"LeaderPact" and "Team plan".

**Anatomy.** A sticky band (L194) holding a centred pill (L195). In the pill, in order: the logo (L197),
the navigation (L198), the plan pill (L204), the settings tray (L205) and the avatar (L206). The
`ui.vertical` branch (L184-192, L200-203) is the sidebar layout. Do not build it.

| Part | Property | Value | Line |
|---|---|---|---|
| Band | element | `div` | L194 |
| | position | `sticky; top:0; z-index:20` | L194 |
| | padding | `14px 32px` | L194 |
| | background | `rgba(241,237,230,.92)`, which is `--bg` at 92% | L194 |
| | backdrop-filter | `blur(10px)` | L194 |
| Pill | max-width, margin | `1240px` (`ui.maxW`), `0 auto` | L195, L1648 |
| | background | `#e4ddd2` | L195 |
| | border | `1px solid #e4ddd2` | L195 |
| | border-radius | `99px` | L195 |
| | padding | `8px 10px 8px 14px` | L195 |
| | layout | `display:flex; align-items:center; gap:14px` | L195 |
| | min-height | `58px`. The tallest child is the 34 px avatar, so with padding and border the content needs 52 px and the min-height sets the height | L195 |
| Navigation | layout | `flex:1; display:flex; gap:2px; justify-content:center` | L198 |
| Settings tray | element | `div`, `display:flex; gap:2px; flex:none` | L205 |
| | background, radius, padding | `#efe9df`, `10px`, `3px` | L205 |
| Settings button | size | `32px` wide, `30px` high | L205 |
| | radius, background, colour | `8px`, `#fff`, `#2b2a3d` | L205 |
| | icon | `lucide:settings` (lucide-react `Settings`), `15px` | L205 |
| | title | "Settings" | L205 |

**Variants and states.**

- The tray holds three buttons in the design (L205): settings, the layout switch (`lucide:panel-left`,
  16 px) and the width switch (`lucide:maximize-2`, 16 px). Section 11 removes the last two. **Build:**
  the tray with the settings button only: 3 + 32 + 3 = 38 px wide, 3 + 30 + 3 = 36 px high.
- The design has no hover style on any top-bar control.
- On the Free plan the horizontal navigation shows **no** Sample marker. Only the sidebar does (L188).
- The navigation in the design has nine items, including "360" (`lucide:radar`, PC L135). Section 11
  removes it. **Build:** Home, Group, People, Assess, Results, Plan, Meetings, Me.
- Phone: see [phone bottom bar](#phone-bottom-bar). The design has no phone layout.

**Specimen.** Logo "LeaderPact" · Home (active) · Group · People · Assess · Results · Plan · Meetings · Me ·
"Team plan" · settings · avatar "KN".

**The public header** (L21-26, routes `landing` to `team`) is a different bar: `max-width:1080px`,
`background:#e4ddd2`, radius 99, `padding:10px 10px 10px 14px`, `gap:24px`, a 26 px logo at 17 px, links
at 14 px `#55524a`, and a `#111111` button with radius 10, `padding:9px 14px`, 14 px/600. Section 11
removes three of its links and renames "Team Scan"; handoff 6.1 gives the menu to build.

### logo

**Locator.** Route `home`, seed `S_HOME_TEAM`. Wrapper `tpl 255`, mark `tpl 256`. Text "LeaderPact" in the
top bar. Public variant: route `landing`, `tpl 10` and `tpl 11`.

| Part | Property | App top bar (L197) | Public header (L22) |
|---|---|---|---|
| Wrapper | layout | `display:flex; align-items:center; gap:10px; flex:none` | the same, without `flex:none` |
| | text | `16px`, `700`, `#111111` (inherited) | `17px`, `700` |
| Mark | size, shape | `24px` circle, `#111111` | `26px` circle |
| | layout | `display:flex; align-items:center; justify-content:center` | the same |
| Dot | size, colour | `9px` circle, `#fff`, centred | `10px` circle |

The wordmark is `PRODUCT_NAME` from `lib/brand.ts`, not a literal. The sidebar logo (L186) is the same as
the top-bar logo. The mark is pure CSS: no icon and no image.

### nav-item

**Locator.** Route `home`, seed `S_HOME_TEAM`. `tpl 260`. **Active:** `nth 0` ("Home"). **Inactive:**
`nth 1` ("Group").

| Property | Value | Line |
|---|---|---|
| element | `div` with a click handler. **Build:** `a` | L198 |
| layout | `display:flex; align-items:center; gap:5px; white-space:nowrap` | L198 |
| padding | `7px 8px` | L198 |
| border-radius | `10px` | L198 |
| font | Figtree `12.5px`, `600` | L198 |
| icon | `16px`, from the item (below) | L198 |
| active | background `#111111`, text `#ffffff` (theme `nav.on`) | L1641 |
| inactive | background `transparent`, text **`#2b2a26`** (theme `nav.off`, B2) | L1641 |
| hover | none in the design | |

Icons (PC L127-137): Home `lucide:house` (`House`), Group `lucide:users` (`Users`), People
`lucide:contact` (`Contact`), Assess `lucide:calendar-check` (`CalendarCheck`), Results
`lucide:trending-up` (`TrendingUp`), Plan `lucide:kanban` (`Kanban`), Meetings `lucide:calendar-clock`
(`CalendarClock`), Me `lucide:user` (`User`). The 360 item is removed.

Plan's route in the prototype is `develop` (PC L133).

**Contrast.** `#2b2a26` on `#e4ddd2` is 10.65. White on ink is 18.88.

### plan-pill

**Locator.** Route `home`, seed `S_HOME_TEAM`. `tpl 269`. Text "Team plan". With `S_HOME_FREE` it reads
"Free plan".

| Property | Value | Line |
|---|---|---|
| element | `span`, click goes to Settings › Plan and billing (`go.plan`, PC L1490). **Build:** `a` | L204 |
| title | "Plan and billing" | L204 |
| font | `11.5px`, **`700`** | L204 |
| background, colour | `#cccbdc`, `#3a3950` | L204 |
| radius, padding | `99px`, `4px 10px` | L204 |
| white-space | `nowrap` | L204 |
| content | "Free plan" or "Team plan" (`planLabel`, PC L1489) | |

The handoff's Pill row says 600. The plan pill is 700 in the design. Contrast 6.99.

### avatar

**Locator.** Route `home`, seed `S_HOME_TEAM`. `tpl 278`. Text "KN".

| Property | Value | Line |
|---|---|---|
| element | `div` with `title="{{ me.name }} · {{ roleLabel }}"` ("Kari Nordmann · Leader") | L206 |
| size | `34px` square, `border-radius:50%`, `flex:none` | L206 |
| layout | `display:flex; align-items:center; justify-content:center` | L206 |
| font | `12px`, `700` | L206 |
| colours | the person's avatar pair (section 1) | L1645 |

**Sizes elsewhere** (diameter / font): 22 / 9 (L797, L1327), 24 / 9.5 (agenda item, L1286), 26 / 10 (L337),
28 / 10 (L1237), 30 / 11 (L678), 32 / 11 (L355), **34 / 11.5 in the Group › Members list (L386)**, 34 / 12
(top bar, sidebar), 36 / 11 overlapped with `border:2.5px solid #fff; margin-right:-6px` (Home team strip,
L309), 44 / 14 (People roster, L785), 52 / 16 (Settings › Account, L1109), 68 / 22 (person header, L807).

**How the design picks a pair.** It does not hash. Each seeded member carries a fixed `tone` from 0 to 7, in
seed order (PC L31-38: Kari 0, Ola 1, Ingrid 2, Lars 3, Sofie 4, Erik 5, Maja 6, Henrik 7). The pair is
`avatars[tone % 8]` (PC L625). The signed-in person's top-bar avatar is chosen by **role**: leader 0,
member 3, coach 5 (PC L632). That happens to match Kari, Lars and Anne Vik. An unknown person gets
`#e2dbcf` / `#555` and "?" (PC L627). **Build:** the handoff's stable hash of the person into the 8 pairs.
The fixture can seed Kari to pair 0 so screenshots match.

**Specimen.** "KN" on `#ffe2cf` / `#7a3a12` (6.98:1).

### hero-block

**Locator.** Route `home`, seed `S_HOME_TEAM` (or `S_HOME_FREE`). `tpl 307`. Text "Good morning, Kari."
Text column `tpl 308`. The right-hand button, `tpl 312` ("Assessment schedule"), is removed by section 11;
exclude it from a comparison.

| Part | Property | Value | Line |
|---|---|---|---|
| Block | radius | `20px` | L222 |
| | background | `#e4d9c9` | L222 |
| | border | `1px solid #e4ddd2` | L222 |
| | padding | `28px 32px` | L222 |
| | layout | `display:flex; align-items:flex-end; justify-content:space-between; gap:20px` | L222 |
| Text column | layout | `display:flex; flex-direction:column; gap:6px` | L223 |
| Date | font, colour | `13px`, 400, `#77736a`. **Build:** `#55524a` (3.39 fails) | L223 |
| Greeting | element | `h1`, `margin:0` | L223 |
| | font | Poppins `34px`, `500`, `-0.03em`, line-height normal | L223 |
| Status line | font, colour | `15px`, 400, `#46433c` | L223 |
| Action (removed) | values, for reference | `#111111`, white, radius 12, `padding:11px 16px`, 14px/600, gap 8, icon `lucide:calendar-check` | L224 |

**Variants.** On the Team plan the Home page shows the "This week" row above the hero (L220); on Free it
does not. The hero itself is the same on both plans.

**Specimen.** Date "Monday 5 October" (hard-coded in the design at L223; build the real date in
`en-GB`). Greeting "Good morning, Kari." (PC L832 plus the literal "." at L223). Status line "4 things need
you · 1 open for answers · next up: Round 3, 1 Mar" (PC L1222 with `S_HOME_TEAM`).

**Build.** No button in the MVP (section 11). The block still aligns its text to the bottom.

### card

**Locator.** Route `home`, seed `S_HOME_TEAM`. `tpl 401`: the "Needs you" card. Another plain card:
`tpl 422` ("Open for answers").

| Property | Value | Line |
|---|---|---|
| element | `div` | L260 |
| background | `#ffffff` | L260 |
| border | `1px solid #ffffff`. The white border makes the card a flat shape on cream | L260 |
| border-radius | `18px` | L260 |
| padding | `22px 24px` | L260 |
| layout | `display:flex; flex-direction:column`, with a `gap` per card (12 most often) | L260 |
| shadow | none | |

**Variants.**

| Variant | Values | Lines |
|---|---|---|
| Large | radius `20px`, padding `28px 30px` (team view) or `32px`/`36px` (personal view, scan) | L155, L90, L71 |
| Compact | radius `20px`, padding `20px 22px` (Results, Meetings) | L466, L467 |
| Small | radius `16px`, padding `16px`, gap 4 | L162-163 |
| Ink | background `#111111`, text white, radius `18px`, padding `22px 24px`, gap 12, no border | L250 |
| Selectable, off | background `#ffffff`, border `#ebe5da` (theme `card.off`), border 1.5px on the agenda list | L1643, L1283 |
| Selectable, on | background `#f8f5ef`, border `#111111` (theme `card.on`) | L1643 |
| Flagged | background `#fff9ef`, border `1.5px #d08a12`; dashed while incomplete | PC L759-760, L1283 |
| Inset box | background `#f8f5ef`, `1px solid #ece6dc`, radius `12px`, padding `12px 14px` | L98 |
| Empty slot | `1.5px dashed #cfc6b6`, radius `18px`, padding `20px`, centred, min-height 200 | L305 |
| Hover | the design styles a card hover only on the People roster: `border-color:#cfc6b6` | L784 |

### section-header

**Locator.** Route `home`, seed `S_HOME_TEAM`. `tpl 402`. Text "Needs you". Title `tpl 403`, count `tpl 404`,
meta `tpl 406`.

| Part | Property | Value | Line |
|---|---|---|---|
| Row | layout | `display:flex; align-items:center; gap:10px; margin-bottom:8px` | L261 |
| Title | font | `18px`, `700`, no tracking | L261 |
| Count pill | font | `12px`, `700` | L261 |
| | colours | background `#111111`, text `#fff` | L261 |
| | radius, padding | `99px`, `2px 9px` | L261 |
| Spacer | | `div` with `flex:1` | L261 |
| Meta | font, colour | `12.5px`, 400, `#77736a` (on white, 4.72) | L261 |

**Variants.**

- Baseline header: `display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px`,
  title and meta only (L269 "Open for answers" · "Counts only, never names").
- Header with a link instead of meta: `12.5px`, `600`, `#3a3950`, for example "Schedule →" (L279).
- Large title: `21px`, `700`, `-0.02em` with the meta `12.5px #77736a` and a right count `12px #77736a`
  (L472).
- Title with a meta line under it: column `gap:3px`, title 18/700, meta `13px #77736a` (L1108).

**Specimen.** "Needs you" · count "4" · meta "Assessments, your actions and leader tasks" (L261).

### list-row

**Locator.** Route `home`, seed `S_HOME_TEAM`. `tpl 412`, `nth 0`. Text "Answer pulse 6". Free plan rows:
`tpl 323` with `S_HOME_FREE`, but their content is removed (see the specimen).

| Part | Property | Value | Line |
|---|---|---|---|
| Row | layout | `display:flex; align-items:center; gap:12px` | L264 |
| | padding | `11px 0` | L264 |
| | divider | `border-top:1px solid #f0ebe2`, on every row including the first | L264 |
| Icon tile | | see [icon-tile](#icon-tile): 36 px, radius 11, `#cccbdc`, icon 17 px | L264 |
| Text column | layout | `flex:1; min-width:0; display:flex; flex-direction:column; gap:3px` | L264 |
| Title line | layout | `display:flex; align-items:center; gap:8px` | L264 |
| Kind chip | font | `10.5px`, `700`, `white-space:nowrap` | L264 |
| | radius, padding | `5px`, `2px 6px` | L264 |
| | colours | by kind (below) | PC L1185 |
| Title | font | `14px`, `700` | L264 |
| Meta | font, colour | `12px`, 400, `#77736a` | L264 |
| Action | | the small primary button: `#111111`, white, radius `10px`, `padding:8px 13px`, `12.5px`, `700`, `white-space:nowrap` | L264 |

Kind chip colours (PC L1185 for Team, PC L1217 for Free): "Leader" uses evidence moderate
(`#f6f1e3`/`#6b5208`); "Your action" and "Profile" use evidence other (`#f1eff5`/`#55524a`); anything
else ("Assessment", "Scan") uses evidence strong (`#ebe5fb`/`#2b2a3d`).

**Empty state** (L262): `display:flex; align-items:center; gap:12px; padding:22px 0;` the same top border,
icon `lucide:party-popper` 22 px `#111111`, text "You are all caught up." 14px/600.

**Specimen.** Icon `lucide:activity` (`Activity`), kind "Assessment" (strong pair), title "Answer pulse 6",
meta "Closes Wednesday · 9 items · about 2 min", action "Answer now" (PC L1053 with `S_HOME_TEAM`).

**Do not use** the Free rows as a specimen: they say "Team Scan", "3 more answers needed" and "24 scales"
(PC L1212-1216), all removed by section 11.

### icon-tile

**Locator.** Route `home`, seed `S_HOME_TEAM`. `tpl 413`, `nth 0`.

| Property | Value | Line |
|---|---|---|
| size | `36px` square, `flex:none` | L264 |
| border-radius | `11px` | L264 |
| background, colour | `#cccbdc`, `#111111` | L264 |
| layout | `display:flex; align-items:center; justify-content:center` | L264 |
| icon | `17px` | L264 |

**Variants.** 32 px, radius 11, icon 17 (Open for answers, L272). 36 px, radius **12**, icon **18** (Assess
rounds L887, library L938, questionnaire header L1515). 34 px, radius 12, icon 18 (L912, L1001). 44 px,
radius 12, icon 18 (L942). The handoff's "36 px, radius 11" is the Home variant.

Numbered tiles use the same fill with text: 28 px, radius 9, `#2b2a3d`, 12/700 (agenda, L1284); 22 px,
radius 7, 11/700 (sections, L1533).

### button

**Locators.** Route `settings`, seed `S_SETTINGS` (Account tab).

- **button-primary:** `tpl 2265`, "Save changes".
- **button-secondary:** `tpl 2262`, "Sign out everywhere".
- **button-danger:** `tpl 2264`, "Delete account".
- **button-small:** route `home`, seed `S_HOME_TEAM`, `tpl 420`, `nth 0`, "Answer now".
- Large: route `scan`, seed `S_SCAN`: `tpl 106` "Next", `tpl 105` "Back".

Every button in the design is a `div` with a click handler. **Build:** `button`, or `a` for navigation.

**Sizes, measured.** The design has no single button size. These are the clusters, with use counts.

| Size | Radius | Padding | Font | Uses | Lines |
|---|---|---|---|---|---|
| Large | `12px` | primary `12px 22px`, secondary `12px 18px` (also `12px 20px`, `11px 16px`, landing `14px 22px` at 15 px) | `14px`; 600 (scan), 700 (team view) | 8 | L80, L81, L176, L224, L1313, L1470, L38 |
| Large, questionnaire | `11px` | primary `11px 20px`, secondary `11px 18px` | `14px`; primary 700, secondary 600 | 4 | L1558, L1571 |
| **Default** | **`11px`** | **`10px 16px`** or `10px 15px` | **`13.5px`**; primary **700**, secondary 600 | 19 primary, 30 secondary | L1113, L1114, L417, L536 |
| Compact | `10px` | `9px 15px` | `13.5px`, 600 | 7 primary, 14 secondary | L464, L466 |
| **Small** | **`10px`** | **`8px 13px`** | **`12.5px`, `700`** | 2 primary | L231, L264 |
| Extra small | `9px` | `6px 12px` | `12.5px`, `700` | 2 | L274 ("Answer") |

The handoff's "Button radius 12 px, 10 px for small" fits the large and small sizes. The default size,
used most, is radius 11. **Conflict**, see section 7.

**Variants (default size).**

| Variant | Background | Text | Border | Weight | Line |
|---|---|---|---|---|---|
| Primary | `#111111` | `#fff` | none | 700 | L1114 |
| Secondary | `#fff` | `#111111` (inherited) | `1px solid #ddd5c8` | 600 | L1113 |
| Danger | `#fff` | `#c0502e` | `1px solid #f0c9d2` | 600 | L1114 |
| Danger, solid (confirm only) | `#c0502e` | `#fff` | none | 700 | L1190 |
| White on ink | `#fff` | `#2b2a3d` | none | 700, radius `10px`, `padding:9px 16px` | L211, L253 |
| Accent, selected | `#cccbdc` | `#2b2a3d` | none | 700, icon `lucide:target` | L538 |

Every default button sets `white-space:nowrap`. A button with an icon uses `display:flex;
align-items:center; gap:6px` (L1277, L1278) or `gap:8px` with a trailing `lucide:arrow-right` (L81).
Several secondary buttons omit `background:#fff` (L80, L151); they sit on white, so build them white.

**States.**

| State | Values | Lines |
|---|---|---|
| Disabled, primary | `opacity:.45` (scan Next before an answer, save before a valid email) | L81 with PC L648, L110 |
| Disabled, first step | `opacity:.35` (Back on question 1) | L80 with PC L648 |
| Locked | `opacity:.5` or `.55`, a leading `lucide:lock` icon, `title` gives the reason, no click | L412, L539 |
| Hover, focus | not styled in the design. **Build:** the 2 px ink focus ring (L15) | |

**Specimens.** "Save changes" (primary), "Sign out everywhere" (secondary), "Delete account" (danger), "Answer
now" (small). "Back" and "Next" (large).

### pill

**Locator.** Accent pill: route `scan`, seed `S_SCAN`, `tpl 98`, "Purpose and priorities". Other variants:
count pill `tpl 404` (`S_HOME_TEAM`), status pill `tpl 1488` (`S_PEOPLE`), phase pill `tpl 710`
(`S_RESULTS`, "Released"), large accent `tpl 186` (`S_TEAM_VIEW`, "6 of 8 answered").

All pills: `border-radius:99px`, `white-space` as noted, no border.

| Variant | Background | Text | Size / weight | Padding | Lines | Example |
|---|---|---|---|---|---|---|
| **Accent** (base) | `#cccbdc` | `#3a3950` | `12px` / `600` | `4px 10px` | L72, L91 | "Purpose and priorities", "One person's view" |
| Accent, small | `#cccbdc` | `#3a3950` | `11.5px` / `600` | `4px 10px` | L47 | "6 of 8 answered" |
| Accent, large | `#cccbdc` | `#3a3950` | `13px` / `600` | `6px 12px` | L149 | "6 of 8 answered" |
| Accent, strong | `#cccbdc` | `#2b2a3d` | `11.5px` / `700` | `4px 10px` | L417, L887 | "Released" |
| Plan | `#cccbdc` | `#3a3950` | `11.5px` / `700` | `4px 10px` | L204 | "Team plan" |
| Ink, count | `#111111` | `#fff` | `12px` / `700` | `2px 9px` | L229, L261 | "4" |
| Ink, status | `#111111` | `#fff` | `12px` / `700` | `4px 10px` | L347 | "v3 in force" |
| Active | `#e6f5e9` | `#22603a` | `11.5px` / `700` | `4px 9px` | L785 | "Active" |
| Pending | `#fff1c9` | `#6b5208` | `11.5px` / `700` | `4px 9px` | L785 | "Invited" |
| Neutral | `#efe9df` | `#111111` | `11.5px` / `700` | `3px 9px` | L1067 | (its content is a removed feature) |
| Filter chip, off | `#ffffff` | `#36342f` | `12.5px` / `600`, border `1px #e2dbcf` | `6px 12px` | L496 with theme `chip.off` | "Conditions 6" |
| Filter chip, on | `#111111` | `#ffffff` | the same, border `#111111` | `6px 12px` | theme `chip.on` | |

Small square chips use radius 5 or 6, not 99: kind chip (L264), evidence chip, SAMPLE chip, YOU chip
(`#111111`/white, 10/700, radius 5, `1px 6px`, L785), agenda type chip (`#efe9df`/`#46433c`, 11/700,
radius 6, `2px 7px`, L1285).

The handoff's "11.5 to 12 px, 600, padding 4 by 10" is the accent pill. Status, plan and count pills are
700.

### tabs

**Locators.**

- Group: route `group`, seed `S_GROUP_TEAM`. Strip `tpl 575`. Tab `tpl 577`: `nth 0` "Charter" (on),
  `nth 1` "Members" (off).
- Plan: route `develop`, seed `S_PLAN`. Strip `tpl 1252`, tab `tpl 1254`: `nth 1` "Focus areas and
  actions" (on).
- Results, round switch: route `results`, seed `S_RESULTS`. Strip `tpl 693`, tab `tpl 695`.
- Results, depth pills: the same seed. Row `tpl 701`, pill `tpl 703`.
- Settings menu: route `settings`, seed `S_SETTINGS`. Card `tpl 2222`, item `tpl 2224`: `nth 0`
  "Account" (on).

**Segmented strip** (Group L327, Plan L662, People L774, Meetings L1212, Results rounds L410).

| Part | Property | Value | Line |
|---|---|---|---|
| Strip | layout | `display:flex; gap:4px` | L327 |
| | background, border | `#fff`, `1px solid #e4ddd2` | L327 |
| | radius, padding | `12px`, `4px` | L327 |
| Tab | padding | `8px 16px` (Results rounds: `8px 14px` at `13px`) | L327, L410 |
| | radius | `9px` | L327 |
| | font | `13.5px`, `600` | L327 |
| | on | background `#111111`, text `#ffffff` (theme `tab.on`) | L1640 |
| | off | background `transparent`, text `#55524a` (theme `tab.off`) | L1640 |
| | live dot (Meetings) | `7px` circle `#e07049` before the label, `gap:6px` | L1212 |

The strip sits at the right of the page-header row (`flex:1` spacer, L326).

**Depth pills** (Results, L414): row `display:flex; align-items:center; gap:8px; font-size:13px`; pill
`padding:6px 12px; border-radius:99px; font-weight:600`, on and off as the tab theme. The pills sit on the
page background (off text `#55524a` on `#f1ede6`, 6.69). The note after them is `#77736a` on the page:
**Build** `#55524a`. Labels in the design: Standing, All scales and items, Overview, Scale, Items. The
handoff keeps three depths: Overview, Scale, Items (6.12).

**Settings menu** (L1102-1103). Not a strip: a vertical list in a card.

| Part | Property | Value | Line |
|---|---|---|---|
| Card | | white, radius `18px`, `padding:10px`, `gap:2px`, `position:sticky; top:96px`, in a `240px` grid column with `gap:24px` | L1101-1102 |
| Item | layout | `display:flex; align-items:center; gap:10px` | L1103 |
| | padding, radius | `10px 12px`, `10px` | L1103 |
| | font | `14px`, `600` | L1103 |
| | icon | `17px` | L1103 |
| | on | `#111111` / `#ffffff` (theme **`nav.on`**, PC L1251) | L1641 |
| | off | `transparent` / **`#2b2a26`** (theme `nav.off`) | L1641 |

Icons (PC L1226): Account `lucide:user`, Group `lucide:users`, Notifications `lucide:bell`, Privacy and
data `lucide:shield`, Plan and billing `lucide:credit-card`. The design's sixth tab, Appearance
(`lucide:layout-panel-left`), is removed by section 11. **Conflict:** the handoff groups Settings with the
other tabs and gives off text `--text-2`. The design uses the nav colours here.

**Specimen.** "Charter" (on) · "Members" (off).

### option-row

**Locator.** Route `scan`, seed `S_SCAN` (question 1 answered "Agree"). `tpl 102`. **option-row-on:**
`nth 3` "Agree". **option-row-off:** `nth 0` "Strongly disagree". Number circle: `tpl 103`.

| Part | Property | Value | Line |
|---|---|---|---|
| List | layout | `display:flex; flex-direction:column; gap:8px` | L74 |
| Row | element | `div` with a click handler. **Build:** a radio in a group with a label | L76 |
| | min-height | `52px` | L76 |
| | layout | `display:flex; align-items:center; gap:14px` | L76 |
| | padding | `0 16px` | L76 |
| | radius | `14px` | L76 |
| | border | `1.5px solid` (colour by state) | L76 |
| | font | `15px`, `500` | L76 |
| Number circle | size | `26px` circle | L76 |
| | border | `1.5px solid`, the same colour as the row border | L76 |
| | font | `12px`, `700` | L76 |
| | layout | centred. It has no `flex:none`; **build** it with `flex:none` so a long label cannot squeeze it | L76 |

| State | Background | Text | Border, row and circle | Source |
|---|---|---|---|---|
| Off | `#ffffff` | `#111111` | `#e2dbcf` | theme `opt.off`, L1639 |
| On | `#cccbdc` | `#111111` | `#111111` | theme `opt.on`, L1639 |
| Hover, disabled | not styled in the design | | | |

Labels (PC L25): 1 Strongly disagree, 2 Disagree, 3 Neither agree nor disagree, 4 Agree, 5 Strongly agree.
Handoff Appendix C gives the same five.

**The diagnostic runner** in the design uses a different control: five tiles in a row,
`min-height:88px`, the number at 19/700 above the label at 12/600 line-height 1.3, radius 14, border 1.5
(L1554), in a 1160 px layout. **Build:** the handoff overrides it. Every questionnaire uses this option row
in a 640 px column (handoff section 4, Questionnaires).

**Specimen.** The question "We agree on what this leadership team is for." (Appendix C item 1, which is
also the design's text), with "Agree" selected.

### progress-bar

**Locator.** Route `scan`, seed `S_SCAN`. Track `tpl 95`, fill `tpl 96`.

| Part | Property | Value | Line |
|---|---|---|---|
| Header row | layout | `display:flex; justify-content:space-between; align-items:center` | L69 |
| | font | `13px`, `#77736a`. **Build:** `#55524a`, since it sits on `--bg` | L69 |
| | left | "Leave the scan", with `lucide:x` (`X`), `gap:6px` | L69 |
| | right | "1 of 12", `600`, `#111111` | L69 |
| Track | size | full width, `height:6px` | L70 |
| | colour, radius | `#e2dbcf`, `99px`, `overflow:hidden` | L70 |
| Fill | size | `height:100%`, width the share | L70 |
| | colour, radius | `#111111`, `99px` | L70 |

**Value.** `(index + (current answered ? 1 : 0)) / 12` (PC L645). It counts the current question as done
once it has an answer: question 1 answered shows 8.3%. The counter text gives the position, not the
answered count.

**Variants.** The questionnaire header bar: `180px` wide, `6px`, track **`#ece6dc`**, fill `#111111` with no
radius of its own (the track clips it), followed by "N of M" at 12.5/600 `#55524a`, gap 10 (L1518). The
section bars: one 6 px segment per section, `flex-grow` by item count, track `#e2dbcf`, gap 4 (L1546). The
handoff's ProgressBar (6 px, track `--border`, fill `--ink`) is the scan bar.

**Specimen.** "1 of 12", fill 8.3%.

### level-bar

**Locators.**

- Team view: route `team`, seed `S_TEAM_VIEW`. Row `tpl 196`, `nth 0` ("Purpose and priorities · 3.9 ·
  High agreement"). Track `tpl 198`, fill `tpl 199`.
- Results, with a round-1 tick: route `results`, seed `S_RESULTS`. Bar `tpl 873`, `nth 0` (Clear purpose).
- Landing sample (8 px): route `landing`, `tpl 45` (row), `tpl 47` (track).

| Part | Property | Value | Line |
|---|---|---|---|
| Row | layout | `display:grid; grid-template-columns:180px 1fr 34px 130px; align-items:center; gap:14px` | L157 |
| | font | `13.5px` | L157 |
| Label | font | `600` | L157 |
| Track | height | **`9px`** | L157 |
| | colour, radius | `#ece6dc`, `99px`, `position:relative` | L157 |
| Fill | | `position:absolute; left:0; top:0; bottom:0; border-radius:99px; background:#8a87b3` | L157 |
| | width | `(level − 1) ÷ 4`, clamped to 1..5 (PC L256) | |
| Level | font | `700`, `text-align:right`, in the 34 px column | L157 |
| Agreement | font, colour | 400, `#77736a`, in the 130 px column (4.72 on white) | L157 |
| Rows | gap | `16px` in the team-view card (L155); `12px` on Home (L244) | |

**Heights in the design.**

| Height | Where | Lines |
|---|---|---|
| 9 px | Team view, personal view, Home "Where we stand" | L157, L95, L246 |
| 8 px | Landing sample card (columns 150 / 1fr / 30 / 110, gap 12, 12.5 px); Results rows | L48, L478, L502 |
| 7 px | Outcome cards | L491 |
| 12 px | Scale detail | L532 |

**Conflict.** The handoff says 8 px, but its own reference, the team view, measures 9 px. See section 7.

**Round-1 tick** (Results, L478): `position:absolute; top:-4px; bottom:-4px; width:2px; background:#111111;
left:<round-1 level>`. It shows the previous level. It is not "a mark per member", so section 7 of the
handoff does not forbid it, but the handoff does not ask for it either.

**Value.** The design sizes the team-view fill from the unrounded mean (PC L680: `pct(m)`), so "3.9"
draws at 72.9%. **Build:** from the stored level at one decimal, so 3.9 draws at 72.5%.

**Agreement labels** (PC L100): "High agreement", "Medium agreement", "Views differ".

**Specimen.** "Purpose and priorities", 3.9, "High agreement". (Agreement is a label only. Never show the
number.)

### count-dots

**Locator.** Route `home`, seed `S_HOME_FREE`. Dot row `tpl 341`, dot `tpl 343`. Invite variant: route
`invite`, seed `S_INVITE`, `tpl 166` and `tpl 168`.

| Part | Property | Value | Line |
|---|---|---|---|
| Dot row | layout | `display:flex; gap:4px; flex-wrap:wrap; max-width:170px; justify-content:flex-end` | L236 |
| Dot | size | `16px` square | L236 |
| | radius | `5px` | L236 |
| | on | `#111111` (theme `dotOn`) | L1649 |
| | off | `#e2dbcf` (theme `dotOff`) | L1649 |
| Count, beside it | number | `40px`, `700`, `-0.03em`, line-height 1: "1" | L236 |
| | total | `18px`, `#77736a`: " / 8" | L236 |
| | caption | `12.5px`, `#55524a`: "answered · you: 0 of 12" | L236 |
| Group | layout | `display:flex; align-items:flex-end; justify-content:space-between; gap:12px` | L236 |

One dot per seat (the member count), filled in order (PC L1219). The dots never mark who: the first n are
on.

**Invite variant** (L134): dots `22px`, radius `7px`, `gap:5px`, `max-width:260px`; count "1 of 8" at
52/700/-0.03em, caption "have answered. Counts only, never names." at 13.5 `#77736a` (L133).

**Specimen.** 8 seats, 1 on, with "1 / 8 answered". Always with the count in words.

### hint-box

**Locator.** Route `home`, seed `S_HOME_FREE`, `tpl 345` (compact). Route `invite`, seed `S_INVITE`,
`tpl 170` (large).

| Variant | Values | Line |
|---|---|---|
| Compact | `background:#f8f5ef; border:1px dashed #cfc6b6; border-radius:12px; padding:10px 12px; font-size:12.5px; font-weight:600`, text `#111111` | L237 |
| Large | `display:flex; align-items:center; gap:12px; background:#f8f5ef; border:1px dashed #cfc6b6; border-radius:14px; padding:16px 18px`; icon `lucide:hourglass` (`Hourglass`) `20px #111111`; a column with `gap:2px`: title `14.5px 700`, body `13px #55524a` | L137 |

**Conflict.** The handoff says radius 12. The compact box is 12; the large box is 14.

**Content.** Every design text in these boxes is removed by section 11 ("… The team view opens for everyone
at 4.", L237; "… Reminders go only to people who have not answered.", L137). **Specimen:** the
replacement wording from section 11, "The team view opens when the scan closes.", in the compact box.

### warning-box

**Locator.** Route `meetings`, seed `S_AGENDA_FLAG` (the agenda, item 5 "Office move" selected, which
matches no team task). Box `tpl 2881`. Action `tpl 2886`.

| Part | Property | Value | Line |
|---|---|---|---|
| Box | layout | `display:flex; gap:10px; align-items:flex-start` | L1301 |
| | background | `#fff9ef` | L1301 |
| | border | `1.5px solid #d08a12` | L1301 |
| | radius, padding | `12px`, `12px` | L1301 |
| | font | `13px`, line-height `1.45` | L1301 |
| Icon | | `lucide:triangle-alert` (`TriangleAlert`), `17px`, `#a86c05`, `flex:none` | L1301 |
| Body | layout | `flex:1; display:flex; flex-direction:column; gap:8px` | L1301 |
| | text colour | **inherited `#111111`** | L1301 |
| Action | | `span`, `align-self:flex-start`, `700`, `#7a4e03`, `border:1px solid #d08a12`, radius `8px`, `padding:5px 10px`, 13px inherited | L1301 |

The action shows only when the leader may confirm (PC L774: `canConfirm`).

**Conflict.** The handoff says "text `--flag-ink`". In the design only the action is `#7a4e03`; the
sentence is ink. Both pass (`#111111` 18.03, `#7a4e03` 6.87 on `#fff9ef`). The icon colour `#a86c05` is in
no token list (4.17, fine for an icon).

**Related, flagged agenda card** (L1283 with PC L759-760): `background:#fff9ef; border:1.5px solid
#d08a12` (dashed while the item is incomplete), radius 16, `padding:14px 16px`, with the state "Matches no
team task" at 11.5/700 `#55524a` (L1286).

**Soft variant, questionnaire review** (L1569): `display:flex; align-items:center; gap:10px;
background:#fff9ef; border:1px solid #f0d7a5; border-radius:12px; padding:12px 14px; font-size:13.5px`,
icon `lucide:triangle-alert` `#b7790b`, text ink, action "Go to the first" 700 `#3a3950`. It fits handoff
6.11 (the review lists unanswered questions). `#f0d7a5` and `#b7790b` are in no token list.

**Specimen.** "This item matches no team task. Does it need the whole group?" with the action "Keep it on
the agenda" (L1301). Use the handoff's name, task match, not "Fit check" (L1272), in surrounding copy.

### sample-banner

**Locators.** Leader: route `group`, seed `S_GROUP_FREE_LEADER`, `tpl 281` (chip `tpl 282`, Upgrade
`tpl 284`). Member: seed `S_GROUP_FREE_MEMBER`, `tpl 286` (chip `tpl 287`).

| Part | Property | Leader (L211) | Member (L214) |
|---|---|---|---|
| Banner | background | `#111111` | `#fff` |
| | border | none | `1px solid #e2dbcf` |
| | text colour | `#fff` | `#111111` (inherited) |
| | radius, padding | `18px`, `16px 20px` | `18px`, `16px 20px` |
| | layout | `display:flex; align-items:center; gap:16px` | the same |
| SAMPLE chip | font | `11px`, `700`, `letter-spacing:.06em` | the same |
| | colours | background `#fff`, text `#2b2a3d` | background `#111111`, text `#fff` |
| | radius, padding | `6px`, `3px 8px` | the same |
| Text | font | `14px`, `flex:1` | `14px` (no `flex:1`) |
| Upgrade | | `background:#fff; color:#2b2a3d; border-radius:10px; padding:9px 16px; font-weight:700; font-size:13.5px` | none |

It shows on Free for the paid areas: group, people, assess, results, plan (`develop`), meetings
(PC L633-637).

**Specimen.** Leader: "SAMPLE" · "This page shows sample content. The Team plan unlocks it for your group:
$1,800 per group per year." · "Upgrade". The price is the handoff's test price (handoff section 1, Plans):
hold it as data, not as a literal. Member: "SAMPLE" · "This page shows sample content. Ask your team leader
to upgrade to the Team plan." No price.

### evidence-chip

**Locator.** Route `results`, seed `S_RESULTS` (the Standing view). `tpl 872`: `nth 0` "Strong" (Clear
purpose), `nth 1` "Moderate" (Team tasks), `nth 2` "Mixed" (Size and membership, the "other" pair).
Overview table: seed `S_RESULTS_OVERVIEW`, `tpl 921`.

| Property | Value | Line |
|---|---|---|
| element | `span`, `justify-self:start` in a grid cell | L501 |
| font | `11px`, **`700`** (the Standing table uses `600`, L477) | L501 |
| radius, padding | `6px`, `3px 7px` | L501 |
| strong | `#ebe5fb` / `#2b2a3d` (11.41) | L1647 |
| moderate | `#f6f1e3` / `#6b5208` (6.56) | L1647 |
| other | `#f1eff5` / `#55524a` (6.84) | L1647 |

Mapping (PC L697): "Strong" uses strong, "Moderate" uses moderate, anything else ("Mixed", "Not yet rated")
uses other. Handoff 7 says "Not yet rated" is *treated as* moderate for the guidance tone; the chip in the
design still uses the other pair.

Long form (scale view, L528): the text "Evidence · Strong", `padding:3px 8px`, 700.

The label comes from the data. Appendix A calls the third rating "Mixed or weak"; the design prints
"Mixed".

**Specimen.** "Strong", "Moderate", "Mixed or weak".

### standing-label

**Locator.** Route `results`, seed `S_RESULTS`. `tpl 879`, by text: `nth 0` "Strength" (Clear purpose),
`nth 2` "Fact, no target", `nth 4` "Views differ" (Rewards), `nth 5` "Keep watching". Icon `tpl 880`.

| Property | Value | Line |
|---|---|---|
| element | `span` | L480 |
| layout | `display:flex; align-items:center; gap:6px` | L480 |
| font | `12.5px`, `600`, text `#111111` (inherited) | L480 |
| icon | `15px`, `#8a87b3` (3.39 on white, an icon beside a word) | L480 |

| Standing (PC L1288) | Icon | lucide-react |
|---|---|---|
| Strength | `lucide:check` | `Check` |
| Keep watching | `lucide:eye` | `Eye` |
| Priority | `lucide:flag` | `Flag` |
| Views differ | `lucide:split` | `Split` |
| Fact, no target | `lucide:info` | `Info` |
| Read with relationship conflict | `lucide:link` | `Link` |

The word always shows. Colour never carries the standing alone: every standing has the same icon colour.

**Rule drift, not visual.** The design applies "Views differ" before "Read with relationship conflict" and
lets a "Mixed" scale escape Priority (PC L1288). Handoff section 7 orders descriptive, then task conflict,
then low agreement, then the table. Build the handoff's order.

**Specimen.** "Strength" with `Check`.

### toast

**Locator.** Route `settings`, seed `S_SETTINGS`. Click `tpl 2265` ("Save changes"), then capture
`tpl 3483` within 3.8 s. Text "Account saved" (PC L564). On `S_HOME_FREE`, the "Copy" button gives "Invite
link copied" (PC L423).

| Property | Value | Line |
|---|---|---|
| position | `fixed; left:50%; transform:translateX(-50%); bottom:24px; z-index:70` | L1612 |
| background, colour | `#111111`, `#fff` | L1612 |
| radius, padding | `12px`, `12px 16px` | L1612 |
| font | `13.5px`, `500` | L1612 |
| layout | `display:flex; align-items:center; gap:10px` | L1612 |
| shadow | `0 20px 40px -20px rgba(0,0,0,.6)` | L1612 |
| icon | `lucide:check-circle-2` (lucide-react `CircleCheck`, formerly `CheckCircle2`), `#b5b3cf`, 13.5 px (inherited) | L1612 |
| lifetime | 3,800 ms, one at a time | PC L393 |

**Variants.** The design has one toast. It has no error style and uses the check icon for every message,
including refusals ("Pick at most 2", PC L600). **Build:** an error variant is not in the design. Use the
same shape with an error icon, and log it as an assumption. Announce it with `role="status"`.

**Specimen.** "Invite link copied".

### phone bottom bar

**The design has none.** No `@media` rule, no phone hint and no bottom bar in the design or in PC; the root
is `min-width:1280px` (L17). The only `@media` in `support.js` is a print rule (support.js L119). The
fixed elements are the questionnaire overlay (L1513), two dialogs (L1589, L1601), the toast (L1612) and the
prototype control (L1615).

The bar is specified only by the handoff (section 4, Layout: below 768 px, Home, Group, Meetings, Plan and
More). Proposal, not a measurement: reuse the nav-item tokens (12.5/600, icon 16, active ink fill, radius
10) on a `--bar` surface, with 44 px targets (CLAUDE.md). There is nothing in the design to compare it
with, so a visual check can test sizes and overflow only.

---

## 7. Conflicts with the handoff

Ordered by how much they change what is built. "Design" means the measured value.

| # | Topic | Handoff | Design | Recommendation |
|---|---|---|---|---|
| 1 | Default button radius and weight | 12 px; primary 600 | The default button, the most used, is **11 px**, `10px 16px`, 13.5 px, **primary 700**, secondary 600 (L1113-1114, 49 uses). 12 px is the large size; 600 primary is the large and compact sizes | Build the sizes of [button](#button). The handoff's numbers describe the large button |
| 2 | Level bar height | 8 px | 9 px in the team view, personal view and Home (L157, L95, L246); 8 px only in the landing sample and Results rows | 9 px for theme rows, 8 px for Results rows; or one value by owner decision |
| 3 | Questionnaire option control | OptionRow in a 640 px column for all questionnaires | The diagnostic runner uses 88 px tiles in a 1160 px layout (L1539-1554) | The handoff wins (scope). The runner has no design reference for its layout |
| 4 | Warning-box text colour | `--flag-ink` | Body inherits `#111111`; only the action is `#7a4e03`; icon `#a86c05` (L1301) | Follow the design (ink body); give the icon a token or use `--flag-ink` |
| 5 | Settings tabs | With Group, Results and Plan: off text `--text-2` | A vertical menu in a card, nav colours: off text `#2b2a26` (L1103, PC L1251) | Build the menu as measured; drop Appearance |
| 6 | Section title tracking | -0.02em for 18 to 21 px | 18 px has none (27 uses); 21 px has -0.02em | No tracking at 18 px |
| 7 | App page title | Not listed | Poppins 32/500/-0.03em on eight pages | Add it to the type scale |
| 8 | Hint-box radius | 12 px | 12 (compact, L237) and 14 (large, L137) | Two sizes |
| 9 | Contrast table | Lists `--bg`, `--bar`, `--hero` | `--muted` also fails on `--surface-sunk` (4.34) and `--surface-soft` (4.20); `#aaa59a` fails (2.45) | Use `--text-2` for small meta in inset boxes too |
| 10 | Avatar choice | A stable hash of the person | A fixed tone per seeded member (PC L31-38, L625); the top-bar avatar by role (PC L632) | Hash as the handoff says; seed Kari to pair 0 so screenshots match |
| 11 | Level-bar width | (level − 1) ÷ 4 | Drawn from the unrounded mean (PC L680) | Use the stored one-decimal level |
| 12 | Evidence chip weight | (not given) | 700, except 600 in the Standing table (L477) | 700 |
| 13 | Progress-bar track | `--border` | Scan `#e2dbcf` (L70); questionnaire header `#ece6dc` (L1518) | `--border`, as the handoff says |
| 14 | Unlisted colours | | `#d4cfdd` (toggle off), `#fff6f7` (downgrade panel), `#8a5a00` (time-check advice), `#a86c05`, `#b7790b`, `#f0d7a5` (warnings), `#f3efe8` and `#e9e4f3` (a rule and a track), `#2a2a2a` (save-card gradient), `#aaa59a` | All are in MVP screens. B2 covers none of them. Owner decision, or map them to the nearest token |
| 15 | Toast shadow | Shadows only on three landing and questionnaire elements | The toast has a shadow (L1612) | Keep it |
| 16 | `--border-strong` | `#d8d0c2` | `#ddd5c8` on 64 buttons; `#d8d0c2` on one landing button | B2 already decided: `#ddd5c8` |
| 17 | Standing order | Descriptive, task conflict, low agreement, table | Low agreement before task conflict; "Mixed" escapes Priority (PC L1288) | The handoff's order |
| 18 | Top-bar tray | Settings | A tray of three buttons (L205) | Keep the tray with one button |

Things the design shows that section 11 removes, met while measuring: "Team Scan" in the public header and
Free "Needs you" rows; "24 scales" (PC L1216, design L523); "Assessment schedule" (L224); "At 4 answers …" and "3
more answers needed" (L137, L151, L237, PC L1213); "360" in the navigation (PC L135); the CXO screens
(L1394-1460); SD and rwg (L452, PC L1142); the Appearance tab. None is used as a specimen here.

---

## 8. Locator index, machine-readable

Each entry: the route, the seed (section 0), an optional action, the `data-dc-tpl` index and `nth`
(0-based, for `sc-for` repeats), and a text anchor. Indices are computed offline; verify the first one.

```json
{
  "topbar":                {"seed":"S_HOME_TEAM","tpl":252,"nth":0,"text":"LeaderPact","also":{"pill":253},"exclude":{"tpl":260,"nth":7,"why":"360 nav item, section 11"}},
  "logo":                  {"seed":"S_HOME_TEAM","tpl":255,"nth":0,"text":"LeaderPact","also":{"mark":256}},
  "nav-item-active":       {"seed":"S_HOME_TEAM","tpl":260,"nth":0,"text":"Home"},
  "nav-item":              {"seed":"S_HOME_TEAM","tpl":260,"nth":1,"text":"Group"},
  "plan-pill":             {"seed":"S_HOME_TEAM","tpl":269,"nth":0,"text":"Team plan"},
  "avatar":                {"seed":"S_HOME_TEAM","tpl":278,"nth":0,"text":"KN"},
  "hero-block":            {"seed":"S_HOME_TEAM","tpl":307,"nth":0,"text":"Good morning, Kari.","exclude":{"tpl":312,"why":"Assessment schedule, section 11"}},
  "card":                  {"seed":"S_HOME_TEAM","tpl":401,"nth":0,"text":"Needs you"},
  "section-header":        {"seed":"S_HOME_TEAM","tpl":402,"nth":0,"text":"Needs you"},
  "list-row":              {"seed":"S_HOME_TEAM","tpl":412,"nth":0,"text":"Answer pulse 6"},
  "icon-tile":             {"seed":"S_HOME_TEAM","tpl":413,"nth":0,"text":null},
  "button-primary":        {"seed":"S_SETTINGS","tpl":2265,"nth":0,"text":"Save changes"},
  "button-secondary":      {"seed":"S_SETTINGS","tpl":2262,"nth":0,"text":"Sign out everywhere"},
  "button-danger":         {"seed":"S_SETTINGS","tpl":2264,"nth":0,"text":"Delete account"},
  "button-small":          {"seed":"S_HOME_TEAM","tpl":420,"nth":0,"text":"Answer now"},
  "button-large-primary":  {"seed":"S_SCAN","tpl":106,"nth":0,"text":"Next"},
  "button-large-secondary":{"seed":"S_SCAN","tpl":105,"nth":0,"text":"Back"},
  "pill":                  {"seed":"S_SCAN","tpl":98,"nth":0,"text":"Purpose and priorities"},
  "pill-count":            {"seed":"S_HOME_TEAM","tpl":404,"nth":0,"text":"4"},
  "pill-status":           {"seed":"S_PEOPLE","tpl":1488,"nth":0,"text":"Active"},
  "tabs":                  {"seed":"S_GROUP_TEAM","tpl":575,"nth":0,"text":"Charter","also":{"tab":577}},
  "tabs-plan":             {"seed":"S_PLAN","tpl":1252,"nth":0,"text":"Focus areas and actions"},
  "tabs-results-depth":    {"seed":"S_RESULTS","tpl":701,"nth":0,"text":"Overview"},
  "tabs-settings":         {"seed":"S_SETTINGS","tpl":2222,"nth":0,"text":"Account","exclude":{"tpl":2224,"nth":5,"why":"Appearance tab, section 11"}},
  "option-row-on":         {"seed":"S_SCAN","tpl":102,"nth":3,"text":"Agree"},
  "option-row-off":        {"seed":"S_SCAN","tpl":102,"nth":0,"text":"Strongly disagree"},
  "progress-bar":          {"seed":"S_SCAN","tpl":95,"nth":0,"text":"1 of 12"},
  "level-bar":             {"seed":"S_TEAM_VIEW","tpl":196,"nth":0,"text":"Purpose and priorities"},
  "level-bar-results":     {"seed":"S_RESULTS","tpl":873,"nth":0,"text":"Clear purpose"},
  "count-dots":            {"seed":"S_HOME_FREE","tpl":341,"nth":0,"text":null},
  "hint-box":              {"seed":"S_HOME_FREE","tpl":345,"nth":0,"text":"more needed","note":"design text removed by section 11; compare shape only"},
  "warning-box":           {"seed":"S_AGENDA_FLAG","tpl":2881,"nth":0,"text":"This item matches no team task."},
  "sample-banner":         {"seed":"S_GROUP_FREE_LEADER","tpl":281,"nth":0,"text":"SAMPLE"},
  "sample-banner-member":  {"seed":"S_GROUP_FREE_MEMBER","tpl":286,"nth":0,"text":"SAMPLE"},
  "evidence-chip-strong":  {"seed":"S_RESULTS","tpl":872,"nth":0,"text":"Strong"},
  "evidence-chip-moderate":{"seed":"S_RESULTS","tpl":872,"nth":1,"text":"Moderate"},
  "evidence-chip-other":   {"seed":"S_RESULTS","tpl":872,"nth":2,"text":"Mixed"},
  "standing-label":        {"seed":"S_RESULTS","tpl":879,"nth":0,"text":"Strength"},
  "toast":                 {"seed":"S_SETTINGS","action":{"click":{"tpl":2265,"nth":0}},"tpl":3483,"nth":0,"text":"Account saved","within_ms":3800}
}
```

`route` is inside each seed. Every app-route seed carries `"ui":{"nav":"horizontal","wide":false}`; the
public seeds (`S_SCAN`, `S_TEAM_VIEW`, `S_INVITE`) do not need it.
