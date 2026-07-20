import { NextResponse } from "next/server";
import { resolveRepoContext } from "@/lib/github/request-context";
import { createGitHubCardStore } from "@/lib/data/github-card-store";
import { resolveStandard } from "@/lib/data/github-store";
import { storeErrorResponse } from "@/lib/data/error-response";
import { validateNewCards } from "@/lib/data/card-validation";

// Revision cards for the signed-in user's target repo.
//
// Writes are owner-only. A reviewer has push access to the repo, so the App
// token would happily commit for them — but revision is the learner's own
// preparation and a reviewer has no business editing it. Reads are left open to
// anyone with repo access, matching the decision that cards are "not surfaced
// in the reviewer's app" rather than hidden from a collaborator who can already
// read the repo.

/** True when the signed-in user is the repo owner, i.e. the learner. */
function isOwner(ctx: { login: string; owner: string }): boolean {
  return ctx.login.toLowerCase() === ctx.owner.toLowerCase();
}

const NOT_YOURS = "Revision cards belong to the learner — only they can change them.";

// GET /api/cards → every revision card in the repo.
export async function GET() {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;
  try {
    const standard = await resolveStandard(ctx);
    const cards = await createGitHubCardStore(ctx, standard).load();
    return NextResponse.json({ cards });
  } catch (e) {
    return storeErrorResponse("GET /api/cards", e);
  }
}

// POST /api/cards → commit one or more cards as a single commit.
// Body: { cards: Card[] }
export async function POST(request: Request) {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;
  if (!isOwner(ctx)) return NextResponse.json({ error: NOT_YOURS }, { status: 403 });

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
