# LeaderPact

A leadership team sees how it really works in three minutes, then improves it meeting by meeting.
"LeaderPact" is a working name (`lib/brand.ts`); nothing public ships under it until the name is cleared.

- **What to build, and in what order:** `docs/LEADERPACT_HANDOFF.md` (section 12 is the build order).
- **The owner's decisions:** `docs/REUSE_EVALUATION.md`, section 2.0, and `docs/DECISIONS.md`.
- **Rules for coding agents:** `CLAUDE.md`.
- **The design:** `design/reference/` (reference only; see its README).

## Stack

Next.js 15.5 (App Router), React 19, TypeScript strict, Tailwind 3.4, next-intl (English only),
Supabase (Postgres, Auth, Realtime, Vault), Zod, Vitest, Playwright with axe. Hosted on Vercel (`fra1`)
and Supabase (`leaderpact`, ref `tgxjbshdjwoemsmrtkzw`, eu-central-1).

## Setup

```bash
npm ci
cp .env.example .env.local   # fill in the publishable key
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | The app on http://localhost:3000 |
| `npx tsc --noEmit` | Type check |
| `npm run lint` | ESLint, including "no literal text in JSX" |
| `npm test` | Unit tests (Vitest) |
| `npm run verify:i18n` | The message catalogue: ICU, plurals, British spelling, no emoji, short sentences, our names |
| `npm run build` | Production build |
| `npm run e2e` | Playwright flows with axe at 1280, 390 and 360 px (after a build) |
| `npm run test:db` | Every SQL suite against a local database |
| `npm run audit:security` | The catalogue security audit (`scripts/audit/wiring.mjs --security-only`) |

### The database, locally

With Docker and the Supabase CLI: `supabase start && supabase db reset`, then `npm run test:db`.

Without Docker (a cloud session): `eval "$(bash scripts/qa/local-pg.sh)"` starts a throwaway
PostgreSQL, stubs what Supabase provides, applies every migration and sets `DATABASE_URL`. Then
`npm run test:db` and `node scripts/audit/wiring.mjs --security-only --db "$DATABASE_URL"`.

## Environments

| | Where | Database |
|---|---|---|
| Local | `npm run dev` | local Supabase, or `scripts/qa/local-pg.sh` for the suites |
| CI | GitHub Actions, one job (`.github/workflows/ci.yml`) | rebuilt from migrations on every run |
| Preview | Vercel, per branch | `tgxjbshdjwoemsmrtkzw` |
| Production | Vercel, from `main` | `tgxjbshdjwoemsmrtkzw` |

Hosted migrations are applied through the Supabase MCP, with the committed file verbatim (`CLAUDE.md`,
deployment playbook).
