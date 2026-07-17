import "server-only";
import { App } from "@octokit/app";
import type { Octokit } from "@octokit/core";
import { requireGitHubConfig } from "./config";

// GitHub App client. Handles the hard part — signing an App JWT and minting
// short-lived, per-repo installation tokens — via @octokit/app. User OAuth
// (identifying the signed-in learner/coach) is done with plain fetch in the
// auth routes, since it needs no signing.

let appSingleton: App | null = null;

export function getApp(): App {
  if (appSingleton) return appSingleton;
  const cfg = requireGitHubConfig();
  appSingleton = new App({
    appId: cfg.appId,
    privateKey: cfg.privateKey,
    oauth: { clientId: cfg.clientId, clientSecret: cfg.clientSecret },
  });
  return appSingleton;
}

/**
 * An Octokit authenticated as the App installation on `owner/repo`, scoped to
 * that single repository. Throws if the App isn't installed there.
 */
export async function getInstallationOctokit(
  owner: string,
  repo: string,
): Promise<Octokit> {
  const app = getApp();
  const { data: installation } = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    { owner, repo },
  );
  return app.getInstallationOctokit(installation.id);
}

/**
 * Whether `username` may write to `owner/repo` — i.e. is the owner or a
 * collaborator with at least push access. This is how a coach (a collaborator
 * on the learner's private repo) is authorised to review.
 */
export async function canWrite(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string,
): Promise<boolean> {
  if (username.toLowerCase() === owner.toLowerCase()) return true;
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/collaborators/{username}/permission",
      { owner, repo, username },
    );
    return ["admin", "write", "maintain"].includes(data.permission);
  } catch {
    return false;
  }
}

/**
 * Whether `username` may READ `owner/repo` — the owner, or a collaborator with
 * any permission (read/triage/write/maintain/admin). Guards the read paths so a
 * signed-in user cannot pull another learner's private portfolio just by
 * pointing the session at their repo.
 */
export async function canRead(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string,
): Promise<boolean> {
  if (username.toLowerCase() === owner.toLowerCase()) return true;
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/collaborators/{username}/permission",
      { owner, repo, username },
    );
    // Non-collaborators come back as "none" (or a 404, caught below).
    return data.permission !== "none";
  } catch {
    return false;
  }
}
