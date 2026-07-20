# DataFolio

A web app for **Level 6 Data Scientist (ST0585)** apprentices to capture
portfolio evidence against every KSB (Knowledge, Skill, Behaviour) — down to
sub-points — and commit it to their own **private GitHub repo**. A reviewer —
a coach, line manager, or anyone else granted access — approves it or requests
changes. Learners can also build **revision cards** per KSB and export them as an
Anki deck. Built with **Next.js** on the apprenticeship's repository contract
(`evidence/<KSB>/index.md`, `revision/<KSB>/cards.md`).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Out of the box `.env.local` selects **GitHub mode**. To click through the app
with no GitHub App and no auth, run **mock mode**:

```bash
npm run dev:mock   # http://localhost:3100, in-memory sample data
```

Mock mode seeds sample evidence and cards so you can exercise all six screens in
both roles (learner / reviewer).

## Two data modes

The UI is identical in both; only the data layer swaps behind the `EvidenceStore`
and `CardStore` seams (`lib/data/store.ts`, `lib/data/card-store.ts`).

- **Mock** (`NEXT_PUBLIC_DATAFOLIO_BACKEND` unset or `mock`) — in-memory stores
  seeded from `lib/data/seed.ts`.
- **GitHub** (`NEXT_PUBLIC_DATAFOLIO_BACKEND=github`) — a provider-owned **GitHub
  App** authenticates users and a thin backend proxy reads/commits each learner's
  private repo. Set up the App per **[docs/github-app.md](docs/github-app.md)**
  and configure `.env.local` from `.env.example`.

## Deploy

Runs on **Cloudflare Workers** via the OpenNext adapter (`nodejs_compat` for the
Node backend). See **[docs/cloudflare.md](docs/cloudflare.md)** — build with
`npm run cf:build`, preview on `workerd` with `npm run preview`, ship with
`npm run deploy`.

## Layout

```
app/
  layout.tsx               # AppProvider + AppShell (auth gate, chrome, security headers in next.config.ts)
  page.tsx  ksb/[id]/  repository/  coverage/   # the routed screens
  api/
    auth/{login,callback,logout}/   # GitHub App user OAuth
    session/                        # current identity + role
    evidence/  evidence/[id]/       # read (GET) + write (POST/PATCH/DELETE) proxy
    cards/     cards/[id]/          # revision-card read/write proxy (owner-only writes)
    portfolios/select/              # switch the active portfolio (reviewers)
components/
  screens/                 # SignIn, Dashboard, KsbDetail, AddEvidence, Repository, Coverage
lib/
  domain.ts                # status derivation, genMd/renderIndexMd, meta helpers
  cards.ts  anki.ts        # revision-card generation + Anki TSV export
  types.ts                 # domain types
  standards/               # occupational standards: standards/*.yaml → generated.ts (see below)
  data/                    # store seams: mock, http (client), github (server), validation, authz
  github/                  # App client, config, session context, commit path, front-matter parsers
  session.ts               # iron-session cookie
  state.tsx                # the client app state machine
standards/st0585.yaml      # the KSB source of truth (edit here, not generated.ts)
docs/github-app.md         # GitHub App registration + onboarding
```

## Standards are generated

The KSBs, sub-points and assessment methods live in `standards/*.yaml` and are
compiled to `lib/standards/generated.ts` — the app never parses YAML at runtime.
After editing the YAML:

```bash
npm run standards:build    # regenerate lib/standards/generated.ts
npm run standards:check    # verify the generated file is in sync (run in CI / by npm test)
```

## Checks

```bash
npm test           # standards:check + every lib/**/*.test.ts and *.roundtrip.ts, auto-discovered
npx tsc --noEmit   # types
npm run lint       # eslint
npm run build      # next build — catches App-Router / RSC-boundary mistakes
```

`npm test` discovers test files by glob (`tsx --test`), so a new `*.test.ts`
under `lib/` is picked up with no wiring, and one failure never hides another. To
run a single suite:

```bash
npx tsx --test --conditions=react-server lib/data/github-store.test.ts
```

The `--conditions=react-server` flag lets the server-only modules
(`import "server-only"`) load under the test runner; it's harmless for the tests
that don't need it, so `npm test` applies it to all of them.

## How writes map to the repo

Each evidence item is stored **once**, in its primary KSB folder, with `maps[]`
cross-referencing other KSBs/sub-points it evidences. A mutation regenerates
every affected folder's `index.md` and commits them **atomically** (Git Data
API), building each commit on the exact head the read saw so a concurrent write
is detected rather than silently clobbered. The in-repo `scripts/build_coverage.py`
Action regenerates the coverage matrix on push, unchanged.
