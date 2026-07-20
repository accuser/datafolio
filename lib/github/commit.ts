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

/**
 * The branch moved between the caller's read and this commit's ref update.
 *
 * Raised only from the ref PATCH, so it can't be confused with a 422 from an
 * invalid tree entry, and identified by type rather than by matching GitHub's
 * error prose — which is free to be reworded without warning.
 */
export class RefMovedError extends Error {
  constructor() {
    super("The branch moved while committing");
    this.name = "RefMovedError";
  }
}

/**
 * Delays before each retry. Concurrent writers that just collided would
 * otherwise re-read, rebuild and re-PATCH in lockstep and collide again, so the
 * wait is randomised across the window rather than fixed.
 */
const RETRY_DELAYS_MS = [100, 400];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a read-modify-write and retry it from a fresh read if the commit lost a
 * race. Each attempt re-reads, so the retry re-applies the mutation on top of
 * the winning commit rather than clobbering it.
 */
export async function withConflictRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof RefMovedError)) throw e;
      const window = RETRY_DELAYS_MS[attempt];
      if (window === undefined) throw new Error(CONFLICT_MESSAGE);
      await sleep(Math.random() * window);
    }
  }
}

/**
 * Commit `entries` to `branch` as one commit on top of `expectedHeadSha`.
 *
 * `expectedHeadSha` must be the head the caller *read* — see `readRepoTree`.
 * Using it as the new commit's parent is what makes a concurrent write
 * detectable: if the branch has moved on, the new commit no longer descends
 * from the branch tip, the ref update is not a fast-forward, and GitHub rejects
 * it. Building on whatever the ref happens to say at commit time would instead
 * fast-forward cleanly *over* the other writer, and because each index.md is
 * regenerated wholesale rather than patched, their evidence would simply be
 * gone. `withConflictRetry` turns the rejection into a fresh read and re-apply.
 */
export async function commitTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  expectedHeadSha: string,
  entries: TreeEntry[],
  message: string,
): Promise<void> {
  // A caller that reduced its entries to nothing has a bug: it is about to
  // report success for a commit that was never made. Fail instead of no-opping.
  if (!entries.length) {
    throw new Error(`Refusing to commit nothing to ${owner}/${repo} (${message})`);
  }
  const { data: baseCommit } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
    { owner, repo, commit_sha: expectedHeadSha },
  );
  const { data: newTree } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/trees",
    { owner, repo, base_tree: baseCommit.tree.sha, tree: entries },
  );
  const { data: newCommit } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/commits",
    { owner, repo, message, tree: newTree.sha, parents: [expectedHeadSha] },
  );
  try {
    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
      // Never force: the whole conflict-detection scheme rests on this update
      // being rejected when it isn't a fast-forward.
      force: false,
    });
  } catch (e) {
    if ((e as { status?: number } | null)?.status === 422) throw new RefMovedError();
    throw e;
  }
}
