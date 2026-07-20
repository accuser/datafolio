import "server-only";
import { getStandard, type Standard } from "../standards";
import { MANIFEST_PATH, readManifest } from "../standards/manifest";
import { readBlob, type RepoRef, type RepoTree } from "../github/repo-tree";

// Which standard a portfolio follows is a property of the repo (its
// datafolio.yml), not of the app — so both stores have to answer the same
// question from the same snapshot they read everything else from.

export interface PortfolioStandard {
  standard: Standard;
  /** Set when the manifest named a standard that could not be used. */
  warning?: string;
}

/**
 * Resolve the portfolio's standard from a tree snapshot already in hand.
 *
 * Costs one blob read when datafolio.yml is present and nothing at all when it
 * isn't, rather than a separate Contents API round-trip per caller.
 */
export async function standardFromTree(
  ctx: RepoRef,
  tree: RepoTree,
): Promise<PortfolioStandard> {
  const sha = tree.blobShas.get(MANIFEST_PATH);
  const manifest = readManifest(sha ? await readBlob(ctx, sha) : null);
  return {
    standard: getStandard(manifest.standardId),
    ...(manifest.warning ? { warning: manifest.warning } : {}),
  };
}
