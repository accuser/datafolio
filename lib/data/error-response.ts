import "server-only";
import { NextResponse } from "next/server";
import { CONFLICT_MESSAGE } from "../github/commit";
import { NotFoundError, type ResourceKind } from "./errors";

// Map a thrown store/GitHub error to a client-safe JSON response. Raw GitHub
// error text is logged server-side but never relayed to the client on a 502.

/** What a learner should read when a given resource kind is missing. */
const NOT_FOUND_MESSAGE: Record<ResourceKind, string> = {
  evidence: "That evidence item no longer exists.",
  card: "That revision card no longer exists.",
  repository:
    "We couldn’t find your portfolio repository. It may have been renamed or removed.",
};

/** A GitHub 404 for the repo itself — distinct from a missing item within it. */
function isRepoNotFound(e: unknown): boolean {
  return (e as { status?: number } | null)?.status === 404;
}

export function storeErrorResponse(context: string, e: unknown): NextResponse {
  // Identity, not prose. Matching on message text confused "Card <id> not
  // found" with a missing evidence item, and missed GitHub's own capital-N
  // "Not Found" entirely.
  if (e instanceof NotFoundError) {
    return NextResponse.json(
      { error: NOT_FOUND_MESSAGE[e.kind] },
      { status: 404 },
    );
  }
  if (isRepoNotFound(e)) {
    return NextResponse.json(
      { error: NOT_FOUND_MESSAGE.repository },
      { status: 404 },
    );
  }
  if ((e as Error)?.message === CONFLICT_MESSAGE) {
    return NextResponse.json({ error: CONFLICT_MESSAGE }, { status: 409 });
  }
  console.error(`${context} failed:`, e);
  return NextResponse.json(
    { error: "Something went wrong talking to GitHub. Please try again." },
    { status: 502 },
  );
}
