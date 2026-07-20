import "server-only";
import { cardFolder, cardsInFolder, renderCardsMd } from "../cards";
import { ksbIndex, type Standard } from "../standards";
import { parseCardsMd } from "../github/cards-frontmatter";
import { commitTree, withConflictRetry, type TreeEntry } from "../github/commit";
import type { GitHubStoreContext } from "./github-store";
import type { CardStore } from "./card-store";
import type { Card } from "../types";

// Server-side revision-card store backed by the learner's repo. Reads every
// revision/<KSB>/cards.md; writes are atomic commits via the Git Data API.
//
// Much simpler than the evidence store, and deliberately so: cards have no
// status, no reviewer, and no file uploads, so there is no upload de-duplication
// and no blob relocation to worry about. A card lives in exactly one folder.

const CARDS_RE = /^revision\/([^/]+)\/cards\.md$/;

export function createGitHubCardStore(
  ctx: GitHubStoreContext,
  standard: Standard,
): CardStore {
  const { octokit, owner, repo } = ctx;

  async function defaultBranch(): Promise<string> {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
    return data.default_branch;
  }

  async function loadAll(): Promise<{ cards: Card[]; branch: string }> {
    const branch = await defaultBranch();
    const { data: tree } = await octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      { owner, repo, tree_sha: branch, recursive: "true" },
    );
    const files = tree.tree.filter(
      (t) => t.type === "blob" && t.path && t.sha && CARDS_RE.test(t.path),
    );
    const folders = await Promise.all(
      files.map(async (f) => {
        const { data: blob } = await octokit.request(
          "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
          { owner, repo, file_sha: f.sha! },
        );
        return parseCardsMd(Buffer.from(blob.content, "base64").toString("utf8"));
      }),
    );
    // De-dupe by id: a hand-edited repo could list the same card in two folders,
    // and loading both would make edits look like they only half-applied.
    const seen = new Set<string>();
    const cards = folders
      .flatMap((f) => f.cards)
      .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
    return { cards, branch };
  }

  /** Rewrite each named folder's cards.md from `all`, as one commit. */
  async function commitFolders(
    branch: string,
    folders: string[],
    all: Card[],
    message: string,
  ): Promise<void> {
    const byId = ksbIndex(standard);
    const entries: TreeEntry[] = folders
      .filter((id) => byId[id])
      .map((id) => {
        const inFolder = cardsInFolder(all, id);
        return {
          path: `revision/${id}/cards.md`,
          mode: "100644" as const,
          type: "blob" as const,
          // Emptying a folder removes the file rather than leaving an empty
          // deck behind — the learner cleared it, so the repo should show that.
          ...(inFolder.length
            ? { content: renderCardsMd(byId[id], inFolder) }
            : { sha: null }),
        };
      });
    if (entries.length) {
      await commitTree(octokit, owner, repo, branch, entries, message);
    }
  }

  return {
    async load(): Promise<Card[]> {
      const { cards } = await loadAll();
      return cards;
    },

    async addCards(cards: Card[]): Promise<Card[]> {
      return withConflictRetry(async () => {
        const { cards: current, branch } = await loadAll();
        const known = new Set(current.map((c) => c.id));
        // Same idempotency contract as the mock: seeded ids are derived from
        // what a card revises, so re-seeding a KSB is a no-op rather than a
        // duplicate deck.
        const fresh = cards.filter((c) => !known.has(c.id) && cardFolder(c));
        if (!fresh.length) return current;
        const all = [...fresh, ...current];
        const folders = [...new Set(fresh.map(cardFolder))];
        const message =
          fresh.length === 1
            ? `Add revision card: ${fresh[0].front.slice(0, 60)}`
            : `Add ${fresh.length} starter cards: ${folders.join(", ")}`;
        await commitFolders(branch, folders, all, message);
        return all;
      });
    },

    async updateCard(id: string, patch: Partial<Card>): Promise<Card[]> {
      return withConflictRetry(async () => {
        const { cards: current, branch } = await loadAll();
        const target = current.find((c) => c.id === id);
        if (!target) throw new Error(`Card ${id} not found`);
        const updated: Card = { ...target, ...patch };
        const all = current.map((c) => (c.id === id ? updated : c));
        // Re-mapping a card moves its file, so both folders are rewritten —
        // otherwise the old one keeps a stale copy forever.
        const folders = [
          ...new Set([cardFolder(target), cardFolder(updated)].filter(Boolean)),
        ];
        await commitFolders(
          branch,
          folders,
          all,
          `Update revision card: ${updated.front.slice(0, 60)}`,
        );
        return all;
      });
    },

    async deleteCard(id: string): Promise<Card[]> {
      return withConflictRetry(async () => {
        const { cards: current, branch } = await loadAll();
        const target = current.find((c) => c.id === id);
        if (!target) throw new Error(`Card ${id} not found`);
        const all = current.filter((c) => c.id !== id);
        await commitFolders(
          branch,
          [cardFolder(target)].filter(Boolean),
          all,
          `Delete revision card: ${target.front.slice(0, 60)}`,
        );
        return all;
      });
    },
  };
}
