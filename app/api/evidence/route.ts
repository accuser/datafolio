import { NextResponse } from "next/server";
import { canWrite } from "@/lib/github/app";
import { resolveRepoContext } from "@/lib/github/request-context";
import { createGitHubStore } from "@/lib/data/github-store";
import type { Evidence } from "@/lib/types";

// GET  /api/evidence  → all evidence for the signed-in user's target repo.
export async function GET() {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;
  try {
    const store = createGitHubStore(ctx);
    const evidence = await store.load();
    const role = ctx.login.toLowerCase() === ctx.owner.toLowerCase() ? "learner" : "coach";
    return NextResponse.json({
      evidence,
      user: { login: ctx.login, name: ctx.name },
      repo: { owner: ctx.owner, repo: ctx.repo },
      role,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// POST /api/evidence  → commit a new evidence item (single atomic commit).
// Body: { item: Evidence, fileContentBase64?: string }
export async function POST(request: Request) {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;

  if (!(await canWrite(ctx.octokit, ctx.owner, ctx.repo, ctx.login))) {
    return NextResponse.json({ error: "You do not have write access to this repo" }, { status: 403 });
  }

  const body = (await request.json()) as { item?: Evidence; fileContentBase64?: string };
  if (!body.item || !body.item.title?.trim()) {
    return NextResponse.json({ error: "Missing evidence item" }, { status: 400 });
  }

  try {
    const store = createGitHubStore(ctx);
    const evidence = await store.addEvidence(body.item, {
      fileContentBase64: body.fileContentBase64,
    });
    return NextResponse.json({ evidence });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
