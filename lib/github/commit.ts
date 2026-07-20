import "server-only";
import type { Octokit } from "@octokit/core";

// The Git Data API dance shared by every DataFolio write: build a tree on top of
// the branch head, commit it, and fast-forward the ref. Extracted so the
// evidence store and the card store commit the same way — one commit per user
// action, however many files it touches — rather than each growing its own
// slightly different version.

/** A file to write (`content`), reference by sha, or delete (`sha: null`). */
export interface TreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  content?: string;
  sha?: string | null;
}

/** Shown when concurrent commits still conflict after all retries. */
export const CONFLICT_MESSAGE =
  "The repository changed while saving. Please try again.";

/** A non-fast-forward ref update — someone else committed first (GitHub 422). */
function isFastForwardConflict(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  const msg = String((e as { message?: string } | null)?.message ?? "");
  return status === 422 && /fast[ -]?forward/i.test(msg);
}

/**
 * Run a read-modify-write and retry it from a fresh read if the final ref
 * update lost a race. Each attempt re-loads, so the retry re-applies the
 * mutation on top of the winning commit rather than clobbering it.
 */
export async function withConflictRetry<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (isFastForwardConflict(e)) {
        if (attempt < MAX_ATTEMPTS) continue;
        throw new Error(CONFLICT_MESSAGE);
      }
      throw e;
    }
  }
}

/**
 * Commit `entries` to `branch` as one commit on top of its current head.
 *
 * The ref update is a fast-forward, so a concurrent commit makes this throw a
 * 422 rather than silently overwriting — which is what `withConflictRetry` is
 * for. Callers must read inside the retry, not outside it.
 */
export async function commitTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  entries: TreeEntry[],
  message: string,
): Promise<void> {
  const { data: ref } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    { owner, repo, ref: `heads/${branch}` },
  );
  const baseCommitSha = ref.object.sha;
  const { data: baseCommit } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
    { owner, repo, commit_sha: baseCommitSha },
  );
  const { data: newTree } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/trees",
    { owner, repo, base_tree: baseCommit.tree.sha, tree: entries },
  );
  const { data: newCommit } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/commits",
    { owner, repo, message, tree: newTree.sha, parents: [baseCommitSha] },
  );
  await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });
}
