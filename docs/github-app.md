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
2. The coach **Signs in with GitHub**. At sign-in the backend enumerates every
   portfolio repo the coach can reach — their own (if any) plus every learner
   repo they're a collaborator on where the App is installed — and caches the
   list in the session.
3. The coach picks a learner from the **portfolio switcher** in the header (top
   right). No need to hand-type logins. The deep link
   `…/api/auth/login?owner=<learner-login>` still works if you want to jump
   straight to one learner.

The backend still confirms collaborator access (`canRead`/`canWrite`) on every
request, so the switcher only ever lists — and only ever opens — repos the coach
already has GitHub permission on. Switching is discovery, not new access.

> **Install scope matters.** A learner repo appears in a coach's switcher only if
> the App's installation on that account **includes that repo**. If a learner
> installed the App on *"only select repositories"*, the portfolio repo must be
> one of them; *"all repositories"* also works. A repo the App isn't installed on
> is invisible to the switcher (and to the backend), even to a valid collaborator.

> **The roster refreshes on sign-in.** The switcher list is enumerated once at
> sign-in and cached in the session. If a learner grants or revokes a coach's
> access afterwards, it isn't reflected until the coach signs in again — and a
> revoked-access switch will appear to succeed but then fail to load the evidence
> (every request re-checks access server-side, so nothing leaks). The list is
> also length-capped, so a coach with an unusually large roster (a provider-scale
> case this model isn't built for) may not see every learner.

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
