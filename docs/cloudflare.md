# Deploying DataFolio to Cloudflare Workers

DataFolio deploys to **Cloudflare Workers** via the **OpenNext** adapter
(`@opennextjs/cloudflare`). Workers (with the `nodejs_compat` flag) supports the
Node APIs the backend needs — `node:crypto`, `Buffer`, `iron-session`, and the
GitHub App JWT signing — so the full app runs, not just the static front end.

> The older Cloudflare **Pages** / `next-on-pages` path forces every route onto
> the Edge runtime and would break the GitHub App auth. Use Workers/OpenNext.

Config lives in `wrangler.jsonc` (`nodejs_compat`, assets binding) and
`open-next.config.ts`. Build artifacts (`.open-next/`) are git-ignored.

## One-time setup

```bash
npm install
npx wrangler login          # authenticate wrangler with your Cloudflare account
```

## Secrets (production)

> **`.env.local` IS baked into the deploy.** The OpenNext build compiles the
> project's env files — `.env`, `.env.production`, `.env.local`,
> `.env.production.local` — into the Worker bundle as plaintext fallbacks
> (Cloudflare secrets take precedence, so the leak is silent, not visible).
> `npm run cf:build` / `npm run deploy` therefore run
> `scripts/check-deploy-env.ts` first and **refuse to build** while any of
> those files sets `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_SECRET` or
> `SESSION_SECRET`. Keep secrets in `.env.local` for local dev if you like —
> just deploy from a checkout without it (CI is ideal), or move the lines out
> before deploying. `.dev.vars` is genuinely local-only and is never uploaded.

Set each server secret on the Worker (interactive prompt, or pipe from a file
for the multi-line key):

```bash
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_CLIENT_ID
wrangler secret put GITHUB_APP_CLIENT_SECRET
wrangler secret put GITHUB_APP_PRIVATE_KEY      # paste the PEM, or base64 one-liner
wrangler secret put SESSION_SECRET              # openssl rand -base64 32
```

`DATAFOLIO_REPO_NAME` and `APP_BASE_URL` are **not secrets** — they live in the
`vars` block of `wrangler.jsonc`, where a wrong value can be read back and
diagnosed (secrets are write-only, and a wrong `APP_BASE_URL` is the
highest-traffic misconfiguration because it breaks the OAuth redirect).

`NEXT_PUBLIC_DATAFOLIO_BACKEND` is a **build-time** variable (inlined into the
client), so it is set when you build/deploy, not as a secret. The pre-deploy
check fails if it isn't `github`, because forgetting it would silently publish
the mock demo; a deliberate mock deploy needs `DATAFOLIO_ALLOW_MOCK_DEPLOY=1`.

```bash
NEXT_PUBLIC_DATAFOLIO_BACKEND=github npm run deploy
```

## Point the GitHub App at the deployed origin

After the first deploy you'll have an origin like
`https://datafolio.<your-subdomain>.workers.dev` (or a custom domain). Then:

1. Set `APP_BASE_URL` to that origin in the `vars` block of `wrangler.jsonc`.
2. In the GitHub App settings, **add** a Callback URL
   `<origin>/api/auth/callback` (a GitHub App can carry several callback URLs,
   so keep the localhost ones alongside it).
3. Redeploy so `APP_BASE_URL` takes effect:
   `NEXT_PUBLIC_DATAFOLIO_BACKEND=github npm run deploy`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run cf:build` | Production `next build` → OpenNext Worker bundle (`.open-next/`) |
| `npm run preview` | Build, then run the Worker locally on `workerd` (reads `.dev.vars` / `.env.local`) |
| `npm run deploy` | Build, then `wrangler deploy` to Cloudflare |
| `npm run cf:typegen` | Regenerate `cloudflare-env.d.ts` binding types |

## Verified, and what still needs a smoke test

Verified so far: `npm run cf:build` produces a valid Worker, and `wrangler dev`
boots it on the Workers runtime — `/` serves 200, `/api/session` reads config,
and `/api/auth/login` issues a valid GitHub OAuth redirect (iron-session and
`randomBytes` working on `workerd`).

**Not yet exercised by the above:** the GitHub App JWT signing (RS256), which
only runs on the first authenticated evidence read/write — sign-in alone never
touches it. After deploying (or under `npm run preview` with real credentials),
smoke-test the full path before onboarding anyone:

1. Sign in and load the Dashboard — a populated portfolio proves App-JWT
   signing, installation tokens and the tree read all work on `workerd`.
2. `curl -sI https://<origin>/ | grep -i set-cookie` on any response that sets
   the session — confirm the cookie carries `HttpOnly` and `Secure`.
3. Add one draft evidence item and check the commit lands in the repo.
