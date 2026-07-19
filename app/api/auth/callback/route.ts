import { type NextRequest, NextResponse } from "next/server";
import { getGitHubConfig } from "@/lib/github/config";
import { fetchUserPortfolios } from "@/lib/github/portfolios";
import { getSession } from "@/lib/session";

// Complete the OAuth round-trip: verify state, exchange the code for a
// user-to-server token, read the user's identity, enumerate the portfolios they
// can reach, and store all of that in the session. The token itself is not
// persisted — repo access uses installation tokens, and the portfolio list is
// cached so we never need the user token again.
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

  // Enumerate reachable portfolios while we still hold the user token; the list
  // is cached so the token can be discarded. A failure here must not block
  // sign-in — the switcher just falls back to an empty roster.
  let portfolios: Awaited<ReturnType<typeof fetchUserPortfolios>> = [];
  try {
    portfolios = await fetchUserPortfolios(tokenJson.access_token, u.login, cfg.repoName);
  } catch {
    portfolios = [];
  }
  session.portfolios = portfolios;

  // Land on the repo the coach asked for (?owner=...), else the user's own
  // portfolio, else — for a coach who owns none — the first portfolio they can
  // reach. This last case is what stops a coach-only user hitting a dead end on
  // a non-existent own-repo.
  if (!session.target?.owner) {
    const own = portfolios.find((p) => p.role === "learner");
    const fallback = own ?? portfolios[0];
    session.target = fallback
      ? { owner: fallback.owner, repo: fallback.repo }
      : { owner: u.login, repo: session.target?.repo || cfg.repoName };
  }
  session.oauthState = undefined;
  await session.save();

  return NextResponse.redirect(`${cfg.baseUrl}/`);
}
