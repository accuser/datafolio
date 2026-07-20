/**
 * Network-free integration test for the GitHub-backed store. A fake Octokit
 * serves an in-memory repo (two evidence folders) and captures the Git Data
 * write calls, so we can assert load/add/update produce correct, atomic commits
 * without touching GitHub. Run: `npx tsx lib/data/github-store.test.ts`.
 */
import type { Octokit } from "@octokit/core";
import { getStandard, ksbIndex } from "../standards";
import { genMd } from "../domain";
import type { Evidence } from "../types";
import { createGitHubStore } from "./github-store";

const KSB_BY_ID = ksbIndex(getStandard("st0585"));

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
// itemU: an upload, primary S4, whose file blob lives at evidence/S4/deck.pdf.
const itemU: Evidence = {
  id: "up1", ksbIds: ["S4"], type: "upload", title: "Insights deck",
  fileName: "deck.pdf", note: "", status: "Submitted", date: "3 Jul 2026", feedback: "",
};
const seed = [itemA, itemB, itemU];

// The fake repo's blobs, keyed by a synthetic sha.
const blobs: Record<string, string> = {
  "sha-K4": genMd(seed, KSB_BY_ID["K4"]),
  "sha-S4": genMd(seed, KSB_BY_ID["S4"]),
};

// The repo tree as a mutable path→sha map, so a test can drop a blob to exercise
// the "file already gone" delete guard. Includes the upload's file blob.
const treePaths = new Map<string, string>([
  ["README.md", "sha-readme"],
  ["evidence/K4/index.md", "sha-K4"],
  ["evidence/S4/index.md", "sha-S4"],
  ["evidence/S4/deck.pdf", "sha-deck"],
]);

interface CapturedTree {
  base_tree: string;
  tree: { path: string; content?: string; sha?: string | null }[];
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
            tree: [...treePaths].map(([path, sha]) => ({ path, type: "blob", sha })),
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

// A fresh, isolated in-memory repo with an explicit set of tree blobs, for the
// filename-collision scenarios (which need a pre-existing blob at the target
// path). `treeBlobs` lists every blob path already in the tree (index files plus
// any uploaded files); `indexContent` maps an index blob's sha to its Markdown
// so loadAll can parse it. Non-index blobs need no content — only their paths
// matter for collision detection.
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
  const { evidence: loaded, standardId } = await store.load();
  assert(
    standardId === "st0585",
    `a repo with no datafolio.yml loads as st0585, got ${standardId}`,
  );
  assert(loaded.length === 3, `load returns 3 items, got ${loaded.length}`);
  const a = loaded.find((e) => e.id === "a1")!;
  const b = loaded.find((e) => e.id === "b1")!;
  const u = loaded.find((e) => e.id === "up1")!;
  assert(a && b && u, "all seed items present");
  assert(a.url === "github.com/x/y/blob/main/churn.ipynb", "github url parsed (protocol stripped)");
  assert(a.status === "Submitted", "status capitalized on load");
  assert(b.note === "First line.\n\nSecond paragraph.", "multi-line reflection note recovered from body");
  assert(b.feedback === "Solid.", "feedback parsed");
  assert(u.type === "upload" && u.fileName === "deck.pdf", "upload filename recovered on load");

  // --- add: new github item mapped to K4.1 (primary K4) ---
  captured.trees = []; captured.commits = 0; captured.refUpdates = 0;
  const newItem: Evidence = {
    id: "n1", ksbIds: ["K4.1"], type: "github", title: "Stats methods notebook",
    url: "github.com/x/y/blob/main/stats.ipynb", note: "", status: "Submitted",
    date: "17 Jul 2026", feedback: "",
  };
  const afterAdd = await store.addEvidence(newItem);
  assert(afterAdd.length === 4, "add returns 4 items");
  assert(captured.commits === 1 && captured.refUpdates === 1, "add makes exactly one atomic commit");
  const addTree = captured.trees[0];
  const k4Entry = addTree.tree.find((t) => t.path === "evidence/K4/index.md");
  assert(k4Entry?.content?.includes("id: n1"), "new item written into evidence/K4/index.md");
  assert(k4Entry?.content?.includes("id: a1"), "existing K4 item preserved in same file");
  // Sub-points now carry their own assessment methods between `id` and `covered`,
  // so match within the K4.1 entry only (stop at the next `- id:`).
  const k4point = (id: string, content: string) =>
    new RegExp(`id: ${id.replace(".", "\\.")}\\n(?:(?!- id:)[\\s\\S])*?covered: (true|false)`)
      .exec(content)?.[1];
  assert(k4point("K4.1", k4Entry!.content!) === "true", "K4.1 sub-point now covered");
  assert(k4point("K4.3", k4Entry!.content!) === "false", "unmapped K4.3 stays uncovered");
  assert(
    /id: K4\.1\n\s+methods:\n\s+- knowledge_test/.test(k4Entry!.content!),
    "sub-point methods written from the standard, not inherited from the parent",
  );
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
  // A fresh name (no clash with the seeded evidence/S4/deck.pdf) so this stays a
  // plain "upload is committed" case; collisions are covered separately below.
  captured.trees = []; captured.commits = 0;
  const blobsBefore = blobCounter;
  const uploadItem: Evidence = {
    id: "u1", ksbIds: ["S4"], type: "upload", title: "Model notebook",
    fileName: "notebook.pdf", note: "", status: "Submitted", date: "17 Jul 2026", feedback: "",
  };
  await store.addEvidence(uploadItem, { fileContentBase64: b64("%PDF-1.4 fake bytes") });
  assert(blobCounter === blobsBefore + 1, "upload creates exactly one git blob");
  assert(captured.commits === 1, "upload is one atomic commit");
  const upTree = captured.trees[0];
  assert(
    upTree.tree.some((t) => t.path === "evidence/S4/notebook.pdf" && t.sha),
    "uploaded file committed as a blob in the primary folder",
  );
  assert(
    upTree.tree.some((t) => t.path === "evidence/S4/index.md" && t.content?.includes("file: notebook.pdf")),
    "index.md records the upload filename",
  );

  // --- add: a colliding filename in the same folder is de-duped, not clobbered ---
  // evidence/S4/deck.pdf already exists; a second upload that sanitises to the
  // same name must be stored as deck-2.pdf, leaving the existing blob intact.
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
  // m1 moves K4 → S4, but S4 already holds a report.pdf. The moved blob must land
  // as report-2.pdf and leave the occupant's blob untouched.
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
      "the moved blob is re-pointed (by sha) to the de-duped destination path",
    );
    assert(tree.some((t) => t.path === "evidence/K4/report.pdf" && t.sha === null),
      "the source blob path is deleted");
    assert(c.newBlobs.length === 0, "a move re-points the blob by sha — no re-upload");
    assert(!tree.some((t) => t.path === "evidence/S4/report.pdf"),
      "the occupant blob in the destination is left untouched");
    const s4 = tree.find((t) => t.path === "evidence/S4/index.md");
    assert(s4?.content?.includes("file: report-2.pdf"), "new folder links the moved, de-duped file");
    const k4 = tree.find((t) => t.path === "evidence/K4/index.md");
    assert(k4 !== undefined && !k4.content?.includes("id: m1"), "item removed from the old folder");
  }

  // --- update: remapping an upload's primary folder moves its file blob ---
  // up1's first mapping goes S4 → K2, so its physical folder changes. The file
  // must follow, or the new folder's index.md links a `./deck.pdf` that isn't
  // there and a later delete targets the wrong path.
  captured.trees = []; captured.commits = 0;
  const blobsBeforeRemap = blobCounter;
  await store.updateEvidence("up1", { ksbIds: ["K2"] });
  assert(captured.commits === 1, "remap makes exactly one atomic commit");
  assert(blobCounter === blobsBeforeRemap, "moving a file re-points its blob — no re-upload");
  const remapTree = captured.trees[0].tree;
  assert(
    remapTree.some((t) => t.path === "evidence/K2/deck.pdf" && t.sha === "sha-deck"),
    "file blob written at the new primary folder by reference",
  );
  assert(
    remapTree.some((t) => t.path === "evidence/S4/deck.pdf" && t.sha === null),
    "file blob removed from the old primary folder in the same commit",
  );
  const remapK2 = remapTree.find((t) => t.path === "evidence/K2/index.md");
  assert(remapK2?.content?.includes("file: deck.pdf"), "new folder's index.md links the moved file");
  const remapS4 = remapTree.find((t) => t.path === "evidence/S4/index.md");
  assert(remapS4 && !/id: up1/.test(remapS4.content!), "old folder's index.md drops the moved item");

  // --- update: remap within the same root folder does NOT move the file ---
  captured.trees = [];
  await store.updateEvidence("up1", { ksbIds: ["S4.1", "S4"] });
  const sameRootTree = captured.trees[0].tree;
  assert(
    !sameRootTree.some((t) => t.path.endsWith("/deck.pdf")),
    "no file move when the primary root is unchanged",
  );

  // --- delete: an upload removes its file blob alongside the index rewrite ---
  captured.trees = []; captured.commits = 0;
  await store.deleteEvidence("up1");
  assert(captured.commits === 1, "delete makes one commit");
  const delTree = captured.trees[0].tree;
  assert(
    delTree.some((t) => t.path === "evidence/S4/deck.pdf" && t.sha === null),
    "deleting an upload also removes its file blob",
  );

  // --- delete guard: a file already gone is not re-deleted (would 422) ---
  treePaths.delete("evidence/S4/deck.pdf"); // simulate a missing / already-removed blob
  captured.trees = []; captured.commits = 0;
  await store.deleteEvidence("up1");
  assert(captured.commits === 1, "delete still commits when the file blob is absent");
  const delTree2 = captured.trees[0].tree;
  assert(
    !delTree2.some((t) => t.path === "evidence/S4/deck.pdf"),
    "an absent file blob is not added as a deletion, so the commit can't 422",
  );

  console.log("GITHUB-STORE OK — load/add/update/remap/delete + filename de-dup produce correct atomic commits");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
