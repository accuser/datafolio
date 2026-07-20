import { NextResponse } from "next/server";
import { canWrite } from "@/lib/github/app";
import { resolveRepoContext } from "@/lib/github/request-context";
import { createGitHubStore, resolveStandard } from "@/lib/data/github-store";
import { storeErrorResponse } from "@/lib/data/error-response";
import { validateNewEvidence } from "@/lib/data/validation";

// GET  /api/evidence  → all evidence for the signed-in user's target repo.
export async function GET() {
  const res = await resolveRepoContext();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { ctx } = res;
  try {
    const store = createGitHubStore(ctx);
    const { evidence, standardId, manifestWarning } = await store.load();
    const role = ctx.isOwner ? "learner" : "reviewer";
    return NextResponse.json({
      evidence,
      standardId,
      ...(manifestWarning ? { manifestWarning } : {}),
      user: { login: ctx.login, name: ctx.name },
      repo: { owner: ctx.owner, repo: ctx.repo },
      role,
    });
  } catch (e) {
    return storeErrorResponse("GET /api/evidence", e);
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

  const standard = await resolveStandard(ctx);
  const valid = validateNewEvidence(await request.json().catch(() => null), standard);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  try {
    const store = createGitHubStore(ctx);
    const evidence = await store.addEvidence(valid.item, {
      fileContentBase64: valid.fileContentBase64,
    });
    return NextResponse.json({ evidence });
  } catch (e) {
    return storeErrorResponse("POST /api/evidence", e);
  }
}
