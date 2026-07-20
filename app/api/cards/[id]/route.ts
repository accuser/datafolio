import { NextResponse } from "next/server";
import { resolveRepoContext } from "@/lib/github/request-context";
import { createGitHubCardStore } from "@/lib/data/github-card-store";
import { resolveStandard } from "@/lib/data/github-store";
import { storeErrorResponse } from "@/lib/data/error-response";
import { validateCardPatch } from "@/lib/data/card-validation";

// PATCH /api/cards/:id → edit a card's text or mapping.
// DELETE /api/cards/:id → remove it.
//
// Both are owner-only for the same reason as POST: a reviewer has push access
// but revision is the learner's own preparation, not something to be reviewed.

const NOT_YOURS = "Revision cards belong to the learner — only they can change them.";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;
  if (!ctx.isOwner) return NextResponse.json({ error: NOT_YOURS }, { status: 403 });

  const { id } = await params;
  const standard = await resolveStandard(ctx);
  const valid = validateCardPatch(await request.json().catch(() => null), standard);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: valid.status ?? 400 });
  }

  try {
    const cards = await createGitHubCardStore(ctx, standard).updateCard(id, valid.patch);
    return NextResponse.json({ cards });
  } catch (e) {
    return storeErrorResponse("PATCH /api/cards/:id", e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;
  if (!ctx.isOwner) return NextResponse.json({ error: NOT_YOURS }, { status: 403 });

  const { id } = await params;
  try {
    const standard = await resolveStandard(ctx);
    const cards = await createGitHubCardStore(ctx, standard).deleteCard(id);
    return NextResponse.json({ cards });
  } catch (e) {
    return storeErrorResponse("DELETE /api/cards/:id", e);
  }
}
