import "server-only";
import { cardFolder, cardsInFolder, renderCardsMd } from "../cards";
import { ksbIndex, type Standard } from "../standards";
import { parseCardsMd } from "../github/cards-frontmatter";
import { commitTree, withConflictRetry, type TreeEntry } from "../github/commit";
import { readFolders, readRepoTree, type RepoTree } from "../github/repo-tree";
import type { GitHubStoreContext } from "./github-store";
import type { CardStore } from "./card-store";
import { NotFoundError } from "./errors";
import type { Card } from "../types";

// Server-side revision-card store backed by the learner's repo. Reads every
// revision/<KSB>/cards.md; writes are atomic commits via the Git Data API.
//
// Much simpler than the evidence store, and deliberately so: cards have no
// status, no reviewer, and no file uploads, so there is no upload de-duplication
// and no blob relocation to worry about. A card lives in exactly one folder.

const CARDS_RE = /^revision\/([^/]+)\/cards\.md$/;

/**
 * Read every card in the repo.
 *
 * Standalone because reading doesn't need the portfolio's standard — only
 * rewriting a folder does — so a plain `GET /api/cards` shouldn't pay for
 * resolving datafolio.yml just to construct a store it then only reads from.
 */
export async function loadCards(ctx: GitHubStoreContext): Promise<Card[]> {
  const tree = await readRepoTree(ctx);
  return readFolders(ctx, tree, CARDS_RE, (md) => ({
    items: parseCardsMd(md).cards,
  }));
}

export function createGitHubCardStore(
  ctx: GitHubStoreContext,
  standard: Standard,
): CardStore {
  const { octokit, owner, repo } = ctx;

  async function loadAll(): Promise<{ cards: Card[]; tree: RepoTree }> {
    const tree = await readRepoTree(ctx);
    const cards = await readFolders(ctx, tree, CARDS_RE, (md) => ({
      items: parseCardsMd(md).cards,
    }));
    return { cards, tree };
  }

  /** Rewrite each named folder's cards.md from `all`, as one commit. */
  async function commitFolders(
    tree: RepoTree,
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
    // Every folder filtered out means there is nothing to write — but the
    // callers all return the mutated collection regardless, so skipping the
    // commit here would tell the learner their change was saved when no commit
    // was ever made, and the card would reappear on the next load. Fail loudly
    // instead: reaching this point at all means the caller's folder list didn't
    // survive `ksbIndex`, which is a bug rather than a user error.
    if (!entries.length) {
      throw new Error(
        `No revision folder to write for [${folders.join(", ")}] — card change not saved`,
      );
    }
    await commitTree(
      octokit,
      owner,
      repo,
      tree.branch,
      tree.headSha,
      entries,
      message,
    );
  }

  return {
    async load(): Promise<Card[]> {
      return loadCards(ctx);
    },

    async addCards(cards: Card[]): Promise<Card[]> {
      return withConflictRetry(async () => {
        const { cards: current, tree } = await loadAll();
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
        await commitFolders(tree, folders, all, message);
        return all;
      });
    },

    async updateCard(id: string, patch: Partial<Card>): Promise<Card[]> {
      return withConflictRetry(async () => {
        const { cards: current, tree } = await loadAll();
        const target = current.find((c) => c.id === id);
        if (!target) throw new NotFoundError("card", `Card ${id} not found`);
        const updated: Card = { ...target, ...patch };
        const all = current.map((c) => (c.id === id ? updated : c));
        // Re-mapping a card moves its file, so both folders are rewritten —
        // otherwise the old one keeps a stale copy forever.
        const folders = [
          ...new Set([cardFolder(target), cardFolder(updated)].filter(Boolean)),
        ];
        await commitFolders(
          tree,
          folders,
          all,
          `Update revision card: ${updated.front.slice(0, 60)}`,
        );
        return all;
      });
    },

    async deleteCard(id: string): Promise<Card[]> {
      return withConflictRetry(async () => {
        const { cards: current, tree } = await loadAll();
        const target = current.find((c) => c.id === id);
        if (!target) throw new NotFoundError("card", `Card ${id} not found`);
        // An unmapped card has no folder to rewrite, so there is no commit that
        // would remove it. Say so rather than reporting a delete that leaves the
        // card in the repo to reappear on the next load.
        const folder = cardFolder(target);
        if (!folder) {
          throw new Error(
            `Card ${id} is not mapped to a KSB, so it has no file to delete`,
          );
        }
        const all = current.filter((c) => c.id !== id);
        await commitFolders(
          tree,
          [folder],
          all,
          `Delete revision card: ${target.front.slice(0, 60)}`,
        );
        return all;
      });
    },
  };
}
