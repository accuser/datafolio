import { NextResponse } from "next/server";
import { canWrite } from "@/lib/github/app";
import { resolveRepoContext } from "@/lib/github/request-context";
import { createGitHubStore } from "@/lib/data/github-store";
import type { Evidence } from "@/lib/types";

// PATCH /api/evidence/:id  → update an item (coach approve / request-changes,
// or learner edits). Body: { patch: Partial<Evidence> }. Commits atomically.
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
  const body = (await request.json()) as { patch?: Partial<Evidence> };
  if (!body.patch) {
    return NextResponse.json({ error: "Missing patch" }, { status: 400 });
  }

  try {
    const store = createGitHubStore(ctx);
    const evidence = await store.updateEvidence(id, body.patch);
    return NextResponse.json({ evidence });
  } catch (e) {
    const message = (e as Error).message;
    const status = message.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
