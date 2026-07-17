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

`.env.local` / `.dev.vars` are **not** uploaded. Set each server secret on the
Worker (interactive prompt, or pipe from a file for the multi-line key):

```bash
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_CLIENT_ID
wrangler secret put GITHUB_APP_CLIENT_SECRET
wrangler secret put GITHUB_APP_PRIVATE_KEY      # paste the PEM, or base64 one-liner
wrangler secret put SESSION_SECRET              # openssl rand -base64 32
wrangler secret put DATAFOLIO_REPO_NAME         # e.g. portfolio-evidence
wrangler secret put APP_BASE_URL                # your deployed origin (see below)
```

`NEXT_PUBLIC_DATAFOLIO_BACKEND` is a **build-time** variable (inlined into the
client), so it is set when you build/deploy, not as a secret:

```bash
NEXT_PUBLIC_DATAFOLIO_BACKEND=github npm run deploy
```

## Point the GitHub App at the deployed origin

After the first deploy you'll have an origin like
`https://datafolio.<your-subdomain>.workers.dev` (or a custom domain). Then:

1. Set the `APP_BASE_URL` secret to that origin.
2. In the GitHub App settings, set the **Callback URL** to
   `<origin>/api/auth/callback`.
3. Redeploy so `APP_BASE_URL` takes effect:
   `NEXT_PUBLIC_DATAFOLIO_BACKEND=github npm run deploy`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run cf:build` | Production `next build` → OpenNext Worker bundle (`.open-next/`) |
| `npm run preview` | Build, then run the Worker locally on `workerd` (reads `.dev.vars` / `.env.local`) |
| `npm run deploy` | Build, then `wrangler deploy` to Cloudflare |
| `npm run cf:typegen` | Regenerate `cloudflare-env.d.ts` binding types |

## Verified

`npm run cf:build` produces a valid Worker, and `wrangler dev` boots it on the
Workers runtime: `/` serves 200, `/api/session` reads config, and
`/api/auth/login` issues a valid GitHub OAuth redirect (crypto + session working
on `workerd`). The remaining step — `wrangler deploy` — needs your Cloudflare
account.
