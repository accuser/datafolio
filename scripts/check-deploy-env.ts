// Pre-deploy guard, run by `npm run cf:build` and `npm run deploy`.
//
// The OpenNext adapter compiles the project's env files — `.env`,
// `.env.production`, `.env.local`, `.env.production.local` — into the Worker
// bundle verbatim (`.open-next/cloudflare/next-env.mjs`). That's convenient for
// public config and catastrophic for secrets: a `.env.local` written for local
// dev per docs/github-app.md would ship the App private key, client secret and
// session secret as plaintext inside the deployed Worker. Baked values are only
// fallbacks (`process.env[key] ??=`), so real Cloudflare secrets mask them —
// which makes the leak silent, not harmless.
//
// This script fails the build when any secret key has a value in a file the
// adapter would bake, and when the deploy would silently be a mock-mode demo
// (see below). It reads the same files the adapter reads, so the check can't
// drift from what actually ships.

import * as fs from "node:fs";
import * as path from "node:path";

/** Env keys that must never be baked into the Worker bundle. */
const SECRET_KEYS = [
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_CLIENT_SECRET",
  "SESSION_SECRET",
];

/** The files the OpenNext adapter compiles into the bundle (production mode). */
const BAKED_FILES = [".env", ".env.production", ".env.local", ".env.production.local"];

const root = process.cwd();
const problems: string[] = [];

for (const file of BAKED_FILES) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, "utf8");
  for (const key of SECRET_KEYS) {
    // A key with any non-empty value counts; commented-out lines don't.
    const re = new RegExp(`^\\s*${key}\\s*=\\s*\\S`, "m");
    if (re.test(text)) problems.push(`${file} sets ${key}`);
  }
}

if (problems.length) {
  console.error(
    [
      "✗ Refusing to build a deployable Worker: secrets would be baked into the bundle.",
      "",
      ...problems.map((p) => `  - ${p}`),
      "",
      "The OpenNext adapter compiles these env files into the Worker artifact,",
      "so every secret in them ships as plaintext inside the deployed code.",
      "Set secrets on the Worker instead (`wrangler secret put <NAME>`, see",
      "docs/cloudflare.md) and remove them from the file — or deploy from a",
      "checkout that has no local env files (e.g. CI).",
    ].join("\n"),
  );
  process.exit(1);
}

// A deploy that forgets NEXT_PUBLIC_DATAFOLIO_BACKEND=github publishes the
// in-memory mock demo — seeded sample data, sign-in that flips a flag — on a
// public URL, with no error anywhere. Require the choice to be explicit.
if (
  process.env.NEXT_PUBLIC_DATAFOLIO_BACKEND !== "github" &&
  process.env.DATAFOLIO_ALLOW_MOCK_DEPLOY !== "1"
) {
  console.error(
    [
      "✗ NEXT_PUBLIC_DATAFOLIO_BACKEND is not 'github'.",
      "",
      "This build would ship the mock demo (in-memory sample data, no real",
      "sign-in) as the deployed app. If that's really what you want, set",
      "DATAFOLIO_ALLOW_MOCK_DEPLOY=1. To deploy the real app:",
      "",
      "  NEXT_PUBLIC_DATAFOLIO_BACKEND=github npm run deploy",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("✓ Deploy env check passed: no baked secrets, backend mode explicit.");
