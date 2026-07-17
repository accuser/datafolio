import { type NextRequest, NextResponse } from "next/server";
import { getGitHubConfig } from "@/lib/github/config";
import { getSession } from "@/lib/session";

// Complete the OAuth round-trip: verify state, exchange the code for a
// user-to-server token, read the user's identity, and store it in the session.
// The token itself is not persisted — repo access uses installation tokens.
export async function GET(req: NextRequest) {
  const cfg = getGitHubConfig();
  if (!cfg) {
    return NextResponse.json({ error: "GitHub App not configured" }, { status: 501 });
  }

  const session = await getSession();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const fail = (reason: string) =>
    NextResponse.redirect(`${cfg.baseUrl}/?auth=${encodeURIComponent(reason)}`);

  if (!code || !state || !session.oauthState || state !== session.oauthState) {
    return fail("state");
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: `${cfg.baseUrl}/api/auth/callback`,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return fail("token");

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "DataFolio",
    },
  });
  if (!userRes.ok) return fail("user");
  const u = (await userRes.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
  };

  session.user = { login: u.login, name: u.name || u.login, avatarUrl: u.avatar_url };
  if (!session.target?.owner) {
    session.target = { owner: u.login, repo: session.target?.repo || cfg.repoName };
  }
  session.oauthState = undefined;
  await session.save();

  return NextResponse.redirect(`${cfg.baseUrl}/`);
}
