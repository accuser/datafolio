import "server-only";
import type { Octokit } from "@octokit/core";
import { renderIndexMd, rootOf } from "../domain";
import { getStandard, ksbIndex, type Ksb, type Standard } from "../standards";
import { MANIFEST_PATH, readManifest } from "../standards/manifest";
import { parseIndexMd } from "../github/frontmatter";
import { commitTree, withConflictRetry, type TreeEntry } from "../github/commit";
import { sanitizeFileName } from "./uploads";
import type { AddOptions, StoreLoad } from "./store";
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

/**
 * The single folder an item is physically stored in (its primary KSB).
 *
 * An item always has at least one mapping — validation rejects an empty list —
 * so the empty case is unreachable in practice. It returns "" rather than a
 * guessed KSB code so an unmapped item is filtered out downstream instead of
 * being silently filed under whichever KSB happens to be first.
 */
function primaryRoot(item: Evidence): string {
  return item.ksbIds.length ? rootOf(item.ksbIds[0]) : "";
}

/** Items primary to a given KSB folder (each item lives in exactly one folder). */
function primaryItems(all: Evidence[], ksbId: string): Evidence[] {
  return all.filter((e) => primaryRoot(e) === ksbId);
}

/** Every KSB folder an item touches — its primary folder plus each other KSB it
 *  maps to (whose sub-point coverage / derived status changes). */
function affectedFolders(item: Evidence, byId: Record<string, Ksb>): string[] {
  const roots = new Set(item.ksbIds.map(rootOf));
  const primary = primaryRoot(item);
  if (primary) roots.add(primary);
  return [...roots].filter((id) => byId[id]);
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
  blobShas: Map<string, string>,
): string {
  const taken = (name: string) => blobShas.has(`evidence/${folder}/${name}`);
  if (!taken(fileName)) return fileName;
  const [stem, ext] = splitExtension(fileName);
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!taken(candidate)) return candidate;
  }
}

/**
 * Resolve just the standard a repo follows, without loading its evidence.
 *
 * Write routes need this to validate a KSB mapping before they touch the store,
 * so it reads datafolio.yml directly (one call, absent → the default standard)
 * rather than paying for a full tree walk.
 */
export async function resolveStandard(
  ctx: GitHubStoreContext,
): Promise<Standard> {
  const { octokit, owner, repo } = ctx;
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      { owner, repo, path: MANIFEST_PATH },
    );
    const content =
      typeof data === "object" && data !== null && "content" in data
        ? String((data as { content?: unknown }).content ?? "")
        : "";
    const text = content
      ? Buffer.from(content, "base64").toString("utf8")
      : null;
    return getStandard(readManifest(text).standardId);
  } catch {
    // No manifest (404) or unreadable — an ST0585 portfolio, as before.
    return getStandard(null);
  }
}

export function createGitHubStore(ctx: GitHubStoreContext) {
  const { octokit, owner, repo } = ctx;

  async function defaultBranch(): Promise<string> {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
    return data.default_branch;
  }

  async function readBlob(sha: string): Promise<string> {
    const { data: blob } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
      { owner, repo, file_sha: sha },
    );
    return Buffer.from(blob.content, "base64").toString("utf8");
  }

  async function loadAll(): Promise<{
    evidence: Evidence[];
    branch: string;
    /** The standard this portfolio follows, per its datafolio.yml. */
    standard: Standard;
    /** Set when the manifest named a standard that could not be used. */
    manifestWarning?: string;
    /** Every blob path in the tree → its sha, so a writer can spot a name that
     *  would collide with an existing file, a remap can move an uploaded file by
     *  referencing its existing blob (no re-upload), and a delete can skip paths
     *  that aren't actually there. */
    blobShas: Map<string, string>;
  }> {
    const branch = await defaultBranch();
    const { data: tree } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      { owner, repo, tree_sha: branch, recursive: "true" },
    );
    const blobShas = new Map<string, string>();
    for (const t of tree.tree) {
      if (t.type === "blob" && t.path && t.sha) blobShas.set(t.path, t.sha);
    }
    // The manifest is read from the same tree listing, so resolving the standard
    // costs one extra blob fetch only when the file is actually present.
    const manifestSha = blobShas.get(MANIFEST_PATH);
    const manifest = readManifest(
      manifestSha ? await readBlob(manifestSha) : null,
    );
    const standard = getStandard(manifest.standardId);

    const indexFiles = tree.tree.filter(
      (t) => t.type === "blob" && t.path && t.sha && INDEX_RE.test(t.path),
    );
    const folders = await Promise.all(
      indexFiles.map(async (f) => parseIndexMd(await readBlob(f.sha!))),
    );
    const evidence = dedupById(folders.flatMap((p) => p.evidence));
    return {
      evidence,
      branch,
      standard,
      ...(manifest.warning ? { manifestWarning: manifest.warning } : {}),
      blobShas,
    };
  }

  /** Atomically commit the regenerated index.md of each affected folder (plus any
   *  uploaded file blobs) as a single commit. */
  async function commit(
    branch: string,
    standard: Standard,
    ksbIds: string[],
    all: Evidence[],
    message: string,
    uploads: { path: string; contentBase64: string }[] = [],
    deletions: string[] = [],
    // Relocate an existing blob within the same commit (used when an upload's
    // primary folder changes): write it at `toPath` by reference and drop
    // `fromPath`, so the file follows its item instead of being orphaned.
    moves: { fromPath: string; toPath: string; sha: string }[] = [],
  ): Promise<void> {
    const treeEntries: TreeEntry[] = (() => {
      const byId = ksbIndex(standard);
      return ksbIds
        .filter((id) => byId[id])
        .map((id) => ({
          path: `evidence/${id}/index.md`,
          mode: "100644" as const,
          type: "blob" as const,
          content: renderIndexMd(byId[id], primaryItems(all, id), all),
        }));
    })();

    for (const up of uploads) {
      const { data: blob } = await octokit.request(
        "POST /repos/{owner}/{repo}/git/blobs",
        { owner, repo, content: up.contentBase64, encoding: "base64" },
      );
      treeEntries.push({ path: up.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    // Move a blob by re-pointing its bytes at the new path and removing the old
    // one — no download/re-upload, both in this one commit.
    for (const mv of moves) {
      treeEntries.push({ path: mv.toPath, mode: "100644", type: "blob", sha: mv.sha });
      treeEntries.push({ path: mv.fromPath, mode: "100644", type: "blob", sha: null });
    }

    // A tree entry with sha:null removes the path from the tree (deleted file).
    for (const path of deletions) {
      treeEntries.push({ path, mode: "100644", type: "blob", sha: null });
    }

    await commitTree(octokit, owner, repo, branch, treeEntries, message);
  }

  return {
    async load(): Promise<StoreLoad> {
      const { evidence, standard, manifestWarning } = await loadAll();
      return {
        evidence,
        standardId: standard.id,
        ...(manifestWarning ? { manifestWarning } : {}),
      };
    },

    async addEvidence(item: Evidence, opts: AddOptions = {}): Promise<Evidence[]> {
      // Defence in depth: never trust a filename as a tree path, even though the
      // API route already sanitises it. Keep the stored name and the committed
      // blob path in lock-step.
      if (item.type === "upload" && item.fileName) {
        item = { ...item, fileName: sanitizeFileName(item.fileName) };
      }
      return withConflictRetry(async () => {
        const { evidence: current, branch, standard, blobShas } = await loadAll();
        const byId = ksbIndex(standard);
        const uploads: { path: string; contentBase64: string }[] = [];
        if (item.type === "upload" && item.fileName && opts.fileContentBase64) {
          // De-dupe against files already in the folder so a same-named upload
          // can't silently clobber another item's blob. Store the resolved name
          // on the item so index.md and the committed blob path stay in step.
          const folder = primaryRoot(item);
          const fileName = uniqueFileName(folder, item.fileName, blobShas);
          item = { ...item, fileName };
          uploads.push({
            path: `evidence/${folder}/${fileName}`,
            contentBase64: opts.fileContentBase64,
          });
        }
        const all = [item, ...current];
        await commit(
          branch,
          standard,
          affectedFolders(item, byId),
          all,
          `Add evidence: ${item.title}`,
          uploads,
        );
        return all;
      });
    },

    async updateEvidence(id: string, patch: Partial<Evidence>): Promise<Evidence[]> {
      return withConflictRetry(async () => {
        const { evidence: current, branch, standard, blobShas } = await loadAll();
        const byId = ksbIndex(standard);
        const target = current.find((e) => e.id === id);
        if (!target) throw new Error(`Evidence ${id} not found`);
        let updated: Evidence = { ...target, ...patch };

        // If a remap moved an upload's primary folder, relocate its file too, or
        // the new folder's index.md links a `./file` that lives elsewhere and the
        // eventual delete targets a path that no longer holds the blob. De-dupe
        // the destination name (same rule as addEvidence) so the move can't
        // clobber a file already in the new folder, and keep the item's stored
        // fileName in step with the moved blob path.
        const moves: { fromPath: string; toPath: string; sha: string }[] = [];
        if (target.type === "upload" && target.fileName) {
          const oldRoot = primaryRoot(target);
          const newRoot = primaryRoot(updated);
          if (oldRoot !== newRoot) {
            const fromPath = `evidence/${oldRoot}/${target.fileName}`;
            const sha = blobShas.get(fromPath);
            if (sha) {
              const fileName = uniqueFileName(newRoot, target.fileName, blobShas);
              updated = { ...updated, fileName };
              moves.push({ fromPath, toPath: `evidence/${newRoot}/${fileName}`, sha });
            }
          }
        }

        const all = current.map((e) => (e.id === id ? updated : e));
        // Regenerate the item's folders AND any it used to map to — otherwise a
        // remap leaves a stale copy in the old folder's index.md forever.
        const folders = [
          ...new Set([
            ...affectedFolders(target, byId),
            ...affectedFolders(updated, byId),
          ]),
        ];
        await commit(
          branch,
          standard,
          folders,
          all,
          `Review evidence: ${updated.title} → ${updated.status}`,
          [],
          [],
          moves,
        );
        return all;
      });
    },

    async deleteEvidence(id: string): Promise<Evidence[]> {
      return withConflictRetry(async () => {
        const { evidence: current, branch, standard, blobShas } = await loadAll();
        const byId = ksbIndex(standard);
        const target = current.find((e) => e.id === id);
        if (!target) throw new Error(`Evidence ${id} not found`);
        const all = current.filter((e) => e.id !== id);
        // Remove the uploaded file blob too, so no orphan is left behind. Only if
        // it's actually there — deleting a path absent from the tree would 422
        // the whole commit.
        const filePath =
          target.type === "upload" && target.fileName
            ? `evidence/${primaryRoot(target)}/${target.fileName}`
            : "";
        const deletions = filePath && blobShas.has(filePath) ? [filePath] : [];
        await commit(
          branch,
          standard,
          affectedFolders(target, byId),
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
