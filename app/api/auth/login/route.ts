import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getGitHubConfig } from "@/lib/github/config";
import { isValidOwner, isValidRepoName } from "@/lib/github/names";
import { getSession } from "@/lib/session";

// Start the GitHub App user OAuth (user-to-server) flow. A learner is sent to
// their own repo by default; a reviewer can target a learner's repo with
// ?owner=<learner-login>[&repo=<repo>].
export async function GET(req: NextRequest) {
  const cfg = getGitHubConfig();
  if (!cfg) {
    return NextResponse.json({ error: "GitHub App not configured" }, { status: 501 });
  }

  // Only ever store names that could actually be a GitHub repo. An empty owner
  // is the normal case (the learner's own repo, resolved after sign-in); a
  // malformed one is discarded rather than persisted.
  const owner = req.nextUrl.searchParams.get("owner") || "";
  const repo = req.nextUrl.searchParams.get("repo") || cfg.repoName;
  if (owner && !isValidOwner(owner)) {
    return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
  }
  if (!isValidRepoName(repo)) {
    return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
  }

  const session = await getSession();
  const state = randomBytes(16).toString("hex");
  session.oauthState = { value: state, issuedAt: Date.now() };
  session.target = { owner, repo };
  await session.save();

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", cfg.clientId);
  authorize.searchParams.set("redirect_uri", `${cfg.baseUrl}/api/auth/callback`);
  authorize.searchParams.set("state", state);
  return NextResponse.redirect(authorize.toString());
}
