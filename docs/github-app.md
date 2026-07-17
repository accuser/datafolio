# DataFolio backend — GitHub App setup

DataFolio stores every learner's evidence in **their own private GitHub repo**
(created from the template). The app is a thin front end over that repo: a
provider-owned **GitHub App** (fine-grained, per-repo) authenticates users and
grants the backend short-lived, single-repo tokens to read and commit
`evidence/<KSB>/index.md`.

Two things happen with the App:

1. **User authentication** (user-to-server OAuth) — identifies *who* is signed
   in (a learner or a coach) via "Sign in with GitHub".
2. **Installation access** — the App, installed on a learner's repo, lets the
   backend mint an installation token to read/write that one repo's Contents.

Coaches are **collaborators** on the learner's private repo, so the same
installation token authorises their reviews (the backend checks the signed-in
user is the repo owner or a collaborator with write access before committing).

---

## 1. Register the GitHub App

GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**.

- **Name / Homepage URL**: anything (e.g. your programme name).
- **Callback URL**: `http://localhost:3000/api/auth/callback`
  (use your deployed origin in production).
- **Request user authorization (OAuth) during installation**: optional.
- **Expire user authorization tokens**: fine either way — the app doesn't
  persist user tokens.
- **Webhook**: not required for this backend — untick **Active**.
- **Permissions → Repository**:
  - **Contents**: **Read and write**
  - **Metadata**: **Read-only** (mandatory)
- **Where can this App be installed?**: **Any account** (so each learner can
  install it on their own repo).

Create the App, then on its settings page:

- Note the **App ID** and **Client ID**.
- **Generate a new client secret**.
- **Generate a private key** — downloads a `.pem`.

## 2. Configure the app

Copy `.env.example` → `.env.local` and fill in:

| Variable | From |
| --- | --- |
| `GITHUB_APP_ID` | App settings |
| `GITHUB_APP_CLIENT_ID` | App settings |
| `GITHUB_APP_CLIENT_SECRET` | the client secret you generated |
| `GITHUB_APP_PRIVATE_KEY` | the `.pem` (PEM with `\n`, or base64 one-liner) |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `APP_BASE_URL` | this app's origin (`http://localhost:3000` in dev) |
| `DATAFOLIO_REPO_NAME` | the template-derived repo name (`portfolio-evidence`) |
| `NEXT_PUBLIC_DATAFOLIO_BACKEND` | `github` to switch off mock mode |

Restart the dev server after changing env.

## 3. Onboard a learner

1. The learner creates their repo from the **template repository** (the
   `template-repo/` in the design bundle) — named per `DATAFOLIO_REPO_NAME`.
2. They **install the GitHub App** on that one repo (Contents: R/W).
3. They open DataFolio and **Sign in with GitHub** → they land on their own
   `<login>/portfolio-evidence`.

## 4. Onboard a coach

1. The learner adds the coach as a **collaborator** (write access) on their repo.
2. The coach signs in and opens the learner's repo by passing the learner's
   login: `…/api/auth/login?owner=<learner-login>` (or `?owner=…&repo=…`).
   The backend confirms they're a collaborator before allowing any review.

---

## How it maps to the repository contract

- **Read** (`GET /api/evidence`): lists `evidence/*/index.md` via the Git Trees
  API, fetches each blob, and parses the YAML front-matter (+ recovers reflection
  narrative from the body) into the app's evidence model.
- **Write** (`POST /api/evidence`, `PATCH /api/evidence/:id`): a read-modify-write
  that regenerates every affected folder's `index.md` (the item's primary folder
  plus any other KSB whose sub-point coverage changes) and commits them
  **atomically** in a single commit via the Git Data API. Uploaded files are
  committed as blobs in the same commit.
- Each evidence item is stored **once**, in its primary KSB folder, with `maps[]`
  cross-referencing the other KSBs/sub-points it evidences — exactly what
  `scripts/build_coverage.py` expects. The coverage matrix regenerates in-repo on
  push, unchanged.

## Modes at a glance

| | Mock (default) | GitHub (`NEXT_PUBLIC_DATAFOLIO_BACKEND=github`) |
| --- | --- | --- |
| Data | in-memory sample | learner's private repo |
| Sign in | button flips a flag | GitHub App user OAuth |
| Writes | in-memory | atomic commits via backend proxy |
| Config needed | none | the env above |
