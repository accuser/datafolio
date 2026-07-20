// The learner's repo declares which occupational standard it follows in a
// `datafolio.yml` at the repo root:
//
//     standard: st0585
//
// Parsing is forgiving by design. A learner's repo is user-editable and a typo
// there must not break their portfolio — an unreadable or absent manifest falls
// back to the default standard, and the caller can surface a warning.

import { load } from "js-yaml";
import { DEFAULT_STANDARD_ID, isStandardId, STANDARD_IDS } from "./index";

/** Path of the manifest within a learner's portfolio repo. */
export const MANIFEST_PATH = "datafolio.yml";

export interface Manifest {
  standardId: string;
  /** Set when the declared standard could not be used, for the UI to surface. */
  warning?: string;
}

const FALLBACK: Manifest = { standardId: DEFAULT_STANDARD_ID };

/**
 * Resolve the standard for a portfolio from its manifest text.
 *
 * @param text Contents of datafolio.yml, or null when the file is absent.
 */
export function readManifest(text: string | null | undefined): Manifest {
  if (text == null || text.trim() === "") return FALLBACK;

  let doc: unknown;
  try {
    doc = load(text);
  } catch {
    return {
      standardId: DEFAULT_STANDARD_ID,
      warning: `${MANIFEST_PATH} is not valid YAML — falling back to ${DEFAULT_STANDARD_ID}.`,
    };
  }

  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return {
      standardId: DEFAULT_STANDARD_ID,
      warning: `${MANIFEST_PATH} should be a mapping with a "standard:" key — falling back to ${DEFAULT_STANDARD_ID}.`,
    };
  }

  const raw = (doc as Record<string, unknown>).standard;
  if (raw === undefined || raw === null) return FALLBACK;

  const id = String(raw).trim().toLowerCase();
  if (!isStandardId(id)) {
    return {
      standardId: DEFAULT_STANDARD_ID,
      warning: `${MANIFEST_PATH} names an unknown standard "${id}". Known standards: ${STANDARD_IDS.join(", ")}. Falling back to ${DEFAULT_STANDARD_ID}.`,
    };
  }

  return { standardId: id };
}
