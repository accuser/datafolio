import "server-only";
import type { Octokit } from "@octokit/core";
import { canRead, getInstallationOctokit } from "./app";
import { isGitHubConfigured } from "./config";
import { getSession } from "../session";

// Resolve the signed-in user + their target repo into an installation-scoped
// Octokit, or a structured error the route can turn into an HTTP status.

export interface RepoContext {
  octokit: Octokit;
  owner: string;
  repo: string;
  login: string;
  name: string;
}

export type ContextResult =
  | { ok: true; ctx: RepoContext }
  | { ok: false; status: number; error: string };

export async function resolveRepoContext(): Promise<ContextResult> {
  if (!isGitHubConfigured()) {
    return { ok: false, status: 501, error: "GitHub App not configured" };
  }
  const session = await getSession();
  if (!session.user) {
    return { ok: false, status: 401, error: "Not signed in" };
  }
  const target = session.target;
  if (!target?.owner || !target.repo) {
    return { ok: false, status: 400, error: "No target repository selected" };
  }
  try {
    const octokit = await getInstallationOctokit(target.owner, target.repo);
    // Read authorisation: the signed-in user must own the repo or be a
    // collaborator on it. Without this, any signed-in user could read another
    // learner's private evidence by pointing `target` at their repo.
    if (!(await canRead(octokit, target.owner, target.repo, session.user.login))) {
      return {
        ok: false,
        status: 403,
        error: "You do not have access to this repository",
      };
    }
    return {
      ok: true,
      ctx: {
        octokit,
        owner: target.owner,
        repo: target.repo,
        login: session.user.login,
        name: session.user.name,
      },
    };
  } catch {
    return {
      ok: false,
      status: 409,
      error: `The DataFolio GitHub App is not installed on ${target.owner}/${target.repo}.`,
    };
  }
}
