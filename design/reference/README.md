# Design reference

Reference only. Nothing in the app imports from this folder.

| File | What it is | Source |
|---|---|---|
| `LeaderPact App - Cream v2.dc.html` | The Claude Design prototype the handoff names. It is the visual reference, and handoff section 11 lists where it is wrong. | Supplied with the handoff, 11 October 2026 |
| `proto-core-v5.js` | The prototype's state and data (`window.LTCore`). Without it only the landing page renders. | Claude Design bundle "Copy of Leadership application mockups", supplied 11 October 2026 |
| `support.js` | The `.dc.html` runtime. It loads React 18.3.1 and Babel 7.29.0 from unpkg. | The same bundle |

## Rules

- **The handoff ranks above this design.** Item wording, scale names, numbers and copy come from
  `docs/LEADERPACT_HANDOFF.md`. For example, the scan items in `proto-core-v5.js` are older drafts; Appendix C
  of the handoff is the wording to build.
- **Match the design where it is right.** This is not a pixel-perfect reference (handoff section 0).
- **Cream v2 is the only visual reference** (owner, 11 October 2026). The same bundle's purple Manrope
  `LeaderPact.dc.html` is an earlier theme of the same screens. It is not in the repository and is not built.
- **The bundle's own README does not apply here.** It asks for pixel-perfect output and says not to render the
  files. The handoff overrides both: the visual checks render this design beside the app.

## Rendering it

Serve this folder over HTTP. Route `unpkg.com` to local copies of React, ReactDOM and Babel, and Google Fonts
to the committed font files. Seed `localStorage['lt-proto-p6']` with `{"v":"v5.0","route":"<route>","plan":"free|team"}`
to open a screen. Routes: `landing`, `scan`, `personal`, `invite`, `home`, `group`, `people`, `assess`, `results`,
`develop`, `meetings`, `live`, `me`, `settings`. Run it in headless Chromium with every other request aborted,
because the runtime executes the design's own code.
