import { NextResponse } from "next/server";
import { resolveRepoContext } from "@/lib/github/request-context";
import { createGitHubCardStore, loadCards } from "@/lib/data/github-card-store";
import { resolveStandard } from "@/lib/data/github-store";
import { storeErrorResponse } from "@/lib/data/error-response";
import { validateNewCards } from "@/lib/data/card-validation";
import { canWriteCards } from "@/lib/data/authz";
import { cardsEnabledServer } from "@/lib/flags";

// Revision cards for the signed-in user's target repo.
//
// Writes are owner-only. A reviewer has push access to the repo, so the App
// token would happily commit for them — but revision is the learner's own
// preparation and a reviewer has no business editing it. Reads are left open to
// anyone with repo access, matching the decision that cards are "not surfaced
// in the reviewer's app" rather than hidden from a collaborator who can already
// read the repo.
//
// While the feature is held back (lib/flags.ts) every handler here answers 404
// before doing any work. Hiding the UI alone would leave these reachable to
// anyone with a session cookie and curl, and a pilot repository is meant to
// hold evidence and nothing else. 404 rather than 403 because the claim is that
// the endpoint is not part of this release, not that the caller lacks rights.
function heldBack() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// GET /api/cards → every revision card in the repo.
export async function GET() {
  if (!cardsEnabledServer()) return heldBack();
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;
  try {
    return NextResponse.json({ cards: await loadCards(ctx) });
  } catch (e) {
    return storeErrorResponse("GET /api/cards", e);
  }
}

// POST /api/cards → commit one or more cards as a single commit.
// Body: { cards: Card[] }
export async function POST(request: Request) {
  if (!cardsEnabledServer()) return heldBack();
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;
  const auth = canWriteCards(ctx.isOwner);
  if (!auth.allow) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const standard = await resolveStandard(ctx);
  const valid = validateNewCards(await request.json().catch(() => null), standard);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: valid.status ?? 400 });
  }

  try {
    const cards = await createGitHubCardStore(ctx, standard).addCards(valid.cards);
    return NextResponse.json({ cards });
  } catch (e) {
    return storeErrorResponse("POST /api/cards", e);
  }
}
