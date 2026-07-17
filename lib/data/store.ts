import type { Evidence } from "../types";

/**
 * The data-layer seam.
 *
 * UX-first build: an in-memory implementation seeded from sample evidence.
 *
 * Production: swap `createMockStore` for a GitHub-backed implementation that
 * reads `evidence/*​/index.md` front-matter (+ `coverage.json`) via the backend
 * proxy, and turns each mutation into a single commit to the KSB folder:
 *   - addEvidence   → update the KSB's index.md front-matter `evidence[]`
 *                     (and upload any file blob to the same folder).
 *   - updateEvidence → coach approve / request-changes: patch the matching
 *                     evidence item's `status` + `feedback`.
 * The UI never talks to GitHub directly — only through this interface — so the
 * screens are identical in both modes.
 */
export interface EvidenceStore {
  /** Read all evidence for the signed-in learner's repo. */
  load(): Promise<Evidence[]>;
  /** Commit a new evidence item; resolves to the updated collection. */
  addEvidence(item: Evidence): Promise<Evidence[]>;
  /** Patch an existing item (coach review / edits); resolves to the collection. */
  updateEvidence(id: string, patch: Partial<Evidence>): Promise<Evidence[]>;
}

export function createMockStore(seed: Evidence[]): EvidenceStore {
  let items: Evidence[] = seed.map((e) => ({ ...e }));
  return {
    async load() {
      return items;
    },
    async addEvidence(item) {
      items = [item, ...items];
      return items;
    },
    async updateEvidence(id, patch) {
      items = items.map((e) => (e.id === id ? { ...e, ...patch } : e));
      return items;
    },
  };
}
