/**
 * Network-free integration test for the GitHub-backed card store. A fake
 * Octokit serves an in-memory repo and captures the Git Data writes, so we can
 * assert that each action produces one correct, atomic commit.
 * Run: `npx tsx --conditions=react-server lib/data/github-card-store.test.ts`.
 */
import type { Octokit } from "@octokit/core";
import { getStandard, ksbIndex } from "../standards";
import { renderCardsMd } from "../cards";
import { parseCardsMd } from "../github/cards-frontmatter";
import { createGitHubCardStore } from "./github-card-store";
import type { Card } from "../types";

const std = getStandard("st0585");
const byId = ksbIndex(std);

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

const k4a: Card = {
  id: "c-K4.1", ksbIds: ["K4.1"], front: "Explain: models.", back: "",
  tags: ["ST0585", "K4"], source: "seed", created: "2 Jul 2026", updated: "2 Jul 2026",
};
const k4b: Card = {
  id: "c-own", ksbIds: ["K4.2"], front: "Three algorithms?", back: "Logistic, RF, GBM.",
  source: "learner", created: "5 Jul 2026", updated: "5 Jul 2026",
};
const b1: Card = {
  id: "c-B1", ksbIds: ["B1"], front: "Be ready to discuss: initiative.", back: "The churn incident.",
  source: "seed", created: "5 Jul 2026", updated: "5 Jul 2026",
};

const blobs: Record<string, string> = {
  "sha-K4": renderCardsMd(byId.K4, [k4a, k4b]),
  "sha-B1": renderCardsMd(byId.B1, [b1]),
};
const treePaths = new Map<string, string>([
  ["README.md", "sha-readme"],
  ["evidence/K4/index.md", "sha-ev"],
  ["revision/K4/cards.md", "sha-K4"],
  ["revision/B1/cards.md", "sha-B1"],
]);

interface CapturedTree {
  tree: { path: string; content?: string; sha?: string | null }[];
}
let captured: { trees: CapturedTree[]; commits: number; refUpdates: number } = {
  trees: [], commits: 0, refUpdates: 0,
};
const reset = () => (captured = { trees: [], commits: 0, refUpdates: 0 });
// Read counts through calls, not property access: asserting on
// `captured.commits` directly narrows its type for the rest of the function, so
// a later check against a different count becomes a compile error even though
// reset() has since changed the value.
const commits = () => captured.commits;
const refUpdates = () => captured.refUpdates;

const fakeOctokit = {
  async request(route: string, params: Record<string, unknown>) {
    switch (route) {
      case "GET /repos/{owner}/{repo}":
        return { data: { default_branch: "main" } };
      case "GET /repos/{owner}/{repo}/git/trees/{tree_sha}":
        return {
          data: { tree: [...treePaths].map(([path, sha]) => ({ path, type: "blob", sha })) },
        };
      case "GET /repos/{owner}/{repo}/git/blobs/{file_sha}":
        return { data: { content: b64(blobs[params.file_sha as string] ?? ""), encoding: "base64" } };
      case "GET /repos/{owner}/{repo}/git/ref/{ref}":
        return { data: { object: { sha: "base-commit" } } };
      case "GET /repos/{owner}/{repo}/git/commits/{commit_sha}":
        return { data: { tree: { sha: "base-tree" } } };
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

const store = createGitHubCardStore(
  { octokit: fakeOctokit, owner: "lucy-ds", repo: "portfolio-evidence" },
  std,
);

/** The single tree entry written for a given path in the last commit. */
function entry(path: string) {
  const all = captured.trees.flatMap((t) => t.tree);
  return all.find((e) => e.path === path);
}

async function main() {
  // --- load: only revision/*/cards.md, never the evidence folders -----------
  const loaded = await store.load();
  assert(loaded.length === 3, `expected 3 cards, got ${loaded.length}`);
  assert(loaded.some((c) => c.id === "c-own"), "learner card loaded");
  assert(loaded.some((c) => c.id === "c-B1"), "cards from every folder loaded");

  // --- addCards: one commit, only the touched folder rewritten --------------
  reset();
  const added = await store.addCards([
    { ...k4a, id: "c-new", ksbIds: ["K4.3"], front: "New card", source: "learner" },
  ]);
  assert(added.length === 4, "card added to the collection");
  assert(commits() === 1 && refUpdates() === 1, "exactly one atomic commit");
  const k4Written = entry("revision/K4/cards.md");
  assert(k4Written?.content, "the K4 folder was rewritten");
  assert(!entry("revision/B1/cards.md"), "an untouched folder is not rewritten");
  const reparsed = parseCardsMd(k4Written!.content!);
  assert(reparsed.cards.length === 3, "the new card is in the committed file");
  assert(
    reparsed.cards.some((c) => c.id === "c-new"),
    "and it round-trips through the committed markdown",
  );

  // --- re-seeding is idempotent, and writes nothing at all ------------------
  reset();
  const again = await store.addCards([k4a, k4b]);
  assert(again.length === 3, "known ids are skipped");
  assert(commits() === 0, "a no-op add must not create an empty commit");

  // --- a card is filed under its root KSB, not its sub-point ---------------
  reset();
  await store.addCards([{ ...k4a, id: "c-sub", ksbIds: ["K5.2"] }]);
  assert(entry("revision/K5/cards.md"), "a K5.2 card lands in the K5 folder");

  // --- update: rewrites the folder, keeps siblings --------------------------
  reset();
  const updated = await store.updateCard("c-own", { back: "Rewritten." });
  assert(
    updated.find((c) => c.id === "c-own")!.back === "Rewritten.",
    "patch applied",
  );
  const afterEdit = parseCardsMd(entry("revision/K4/cards.md")!.content!);
  assert(afterEdit.cards.length === 2, "siblings survive the rewrite");
  assert(
    afterEdit.cards.find((c) => c.id === "c-K4.1")!.front === k4a.front,
    "an untouched sibling is written back unchanged",
  );

  // --- re-mapping moves the card between folders ---------------------------
  reset();
  await store.updateCard("c-own", { ksbIds: ["B1"] });
  const k4After = parseCardsMd(entry("revision/K4/cards.md")!.content!);
  const b1After = parseCardsMd(entry("revision/B1/cards.md")!.content!);
  assert(!k4After.cards.some((c) => c.id === "c-own"), "removed from the old folder");
  assert(b1After.cards.some((c) => c.id === "c-own"), "added to the new folder");
  assert(commits() === 1, "both folders move in one commit");

  // --- delete: emptying a folder removes the file, not just its contents ----
  reset();
  const afterDelete = await store.deleteCard("c-B1");
  assert(!afterDelete.some((c) => c.id === "c-B1"), "card removed");
  const b1Entry = entry("revision/B1/cards.md");
  assert(b1Entry && b1Entry.sha === null, "the last card leaving deletes the file");

  // --- a missing card is an error, not a silent no-op ----------------------
  let threw = false;
  try {
    await store.deleteCard("does-not-exist");
  } catch {
    threw = true;
  }
  assert(threw, "deleting an unknown card throws");

  console.log(
    "GITHUB-CARD-STORE OK — load/add/update/remap/delete produce correct atomic commits",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
