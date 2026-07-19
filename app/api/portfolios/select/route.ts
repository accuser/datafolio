import { type NextRequest, NextResponse } from "next/server";
import { isGitHubConfigured } from "@/lib/github/config";
import { getSession } from "@/lib/session";

// Switch the session's active portfolio. The pick must be one the user was
// found to reach at sign-in (session.portfolios) — this is belt-and-braces on
// top of the per-request canRead guard, and stops the target being set to an
// arbitrary repo the user can't actually see.
export async function POST(req: NextRequest) {
  if (!isGitHubConfigured()) {
    return NextResponse.json({ error: "GitHub App not configured" }, { status: 501 });
  }

  const session = await getSession();
  if (!session.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    owner?: unknown;
    repo?: unknown;
  };
  const owner = typeof body.owner === "string" ? body.owner : "";
  const repo = typeof body.repo === "string" ? body.repo : "";
  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
  }

  const match = (session.portfolios ?? []).find(
    (p) =>
      p.owner.toLowerCase() === owner.toLowerCase() &&
      p.repo.toLowerCase() === repo.toLowerCase(),
  );
  if (!match) {
    return NextResponse.json({ error: "Not one of your portfolios" }, { status: 403 });
  }

  session.target = { owner: match.owner, repo: match.repo };
  await session.save();
  return NextResponse.json({ ok: true, target: session.target });
}
