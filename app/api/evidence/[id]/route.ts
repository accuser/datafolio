import { NextResponse } from "next/server";
import { canWrite } from "@/lib/github/app";
import { resolveRepoContext } from "@/lib/github/request-context";
import { createGitHubStore, CONFLICT_MESSAGE } from "@/lib/data/github-store";
import { validateEvidencePatch } from "@/lib/data/validation";

// PATCH /api/evidence/:id  → update an item (coach approve / request-changes,
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
  const valid = validateEvidencePatch(await request.json().catch(() => null));
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  // A review verdict (Approve / Request changes) is a coach action. The repo
  // owner is the learner, so reject self-review server-side — the client role
  // toggle must not let a learner approve their own evidence.
  const isOwner = ctx.login.toLowerCase() === ctx.owner.toLowerCase();
  if (isOwner && (valid.patch.status === "Approved" || valid.patch.status === "Changes")) {
    return NextResponse.json(
      { error: "You can’t review your own evidence — only a coach can approve or request changes." },
      { status: 403 },
    );
  }

  try {
    const store = createGitHubStore(ctx);
    const evidence = await store.updateEvidence(id, valid.patch);
    return NextResponse.json({ evidence });
  } catch (e) {
    const message = (e as Error).message;
    const status = message.includes("not found")
      ? 404
      : message === CONFLICT_MESSAGE
        ? 409
        : 502;
    return NextResponse.json({ error: message }, { status });
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

  if (!(await canWrite(ctx.octokit, ctx.owner, ctx.repo, ctx.login))) {
    return NextResponse.json({ error: "You do not have write access to this repo" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const store = createGitHubStore(ctx);
    const evidence = await store.deleteEvidence(id);
    return NextResponse.json({ evidence });
  } catch (e) {
    const message = (e as Error).message;
    const status = message.includes("not found")
      ? 404
      : message === CONFLICT_MESSAGE
        ? 409
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
