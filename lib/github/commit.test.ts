/**
 * Concurrency tests for the shared commit path. A fake repo tracks a real HEAD
 * and enforces GitHub's fast-forward rule on the ref update, so a commit built
 * on a stale read is rejected here exactly as it would be by GitHub — which is
 * what makes the lost-update case testable at all.
 * Run: `npx tsx --conditions=react-server lib/github/commit.test.ts`.
 */
import type { Octokit } from "@octokit/core";
import {
  CONFLICT_MESSAGE,
  RefMovedError,
  commitTree,
  withConflictRetry,
  type TreeEntry,
} from "./commit";
import { readRepoTree } from "./repo-tree";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

async function rejects(fn: () => Promise<unknown>, msg: string): Promise<Error> {
  try {
    await fn();
  } catch (e) {
    return e as Error;
  }
  throw new Error("ASSERT FAILED: expected a rejection — " + msg);
}

const ENTRY: TreeEntry[] = [
  { path: "evidence/K4/index.md", mode: "100644", type: "blob", content: "x" },
];

/**
 * An in-memory repo with a moving HEAD.
 *
 * `landConcurrentCommit()` is the other writer: it advances HEAD the way a
 * reviewer approving evidence would, so a test can drop it into the window
 * between a caller's read and its write.
 */
function makeRepo() {
  let head = "C1";
  let counter = 0;
  // Every commit we hand out, so the ref update can check ancestry properly.
  const parentOf = new Map<string, string>();
  const state = { refUpdates: 0, treeWrites: 0, basedOn: [] as string[] };

  const octokit = {
    async request(route: string, params: Record<string, unknown>) {
      switch (route) {
        case "GET /repos/{owner}/{repo}":
          return { data: { default_branch: "main" } };
        case "GET /repos/{owner}/{repo}/git/ref/{ref}":
          return { data: { object: { sha: head } } };
        case "GET /repos/{owner}/{repo}/git/trees/{tree_sha}":
          return { data: { tree: [] } };
        case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}":
          state.basedOn.push(params.commit_sha as string);
          return { data: { tree: { sha: `T-${params.commit_sha}` } } };
        case "POST /repos/{owner}/{repo}/git/trees":
          state.treeWrites++;
          return { data: { sha: `tree-${++counter}` } };
        case "POST /repos/{owner}/{repo}/git/commits": {
          const sha = `commit-${++counter}`;
          parentOf.set(sha, (params.parents as string[])[0]);
          return { data: { sha } };
        }
        case "PATCH /repos/{owner}/{repo}/git/refs/{ref}": {
          const sha = params.sha as string;
          // GitHub's rule: the update must fast-forward, i.e. the new commit
          // must descend from the current tip. A commit whose parent is a stale
          // HEAD does not, and is rejected 422 rather than silently applied.
          if (parentOf.get(sha) !== head) {
            throw Object.assign(new Error("Update is not a fast forward"), {
              status: 422,
            });
          }
          head = sha;
          state.refUpdates++;
          return { data: {} };
        }
        default:
          throw new Error("Unexpected route: " + route);
      }
    },
  } as unknown as Octokit;

  const ctx = { octokit, owner: "lucy-ds", repo: "portfolio-evidence" };
  return {
    ctx,
    state,
    head: () => head,
    landConcurrentCommit() {
      head = `C-other-${++counter}`;
      parentOf.set(head, "unrelated");
    },
  };
}

const commit = (repo: ReturnType<typeof makeRepo>, headSha: string) =>
  commitTree(repo.ctx.octokit, "lucy-ds", "portfolio-evidence", "main", headSha, ENTRY, "msg");

async function main() {
  // --- the snapshot pins a concrete commit, not a branch name ---
  {
    const repo = makeRepo();
    const tree = await readRepoTree(repo.ctx);
    assert(tree.headSha === "C1", `snapshot records the head commit, got ${tree.headSha}`);
    assert(tree.branch === "main", "snapshot records the default branch");
  }

  // --- a clean write commits on the head it read ---
  {
    const repo = makeRepo();
    const tree = await readRepoTree(repo.ctx);
    await commit(repo, tree.headSha);
    assert(repo.state.refUpdates === 1, "the ref moved once");
    assert(repo.state.basedOn[0] === "C1", "the commit was built on the head that was read");
  }

  // --- THE REGRESSION (#51): a commit built on a stale read must not land ---
  // Before the fix, commitTree re-read the ref and parented onto whatever it
  // found, so this sequence fast-forwarded cleanly and silently discarded the
  // concurrent commit's changes.
  {
    const repo = makeRepo();
    const tree = await readRepoTree(repo.ctx); // reader sees C1
    repo.landConcurrentCommit(); // a reviewer approves; HEAD moves on
    const err = await rejects(() => commit(repo, tree.headSha), "stale write is rejected");
    assert(err instanceof RefMovedError, `stale write raises RefMovedError, got ${err.name}`);
    assert(repo.state.refUpdates === 0, "the losing write never moved the ref");
  }

  // --- a conflict is retried from a fresh read, and the retry wins ---
  {
    const repo = makeRepo();
    let attempts = 0;
    await withConflictRetry(async () => {
      attempts++;
      const tree = await readRepoTree(repo.ctx);
      // Only the first attempt races; the retry re-reads the winning head.
      if (attempts === 1) repo.landConcurrentCommit();
      await commit(repo, tree.headSha);
    });
    assert(attempts === 2, `the write was retried once, got ${attempts} attempts`);
    assert(repo.state.refUpdates === 1, "exactly one commit ultimately landed");
  }

  // --- sustained contention gives up with a message the UI can show ---
  {
    const repo = makeRepo();
    let attempts = 0;
    const err = await rejects(
      () =>
        withConflictRetry(async () => {
          attempts++;
          const tree = await readRepoTree(repo.ctx);
          repo.landConcurrentCommit(); // loses every time
          await commit(repo, tree.headSha);
        }),
      "persistent conflict eventually surfaces",
    );
    assert(attempts === 3, `retries are bounded at 3 attempts, got ${attempts}`);
    assert(err.message === CONFLICT_MESSAGE, "the caller gets the conflict message, not a 422");
    assert(!(err instanceof RefMovedError), "the internal error type does not leak to the UI");
  }

  // --- an empty commit is a caller bug, not a silent success (#52) ---
  {
    const repo = makeRepo();
    const err = await rejects(
      () =>
        commitTree(
          repo.ctx.octokit,
          "lucy-ds",
          "portfolio-evidence",
          "main",
          "C1",
          [],
          "nothing to do",
        ),
      "committing no entries throws",
    );
    assert(/Refusing to commit nothing/.test(err.message), "the empty-commit guard explains itself");
    assert(repo.state.treeWrites === 0, "no tree was written for an empty commit");
  }

  console.log("COMMIT OK — stale writes are rejected, retried from a fresh read, and bounded");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
