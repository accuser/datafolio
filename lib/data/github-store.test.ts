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

// A fresh in-memory repo with an explicit set of tree blobs, for the collision
// and remap-move scenarios. `treeBlobs` lists every blob path already in the
// tree (index files plus any uploaded files); `indexContent` maps an index
// blob's sha to its Markdown so loadAll can parse it. Non-index blobs (the
// uploaded files) need no content — only their paths matter for collisions.
interface FreshTreeEntry {
  path: string;
  content?: string;
  sha?: string | null;
}
interface FreshCaptured {
  trees: { base_tree: string; tree: FreshTreeEntry[] }[];
  commits: number;
  newBlobs: string[];
}
function buildStore(
  treeBlobs: { path: string; sha: string }[],
  indexContent: Record<string, string>,
) {
  const captured: FreshCaptured = { trees: [], commits: 0, newBlobs: [] };
  let counter = 0;
  const octokit = {
    async request(route: string, params: Record<string, unknown>) {
      switch (route) {
        case "GET /repos/{owner}/{repo}":
          return { data: { default_branch: "main" } };
        case "GET /repos/{owner}/{repo}/git/trees/{tree_sha}":
          return { data: { tree: treeBlobs.map((b) => ({ ...b, type: "blob" })) } };
        case "GET /repos/{owner}/{repo}/git/blobs/{file_sha}": {
          const sha = params.file_sha as string;
          return { data: { content: b64(indexContent[sha] ?? ""), encoding: "base64" } };
        }
        case "GET /repos/{owner}/{repo}/git/ref/{ref}":
          return { data: { object: { sha: "base-commit" } } };
        case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}":
          return { data: { tree: { sha: "base-tree" } } };
        case "POST /repos/{owner}/{repo}/git/blobs":
          captured.newBlobs.push(params.content as string);
          return { data: { sha: `new-blob-${++counter}` } };
        case "POST /repos/{owner}/{repo}/git/trees":
          captured.trees.push(params as unknown as FreshCaptured["trees"][number]);
          return { data: { sha: "new-tree" } };
        case "POST /repos/{owner}/{repo}/git/commits":
          captured.commits++;
          return { data: { sha: "new-commit" } };
        case "PATCH /repos/{owner}/{repo}/git/refs/{ref}":
          return { data: {} };
        default:
          throw new Error("Unexpected route: " + route);
      }
    },
  } as unknown as Octokit;
  const store = createGitHubStore({ octokit, owner: "lucy-ds", repo: "portfolio-evidence" });
  return { store, captured };
}

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

  // --- add: upload item with file bytes → blob committed in the same commit ---
  captured.trees = []; captured.commits = 0;
  const blobsBefore = blobCounter;
  const uploadItem: Evidence = {
    id: "u1", ksbIds: ["S4"], type: "upload", title: "Insights deck",
    fileName: "deck.pdf", note: "", status: "Submitted", date: "17 Jul 2026", feedback: "",
  };
  await store.addEvidence(uploadItem, { fileContentBase64: b64("%PDF-1.4 fake bytes") });
  assert(blobCounter === blobsBefore + 1, "upload creates exactly one git blob");
  assert(captured.commits === 1, "upload is one atomic commit");
  const upTree = captured.trees[0];
  assert(
    upTree.tree.some((t) => t.path === "evidence/S4/deck.pdf" && t.sha),
    "uploaded file committed as a blob in the primary folder",
  );
  assert(
    upTree.tree.some((t) => t.path === "evidence/S4/index.md" && t.content?.includes("file: deck.pdf")),
    "index.md records the upload filename",
  );

  // --- add: a filename collision in the same folder is de-duped, not clobbered ---
  {
    const existing: Evidence = {
      id: "x1", ksbIds: ["S4"], type: "upload", title: "Existing deck",
      fileName: "deck.pdf", note: "", status: "Approved", date: "1 Jun 2026", feedback: "",
    };
    const { store: s, captured: c } = buildStore(
      [
        { path: "evidence/S4/index.md", sha: "t-S4" },
        { path: "evidence/S4/deck.pdf", sha: "sha-existing-deck" },
      ],
      { "t-S4": genMd([existing], KSB_BY_ID["S4"]) },
    );
    const dup: Evidence = {
      id: "x2", ksbIds: ["S4"], type: "upload", title: "New deck",
      fileName: "deck.pdf", note: "", status: "Submitted", date: "18 Jul 2026", feedback: "",
    };
    const after = await s.addEvidence(dup, { fileContentBase64: b64("new bytes") });
    assert(after.find((e) => e.id === "x2")!.fileName === "deck-2.pdf",
      "colliding upload filename is suffixed to deck-2.pdf");
    const tree = c.trees[0].tree;
    assert(tree.some((t) => t.path === "evidence/S4/deck-2.pdf" && t.sha),
      "new blob committed at the de-duped path");
    assert(!tree.some((t) => t.path === "evidence/S4/deck.pdf"),
      "existing deck.pdf blob is not overwritten");
    const s4 = tree.find((t) => t.path === "evidence/S4/index.md");
    assert(s4?.content?.includes("file: deck-2.pdf"), "index.md records the de-duped name");
    assert(s4?.content?.includes("file: deck.pdf"), "existing item's file reference preserved");
  }

  // --- update/remap: moving a file into a folder that already has that name ---
  {
    const moving: Evidence = {
      id: "m1", ksbIds: ["K4.2"], type: "upload", title: "Report",
      fileName: "report.pdf", note: "", status: "Submitted", date: "2 Jul 2026", feedback: "",
    };
    const occupant: Evidence = {
      id: "d1", ksbIds: ["S4"], type: "upload", title: "Other report",
      fileName: "report.pdf", note: "", status: "Approved", date: "1 Jun 2026", feedback: "",
    };
    const { store: s, captured: c } = buildStore(
      [
        { path: "evidence/K4/index.md", sha: "t-K4" },
        { path: "evidence/S4/index.md", sha: "t-S4" },
        { path: "evidence/K4/report.pdf", sha: "sha-report-src" },
        { path: "evidence/S4/report.pdf", sha: "sha-report-dest" },
      ],
      {
        "t-K4": genMd([moving], KSB_BY_ID["K4"]),
        "t-S4": genMd([occupant], KSB_BY_ID["S4"]),
      },
    );
    const after = await s.updateEvidence("m1", { ksbIds: ["S4"] });
    assert(after.find((e) => e.id === "m1")!.fileName === "report-2.pdf",
      "moved file is de-duped against the destination folder");
    const tree = c.trees[0].tree;
    assert(
      tree.some((t) => t.path === "evidence/S4/report-2.pdf" && t.sha === "sha-report-src"),
      "existing blob re-pointed (by sha) to the de-duped destination path",
    );
    assert(tree.some((t) => t.path === "evidence/K4/report.pdf" && t.sha === null),
      "the source blob path is deleted");
    assert(c.newBlobs.length === 0, "a move re-points the blob by sha — no re-upload");
    const s4 = tree.find((t) => t.path === "evidence/S4/index.md");
    assert(s4?.content?.includes("file: report-2.pdf"), "new folder links the moved, de-duped file");
    const k4 = tree.find((t) => t.path === "evidence/K4/index.md");
    assert(k4 !== undefined && !k4.content?.includes("id: m1"), "item removed from the old folder");
  }

  // --- update/remap: a move with no name clash keeps the original filename ---
  {
    const moving: Evidence = {
      id: "p1", ksbIds: ["K4.2"], type: "upload", title: "Slides",
      fileName: "slides.pdf", note: "", status: "Submitted", date: "2 Jul 2026", feedback: "",
    };
    const { store: s, captured: c } = buildStore(
      [
        { path: "evidence/K4/index.md", sha: "t-K4" },
        { path: "evidence/S4/index.md", sha: "t-S4" },
        { path: "evidence/K4/slides.pdf", sha: "sha-slides" },
      ],
      { "t-K4": genMd([moving], KSB_BY_ID["K4"]), "t-S4": genMd([], KSB_BY_ID["S4"]) },
    );
    const after = await s.updateEvidence("p1", { ksbIds: ["S4"] });
    assert(after.find((e) => e.id === "p1")!.fileName === "slides.pdf",
      "no clash keeps the original filename");
    const tree = c.trees[0].tree;
    assert(tree.some((t) => t.path === "evidence/S4/slides.pdf" && t.sha === "sha-slides"),
      "file moved to the new folder under the same name");
    assert(tree.some((t) => t.path === "evidence/K4/slides.pdf" && t.sha === null),
      "old path deleted on move");
  }

  // --- update: a status-only change on an upload never touches its file blob ---
  {
    const item: Evidence = {
      id: "y1", ksbIds: ["S4"], type: "upload", title: "Deck",
      fileName: "deck.pdf", note: "", status: "Submitted", date: "2 Jul 2026", feedback: "",
    };
    const { store: s, captured: c } = buildStore(
      [
        { path: "evidence/S4/index.md", sha: "t-S4" },
        { path: "evidence/S4/deck.pdf", sha: "sha-deck" },
      ],
      { "t-S4": genMd([item], KSB_BY_ID["S4"]) },
    );
    await s.updateEvidence("y1", { status: "Approved", feedback: "Nice." });
    const tree = c.trees[0].tree;
    assert(!tree.some((t) => t.path.endsWith("deck.pdf")),
      "status-only update leaves the file blob untouched");
    assert(c.newBlobs.length === 0, "status-only update creates no blobs");
  }

  console.log("GITHUB-STORE OK — load/add/update produce correct atomic commits");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
