import type { Card } from "../types";

/**
 * The revision-card data seam, kept separate from `EvidenceStore` rather than
 * bolted onto it.
 *
 * The two have genuinely different lifecycles — cards have no status, no
 * validation against a review workflow, and no reviewer action — so overloading
 * one store with both shapes would mean every evidence rule growing an "except
 * for cards" branch. A GitHub-backed implementation reads and writes
 * `revision/<KSB>/cards.md` using the same atomic multi-file commit machinery.
 */
export interface CardStore {
  /** Read every card in the portfolio. */
  load(): Promise<Card[]>;
  /**
   * Commit one or more cards; resolves to the updated collection.
   *
   * Plural because seeding a KSB adds a whole starter set, and that has to be
   * one commit rather than one per card. Cards whose id already exists are
   * skipped, which is what makes "Generate starter cards" idempotent — seeded
   * ids are derived from the KSB or sub-point they revise (see lib/cards.ts),
   * so pressing it twice cannot produce a duplicate deck.
   */
  addCards(cards: Card[]): Promise<Card[]>;
  /** Patch an existing card (the learner editing their own text). */
  updateCard(id: string, patch: Partial<Card>): Promise<Card[]>;
  deleteCard(id: string): Promise<Card[]>;
}

export function createMockCardStore(seed: Card[] = []): CardStore {
  let items: Card[] = seed.map((c) => ({ ...c }));
  return {
    async load() {
      return items;
    },
    async addCards(cards) {
      const known = new Set(items.map((c) => c.id));
      const fresh = cards.filter((c) => !known.has(c.id));
      items = [...fresh, ...items];
      return items;
    },
    async updateCard(id, patch) {
      items = items.map((c) => (c.id === id ? { ...c, ...patch } : c));
      return items;
    },
    async deleteCard(id) {
      items = items.filter((c) => c.id !== id);
      return items;
    },
  };
}
