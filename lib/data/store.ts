import { DEFAULT_STANDARD_ID } from "../standards";
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
 *   - updateEvidence → reviewer approve / request-changes: patch the matching
 *                     evidence item's `status` + `feedback`.
 * The UI never talks to GitHub directly — only through this interface — so the
 * screens are identical in both modes.
 */
/** Extra payload for adds — file bytes for upload-type evidence. */
export interface AddOptions {
  fileContentBase64?: string;
}

/**
 * A load carries the portfolio's standard alongside its evidence: which KSBs
 * exist, and how each is assessed, is a property of the repo (its datafolio.yml)
 * rather than of the app.
 */
export interface StoreLoad {
  evidence: Evidence[];
  standardId: string;
  /** Set when the repo's manifest named a standard that could not be used. */
  manifestWarning?: string;
}

export interface EvidenceStore {
  /** Read all evidence for the signed-in learner's repo, plus its standard. */
  load(): Promise<StoreLoad>;
  /** Commit a new evidence item; resolves to the updated collection. */
  addEvidence(item: Evidence, opts?: AddOptions): Promise<Evidence[]>;
  /** Patch an existing item (reviewer review / edits); resolves to the collection. */
  updateEvidence(id: string, patch: Partial<Evidence>): Promise<Evidence[]>;
  /** Delete an item (and its uploaded file); resolves to the collection. */
  deleteEvidence(id: string): Promise<Evidence[]>;
}

export function createMockStore(
  seed: Evidence[],
  standardId = DEFAULT_STANDARD_ID,
): EvidenceStore {
  let items: Evidence[] = seed.map((e) => ({ ...e }));
  return {
    async load() {
      return { evidence: items, standardId };
    },
    async addEvidence(item) {
      // Mock mode has no repo; file bytes are ignored.
      items = [item, ...items];
      return items;
    },
    async updateEvidence(id, patch) {
      items = items.map((e) => (e.id === id ? { ...e, ...patch } : e));
      return items;
    },
    async deleteEvidence(id) {
      items = items.filter((e) => e.id !== id);
      return items;
    },
  };
}
