import { NextResponse } from "next/server";
import { canWrite } from "@/lib/github/app";
import { resolveRepoContext } from "@/lib/github/request-context";
import { createGitHubStore, resolveStandard } from "@/lib/data/github-store";
import { storeErrorResponse } from "@/lib/data/error-response";
import { validateEvidencePatch } from "@/lib/data/validation";
import { canDeleteEvidence, canSetStatus } from "@/lib/data/authz";

// PATCH /api/evidence/:id  → update an item (reviewer approve / request-changes,
// or learner edit / resubmit). Body: { patch: Partial<Evidence> }. Commits
// atomically. Only a validated subset of fields may be changed.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;

  if (!(await canWrite(ctx.octokit, ctx.owner, ctx.repo, ctx.login))) {
    return NextResponse.json({ error: "You do not have write access to this repo" }, { status: 403 });
  }

  const { id } = await params;

  // The repo owner is the learner; a collaborator is the reviewer. Role-specific
  // write rules (a learner may not set reviewer feedback; editing content downgrades
  // status) are enforced in validateEvidencePatch given this flag.
  const standard = await resolveStandard(ctx);
  const valid = validateEvidencePatch(await request.json().catch(() => null), {
    isOwner: ctx.isOwner,
    standard,
  });
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: valid.status ?? 400 });
  }

  // Enforce the status partition server-side — the client role toggle must not
  // let a learner approve their own evidence, nor a reviewer submit or withdraw
  // someone else's. See lib/data/authz.ts. This runs after validation rather
  // than before it because it authorises the status *value*, which has to be
  // parsed out of the body first.
  const move = canSetStatus(ctx.isOwner, valid.patch.status);
  if (!move.allow) {
    return NextResponse.json({ error: move.error }, { status: move.status });
  }

  try {
    const store = createGitHubStore(ctx);
    const evidence = await store.updateEvidence(id, valid.patch);
    return NextResponse.json({ evidence });
  } catch (e) {
    return storeErrorResponse("PATCH /api/evidence/:id", e);
  }
}

// DELETE /api/evidence/:id  → remove an item (and its uploaded file).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;

  // A reviewer reviews but must not remove a learner's evidence — the same
  // boundary the UI enforces by hiding delete. See lib/data/authz.ts. Ahead of
  // the `canWrite` round-trip for the same reason as the POST path: the pure
  // rule is strictly narrower, so it costs nothing to ask it first.
  const del = canDeleteEvidence(ctx.isOwner);
  if (!del.allow) {
    return NextResponse.json({ error: del.error }, { status: del.status });
  }

  if (!(await canWrite(ctx.octokit, ctx.owner, ctx.repo, ctx.login))) {
    return NextResponse.json({ error: "You do not have write access to this repo" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const store = createGitHubStore(ctx);
    const evidence = await store.deleteEvidence(id);
    return NextResponse.json({ evidence });
  } catch (e) {
    return storeErrorResponse("DELETE /api/evidence/:id", e);
  }
}
