/**
 * Network-free integration test for the GitHub-backed store. A fake Octokit
 * serves an in-memory repo (two evidence folders) and captures the Git Data
 * write calls, so we can assert load/add/update produce correct, atomic commits
 * without touching GitHub. Run: `npx tsx lib/data/github-store.test.ts`.
 */
import type { Octokit } from "@octokit/core";
import { KSB_BY_ID } from "../ksbs";
import { genMd } from "../domain";
import type { Evidence } from "../types";
import { createGitHubStore } from "./github-store";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

// Seed evidence: itemA primary K4 (maps K4.2), itemB primary S4 (reflection).
const itemA: Evidence = {
  id: "a1", ksbIds: ["K4.2"], type: "github", title: "Churn model",
  url: "github.com/x/y/blob/main/churn.ipynb", note: "", status: "Submitted",
  date: "2 Jul 2026", feedback: "",
};
const itemB: Evidence = {
  id: "b1", ksbIds: ["S4"], type: "reflection", title: "Validation reflection",
  note: "First line.\n\nSecond paragraph.", status: "Approved",
  date: "1 Jun 2026", feedback: "Solid.",
};

// The fake repo's blobs, keyed by a synthetic sha.
const blobs: Record<string, string> = {
  "sha-K4": genMd([itemA, itemB], KSB_BY_ID["K4"]),
  "sha-S4": genMd([itemA, itemB], KSB_BY_ID["S4"]),
};

interface CapturedTree {
  base_tree: string;
  tree: { path: string; content?: string; sha?: string }[];
}
const captured: { trees: CapturedTree[]; commits: number; refUpdates: number } = {
  trees: [], commits: 0, refUpdates: 0,
};
let blobCounter = 0;

const fakeOctokit = {
  async request(route: string, params: Record<string, unknown>) {
    switch (route) {
      case "GET /repos/{owner}/{repo}":
        return { data: { default_branch: "main" } };
      case "GET /repos/{owner}/{repo}/git/trees/{tree_sha}":
        return {
          data: {
            tree: [
              { path: "README.md", type: "blob", sha: "sha-readme" },
              { path: "evidence/K4/index.md", type: "blob", sha: "sha-K4" },
              { path: "evidence/S4/index.md", type: "blob", sha: "sha-S4" },
            ],
          },
        };
      case "GET /repos/{owner}/{repo}/git/blobs/{file_sha}": {
        const sha = params.file_sha as string;
        return { data: { content: b64(blobs[sha] ?? ""), encoding: "base64" } };
      }
      case "GET /repos/{owner}/{repo}/git/ref/{ref}":
        return { data: { object: { sha: "base-commit" } } };
      case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}":
        return { data: { tree: { sha: "base-tree" } } };
      case "POST /repos/{owner}/{repo}/git/blobs":
        return { data: { sha: `blob-${++blobCounter}` } };
      case "POST /repos/{owner}/{repo}/git/trees":
        captured.trees.push(params as unknown as CapturedTree);
        return { data: { sha: "new-tree" } };
      case "POST /repos/{owner}/{repo}/git/commits":
        captured.commits++;
        return { data: { sha: "new-commit" } };
      case "PATCH /repos/{owner}/{repo}/git/refs/{ref}":
        captured.refUpdates++;
        return { data: {} };
      default:
        throw new Error("Unexpected route: " + route);
    }
  },
} as unknown as Octokit;

async function main() {
  const store = createGitHubStore({ octokit: fakeOctokit, owner: "lucy-ds", repo: "portfolio-evidence" });

  // --- load ---
  const loaded = await store.load();
  assert(loaded.length === 2, `load returns 2 items, got ${loaded.length}`);
  const a = loaded.find((e) => e.id === "a1")!;
  const b = loaded.find((e) => e.id === "b1")!;
  assert(a && b, "both seed items present");
  assert(a.url === "github.com/x/y/blob/main/churn.ipynb", "github url parsed (protocol stripped)");
  assert(a.status === "Submitted", "status capitalized on load");
  assert(b.note === "First line.\n\nSecond paragraph.", "multi-line reflection note recovered from body");
  assert(b.feedback === "Solid.", "feedback parsed");

  // --- add: new github item mapped to K4.1 (primary K4) ---
  captured.trees = []; captured.commits = 0; captured.refUpdates = 0;
  const newItem: Evidence = {
    id: "n1", ksbIds: ["K4.1"], type: "github", title: "Stats methods notebook",
    url: "github.com/x/y/blob/main/stats.ipynb", note: "", status: "Submitted",
    date: "17 Jul 2026", feedback: "",
  };
  const afterAdd = await store.addEvidence(newItem);
  assert(afterAdd.length === 3, "add returns 3 items");
  assert(captured.commits === 1 && captured.refUpdates === 1, "add makes exactly one atomic commit");
  const addTree = captured.trees[0];
  const k4Entry = addTree.tree.find((t) => t.path === "evidence/K4/index.md");
  assert(k4Entry?.content?.includes("id: n1"), "new item written into evidence/K4/index.md");
  assert(k4Entry?.content?.includes("id: a1"), "existing K4 item preserved in same file");
  assert(/id: K4\.1\s+covered: true/.test(k4Entry!.content!), "K4.1 sub-point now covered");
  assert(!addTree.tree.some((t) => t.path === "evidence/S4/index.md"), "unaffected S4 folder not rewritten");

  // --- update: approve a1 with feedback ---
  captured.trees = []; captured.commits = 0;
  const afterUpdate = await store.updateEvidence("a1", { status: "Approved", feedback: "Great work." });
  assert(afterUpdate.find((e) => e.id === "a1")!.status === "Approved", "a1 approved in returned state");
  assert(captured.commits === 1, "update makes one commit");
  const updK4 = captured.trees[0].tree.find((t) => t.path === "evidence/K4/index.md");
  assert(/id: a1[\s\S]*?status: approved/.test(updK4!.content!), "a1 written as approved (lowercase) in index.md");
  assert(updK4!.content!.includes("Great work."), "coach feedback written to index.md");

  console.log("GITHUB-STORE OK — load/add/update produce correct atomic commits");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
