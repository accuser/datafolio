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

/** Read + validate the GitHub config, or return null if not fully configured. */
export function getGitHubConfig(): GitHubConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!appId || !privateKeyRaw || !clientId || !clientSecret || !sessionSecret) {
    return null;
  }
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }

  return {
    appId,
    privateKey: normalisePrivateKey(privateKeyRaw),
    clientId,
    clientSecret,
    repoName: process.env.DATAFOLIO_REPO_NAME || "portfolio-evidence",
    baseUrl: (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
    sessionSecret,
  };
}

/** True when the server has everything needed to talk to GitHub. */
export function isGitHubConfigured(): boolean {
  return getGitHubConfig() !== null;
}

/** Like getGitHubConfig but throws — use in code paths that require GitHub. */
export function requireGitHubConfig(): GitHubConfig {
  const cfg = getGitHubConfig();
  if (!cfg) {
    throw new Error(
      "GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, " +
        "GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET and SESSION_SECRET. " +
        "See docs/github-app.md.",
    );
  }
  return cfg;
}
