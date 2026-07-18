import "server-only";
import type { Octokit } from "@octokit/core";
import { KSB_BY_ID } from "../ksbs";
import { renderIndexMd, rootOf } from "../domain";
import { parseIndexMd } from "../github/frontmatter";
import { sanitizeFileName } from "./uploads";
import type { AddOptions } from "./store";
import type { Evidence } from "../types";

// Server-side evidence store backed by a learner's private GitHub repo. Reads
// evidence from every evidence/<KSB>/index.md; writes are atomic commits via the
// Git Data API. Constructed per-request from an installation-scoped Octokit.

export interface GitHubStoreContext {
  octokit: Octokit;
  owner: string;
  repo: string;
}

const INDEX_RE = /^evidence\/([^/]+)\/index\.md$/;

/** The single folder an item is physically stored in (its primary KSB). */
function primaryRoot(item: Evidence): string {
  return item.ksbIds.length ? rootOf(item.ksbIds[0]) : "K1";
}

/** Items primary to a given KSB folder (each item lives in exactly one folder). */
function primaryItems(all: Evidence[], ksbId: string): Evidence[] {
  return all.filter((e) => primaryRoot(e) === ksbId);
}

/** Every KSB folder an item touches — its primary folder plus each other KSB it
 *  maps to (whose sub-point coverage / derived status changes). */
function affectedFolders(item: Evidence): string[] {
  const roots = new Set(item.ksbIds.map(rootOf));
  roots.add(primaryRoot(item));
  return [...roots].filter((id) => KSB_BY_ID[id]);
}

function dedupById(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  return items.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

/** Split a filename into [stem, extension-with-dot]; ext is "" when there is none. */
function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
}

/**
 * A filename that won't overwrite an existing blob in `folder`. If
 * `evidence/<folder>/<fileName>` is already taken in the tree, suffix the
 * basename (`deck.pdf` → `deck-2.pdf` → `deck-3.pdf` …) until the path is free.
 * The caller stores the returned name on the item so index.md's `./<file>` link
 * and the committed blob path stay in lock-step.
 */
function uniqueFileName(
  folder: string,
  fileName: string,
  blobShas: Record<string, string>,
): string {
  const taken = (name: string) => `evidence/${folder}/${name}` in blobShas;
  if (!taken(fileName)) return fileName;
  const [stem, ext] = splitExtension(fileName);
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!taken(candidate)) return candidate;
  }
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
async function withConflictRetry<T>(fn: () => Promise<T>): Promise<T> {
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

export function createGitHubStore(ctx: GitHubStoreContext) {
  const { octokit, owner, repo } = ctx;

  async function defaultBranch(): Promise<string> {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
    return data.default_branch;
  }

  async function loadAll(): Promise<{
    evidence: Evidence[];
    branch: string;
    blobShas: Record<string, string>;
  }> {
    const branch = await defaultBranch();
    const { data: tree } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      { owner, repo, tree_sha: branch, recursive: "true" },
    );
    // Path → sha for every blob already in the tree, so a writer can tell when a
    // filename would collide with an existing file before committing over it.
    const blobShas: Record<string, string> = {};
    for (const t of tree.tree) {
      if (t.type === "blob" && t.path && t.sha) blobShas[t.path] = t.sha;
    }
    const indexFiles = tree.tree.filter(
      (t) => t.type === "blob" && t.path && t.sha && INDEX_RE.test(t.path),
    );
    const folders = await Promise.all(
      indexFiles.map(async (f) => {
        const { data: blob } = await octokit.request(
          "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
          { owner, repo, file_sha: f.sha! },
        );
        const md = Buffer.from(blob.content, "base64").toString("utf8");
        return parseIndexMd(md);
      }),
    );
    const evidence = dedupById(folders.flatMap((p) => p.evidence));
    return { evidence, branch, blobShas };
  }

  /** Atomically commit the regenerated index.md of each affected folder (plus any
   *  uploaded file blobs) as a single commit. */
  async function commit(
    branch: string,
    ksbIds: string[],
    all: Evidence[],
    message: string,
    uploads: { path: string; contentBase64?: string; sha?: string }[] = [],
    deletions: string[] = [],
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

    const treeEntries: {
      path: string;
      mode: "100644";
      type: "blob";
      content?: string;
      sha?: string | null;
    }[] = ksbIds
      .filter((id) => KSB_BY_ID[id])
      .map((id) => ({
        path: `evidence/${id}/index.md`,
        mode: "100644",
        type: "blob",
        content: renderIndexMd(KSB_BY_ID[id], primaryItems(all, id), all),
      }));

    for (const up of uploads) {
      // Fresh bytes become a new blob; a moved file re-points an existing blob to
      // a new path by its sha, so no re-upload is needed.
      let sha = up.sha;
      if (!sha && up.contentBase64 !== undefined) {
        const { data: blob } = await octokit.request(
          "POST /repos/{owner}/{repo}/git/blobs",
          { owner, repo, content: up.contentBase64, encoding: "base64" },
        );
        sha = blob.sha;
      }
      treeEntries.push({ path: up.path, mode: "100644", type: "blob", sha });
    }

    // A tree entry with sha:null removes the path from the tree (deleted file).
    for (const path of deletions) {
      treeEntries.push({ path, mode: "100644", type: "blob", sha: null });
    }

    const { data: newTree } = await octokit.request(
      "POST /repos/{owner}/{repo}/git/trees",
      { owner, repo, base_tree: baseCommit.tree.sha, tree: treeEntries },
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

  return {
    async load(): Promise<Evidence[]> {
      const { evidence } = await loadAll();
      return evidence;
    },

    async addEvidence(item: Evidence, opts: AddOptions = {}): Promise<Evidence[]> {
      // Defence in depth: never trust a filename as a tree path, even though the
      // API route already sanitises it. Keep the stored name and the committed
      // blob path in lock-step.
      if (item.type === "upload" && item.fileName) {
        item = { ...item, fileName: sanitizeFileName(item.fileName) };
      }
      return withConflictRetry(async () => {
        const { evidence: current, branch, blobShas } = await loadAll();
        const uploads: { path: string; contentBase64: string }[] = [];
        if (item.type === "upload" && item.fileName && opts.fileContentBase64) {
          // De-dupe against files already in the folder so a same-named upload
          // can't silently clobber another item's blob. Store the resolved name
          // on the item so index.md and the committed blob path stay in lock-step.
          const folder = primaryRoot(item);
          const fileName = uniqueFileName(folder, item.fileName, blobShas);
          item = { ...item, fileName };
          uploads.push({
            path: `evidence/${folder}/${fileName}`,
            contentBase64: opts.fileContentBase64,
          });
        }
        const all = [item, ...current];
        await commit(branch, affectedFolders(item), all, `Add evidence: ${item.title}`, uploads);
        return all;
      });
    },

    async updateEvidence(id: string, patch: Partial<Evidence>): Promise<Evidence[]> {
      return withConflictRetry(async () => {
        const { evidence: current, branch, blobShas } = await loadAll();
        const target = current.find((e) => e.id === id);
        if (!target) throw new Error(`Evidence ${id} not found`);
        let updated: Evidence = { ...target, ...patch };

        // If a remap moved an upload to a new primary folder, move its file blob
        // too — otherwise the new folder's `./<file>` link points at nothing and
        // the old folder keeps an orphan. De-dupe on arrival (same rule as
        // addEvidence) and keep the item's stored fileName in step.
        const uploads: { path: string; sha: string }[] = [];
        const deletions: string[] = [];
        if (updated.type === "upload" && updated.fileName) {
          const oldFolder = primaryRoot(target);
          const newFolder = primaryRoot(updated);
          const oldPath = `evidence/${oldFolder}/${target.fileName}`;
          if (newFolder !== oldFolder && blobShas[oldPath]) {
            const fileName = uniqueFileName(newFolder, updated.fileName, blobShas);
            updated = { ...updated, fileName };
            uploads.push({ path: `evidence/${newFolder}/${fileName}`, sha: blobShas[oldPath] });
            deletions.push(oldPath);
          }
        }

        const all = current.map((e) => (e.id === id ? updated : e));
        // Regenerate the item's folders AND any it used to map to — otherwise a
        // remap leaves a stale copy in the old folder's index.md forever.
        const folders = [
          ...new Set([...affectedFolders(target), ...affectedFolders(updated)]),
        ];
        await commit(
          branch,
          folders,
          all,
          `Review evidence: ${updated.title} → ${updated.status}`,
          uploads,
          deletions,
        );
        return all;
      });
    },

    async deleteEvidence(id: string): Promise<Evidence[]> {
      return withConflictRetry(async () => {
        const { evidence: current, branch } = await loadAll();
        const target = current.find((e) => e.id === id);
        if (!target) throw new Error(`Evidence ${id} not found`);
        const all = current.filter((e) => e.id !== id);
        // Remove the uploaded file blob too, so no orphan is left behind.
        const deletions =
          target.type === "upload" && target.fileName
            ? [`evidence/${primaryRoot(target)}/${target.fileName}`]
            : [];
        await commit(
          branch,
          affectedFolders(target),
          all,
          `Delete evidence: ${target.title}`,
          [],
          deletions,
        );
        return all;
      });
    },
  };
}

export type GitHubStore = ReturnType<typeof createGitHubStore>;
