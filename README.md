# DataFolio

A web app for **Level 6 Data Scientist (ST0585)** apprentices to capture
portfolio evidence against every KSB (Knowledge, Skill, Behaviour) — down to
sub-points — and commit it to their own **private GitHub repo**. A coach reviews
and approves or requests changes. Built with **Next.js** on the
apprenticeship's repository contract (`evidence/<KSB>/index.md`).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Out of the box it runs in **mock mode** — in-memory sample data, no GitHub, no
auth — so you can click through all six screens in both roles (learner / coach).

## Two data modes

The UI is identical in both; only the data layer swaps behind the `EvidenceStore`
seam (`lib/data/store.ts`).

- **Mock** (default) — `createMockStore`, seeded sample evidence.
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
  page.tsx                 # AppProvider + the single-page app shell
  api/
    auth/{login,callback,logout}/   # GitHub App user OAuth
    session/                        # current identity + role
    evidence/[[id]]/                # read (GET) + write (POST/PATCH) proxy
components/
  screens/                 # Sign in, Dashboard, KSB detail, Add evidence, Repository, Coverage
lib/
  domain.ts                # status derivation, genMd/renderIndexMd, meta helpers
  ksbs.ts  types.ts        # the 19 KSBs + domain types
  data/                    # store seam: mock, http (client), github (server)
  github/                  # App client, config, session context, front-matter parser
  session.ts               # iron-session cookie
docs/github-app.md         # GitHub App registration + onboarding
```

## Checks

```bash
npx tsc --noEmit                                   # types
npx eslint .                                        # lint
npx tsx lib/github/frontmatter.roundtrip.ts         # index.md parse↔serialize round-trip
node --conditions=react-server --import tsx \
  lib/data/github-store.test.ts                     # GitHub store (fake Octokit) load/add/update
```

## How writes map to the repo

Each evidence item is stored **once**, in its primary KSB folder, with `maps[]`
cross-referencing other KSBs/sub-points it evidences. A mutation regenerates
every affected folder's `index.md` and commits them **atomically** (Git Data
API); the in-repo `scripts/build_coverage.py` Action regenerates the coverage
matrix on push, unchanged.
