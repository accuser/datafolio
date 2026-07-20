import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getGitHubConfig } from "@/lib/github/config";
import { getSession } from "@/lib/session";

// Start the GitHub App user OAuth (user-to-server) flow. A learner is sent to
// their own repo by default; a reviewer can target a learner's repo with
// ?owner=<learner-login>[&repo=<repo>].
export async function GET(req: NextRequest) {
  const cfg = getGitHubConfig();
  if (!cfg) {
    return NextResponse.json({ error: "GitHub App not configured" }, { status: 501 });
  }

  const session = await getSession();
  const state = randomBytes(16).toString("hex");
  session.oauthState = state;
  session.target = {
    owner: req.nextUrl.searchParams.get("owner") || "",
    repo: req.nextUrl.searchParams.get("repo") || cfg.repoName,
  };
  await session.save();

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", cfg.clientId);
  authorize.searchParams.set("redirect_uri", `${cfg.baseUrl}/api/auth/callback`);
  authorize.searchParams.set("state", state);
  return NextResponse.redirect(authorize.toString());
}
