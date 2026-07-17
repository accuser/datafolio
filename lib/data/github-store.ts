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

export function createGitHubStore(ctx: GitHubStoreContext) {
  const { octokit, owner, repo } = ctx;

  async function defaultBranch(): Promise<string> {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
    return data.default_branch;
  }

  async function loadAll(): Promise<{ evidence: Evidence[]; branch: string }> {
    const branch = await defaultBranch();
    const { data: tree } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      { owner, repo, tree_sha: branch, recursive: "true" },
    );
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
    return { evidence, branch };
  }

  /** Atomically commit the regenerated index.md of each affected folder (plus any
   *  uploaded file blobs) as a single commit. */
  async function commit(
    branch: string,
    ksbIds: string[],
    all: Evidence[],
    message: string,
    uploads: { path: string; contentBase64: string }[] = [],
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
      sha?: string;
    }[] = ksbIds
      .filter((id) => KSB_BY_ID[id])
      .map((id) => ({
        path: `evidence/${id}/index.md`,
        mode: "100644",
        type: "blob",
        content: renderIndexMd(KSB_BY_ID[id], primaryItems(all, id), all),
      }));

    for (const up of uploads) {
      const { data: blob } = await octokit.request(
        "POST /repos/{owner}/{repo}/git/blobs",
        { owner, repo, content: up.contentBase64, encoding: "base64" },
      );
      treeEntries.push({ path: up.path, mode: "100644", type: "blob", sha: blob.sha });
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
      const { evidence: current, branch } = await loadAll();
      const all = [item, ...current];
      const uploads: { path: string; contentBase64: string }[] = [];
      if (item.type === "upload" && item.fileName && opts.fileContentBase64) {
        uploads.push({
          path: `evidence/${primaryRoot(item)}/${item.fileName}`,
          contentBase64: opts.fileContentBase64,
        });
      }
      await commit(branch, affectedFolders(item), all, `Add evidence: ${item.title}`, uploads);
      return all;
    },

    async updateEvidence(id: string, patch: Partial<Evidence>): Promise<Evidence[]> {
      const { evidence: current, branch } = await loadAll();
      const target = current.find((e) => e.id === id);
      if (!target) throw new Error(`Evidence ${id} not found`);
      const all = current.map((e) => (e.id === id ? { ...e, ...patch } : e));
      const updated = all.find((e) => e.id === id)!;
      await commit(
        branch,
        affectedFolders(updated),
        all,
        `Review evidence: ${updated.title} → ${updated.status}`,
      );
      return all;
    },
  };
}

export type GitHubStore = ReturnType<typeof createGitHubStore>;
