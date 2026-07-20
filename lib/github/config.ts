// Central configuration for the GitHub App backend. All secrets come from the
// environment; nothing here is bundled to the client. When the App isn't
// configured, `isGitHubConfigured()` returns false and the app falls back to
// the in-memory mock store so the UX still runs.

export interface GitHubConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
  /** The repo name every learner creates from the template. */
  repoName: string;
  /** Absolute base URL of this app, for OAuth redirect_uri. */
  baseUrl: string;
  /** iron-session cookie encryption password (>= 32 chars). */
  sessionSecret: string;
}

/**
 * The App private key may be provided either as a raw PEM (with real newlines,
 * e.g. from a `.env` with quoted multiline value) or base64-encoded (handy for
 * single-line secret stores). Normalise to a PEM string.
 */
function normalisePrivateKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN") && trimmed.includes("PRIVATE KEY")) {
    // Allow `\n`-escaped PEMs (common when stored in a single env line).
    return trimmed.replace(/\\n/g, "\n");
  }
  // Otherwise assume base64-encoded PEM.
  return Buffer.from(trimmed, "base64").toString("utf8");
}

const NOT_SET =
  "GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, " +
  "GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET and SESSION_SECRET. " +
  "See docs/github-app.md.";

/**
 * Why the config is unusable, separated from *whether* it is.
 *
 * Absent env vars are the ordinary mock-mode case; a present-but-invalid value
 * is a deployment mistake. Both leave the app without GitHub, but only the
 * second is worth shouting about — so the reason is carried rather than
 * collapsed into a bare null.
 */
type ConfigResult =
  | { ok: true; config: GitHubConfig }
  | { ok: false; reason: string; misconfigured: boolean };

function readConfig(): ConfigResult {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!appId || !privateKeyRaw || !clientId || !clientSecret || !sessionSecret) {
    return { ok: false, reason: NOT_SET, misconfigured: false };
  }
  if (sessionSecret.length < 32) {
    return {
      ok: false,
      reason: "SESSION_SECRET must be at least 32 characters.",
      misconfigured: true,
    };
  }

  return {
    ok: true,
    config: {
      appId,
      privateKey: normalisePrivateKey(privateKeyRaw),
      clientId,
      clientSecret,
      repoName: process.env.DATAFOLIO_REPO_NAME || "portfolio-evidence",
      baseUrl: (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
      sessionSecret,
    },
  };
}

/** Read + validate the GitHub config, or return null if not usable. */
export function getGitHubConfig(): GitHubConfig | null {
  const res = readConfig();
  return res.ok ? res.config : null;
}

/** So a misconfiguration is reported once at startup, not once per request. */
let warned = false;

/**
 * True when the server has everything needed to talk to GitHub.
 *
 * Returns `false` for an invalid value rather than throwing: this is the guard
 * four routes use to decide between GitHub mode and the mock store, and a
 * throwing guard turned a bad SESSION_SECRET into an uncaught 500 on every
 * request instead of the documented fallback. A misconfiguration is still
 * loud — it just goes to the log rather than to every user's browser.
 */
export function isGitHubConfigured(): boolean {
  const res = readConfig();
  if (!res.ok && res.misconfigured && !warned) {
    warned = true;
    console.error(`[datafolio] GitHub App disabled — ${res.reason}`);
  }
  return res.ok;
}

/** Like getGitHubConfig but throws — use in code paths that require GitHub. */
export function requireGitHubConfig(): GitHubConfig {
  const res = readConfig();
  if (!res.ok) throw new Error(res.reason);
  return res.config;
}
