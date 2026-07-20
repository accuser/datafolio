import "server-only";
import type { Octokit } from "@octokit/core";

// A single read of the learner's repo, shared by the evidence store and the card
// store. Both used to walk the tree themselves, with the same three calls and
// the same base64 decode written out twice; this is that walk, once.
//
// The important part is `headSha`. Reading the tree by *branch name* gives no
// way to tell whether the branch moved before the write lands, so a commit built
// on that read could fast-forward cleanly over someone else's commit and silently
// drop it. Every snapshot therefore pins the head it was taken at, and every
// write derived from it commits with that head as its parent.

export interface RepoRef {
  octokit: Octokit;
  owner: string;
  repo: string;
}

export interface RepoTree {
  /** The repo's default branch — where DataFolio commits. */
  branch: string;
  /**
   * The head commit this snapshot was taken at.
   *
   * Pass it to `commitTree` as the expected parent: if the branch has moved on
   * since, the ref update is no longer a fast-forward and the write fails loudly
   * instead of clobbering the winner.
   */
  headSha: string;
  /**
   * Every blob path in the tree → its sha, so a writer can spot a name that
   * would collide with an existing file, a remap can move an uploaded file by
   * referencing its existing blob (no re-upload), and a delete can skip paths
   * that aren't actually there.
   */
  blobShas: Map<string, string>;
}

/** Snapshot the default branch: its head commit and every blob path in its tree. */
export async function readRepoTree({ octokit, owner, repo }: RepoRef): Promise<RepoTree> {
  const { data: repoData } = await octokit.request("GET /repos/{owner}/{repo}", {
    owner,
    repo,
  });
  const branch = repoData.default_branch;

  // Resolve the branch to a concrete commit *before* reading the tree, so the
  // snapshot and the sha we later commit against describe the same instant.
  const { data: ref } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    { owner, repo, ref: `heads/${branch}` },
  );
  const headSha = ref.object.sha;

  const { data: tree } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    { owner, repo, tree_sha: headSha, recursive: "true" },
  );
  const blobShas = new Map<string, string>();
  for (const t of tree.tree) {
    if (t.type === "blob" && t.path && t.sha) blobShas.set(t.path, t.sha);
  }
  return { branch, headSha, blobShas };
}

/** Read a blob's bytes as UTF-8 text. */
export async function readBlob(
  { octokit, owner, repo }: RepoRef,
  sha: string,
): Promise<string> {
  const { data: blob } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
    { owner, repo, file_sha: sha },
  );
  return Buffer.from(blob.content, "base64").toString("utf8");
}

/**
 * Parse every blob in the snapshot whose path matches `pattern`, de-duplicating
 * the results by id.
 *
 * Both stores keep their content in one file per KSB folder and both need the
 * same guard: a hand-edited repo could list the same item in two folders, and
 * loading both copies would make an edit look like it only half-applied.
 */
export async function readFolders<T extends { id: string }>(
  ctx: RepoRef,
  tree: RepoTree,
  pattern: RegExp,
  parse: (markdown: string) => { items: T[] },
): Promise<T[]> {
  const paths = [...tree.blobShas].filter(([path]) => pattern.test(path));
  const folders = await Promise.all(
    paths.map(async ([, sha]) => parse(await readBlob(ctx, sha))),
  );
  const seen = new Set<string>();
  return folders
    .flatMap((f) => f.items)
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
