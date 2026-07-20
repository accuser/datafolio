import { type NextRequest, NextResponse } from "next/server";
import { getGitHubConfig } from "@/lib/github/config";
import { fetchUserPortfolios, pickDefaultTarget } from "@/lib/github/portfolios";
import { fitToCookie, getSession, isValidOAuthState } from "@/lib/session";

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
  // Any exit from here on is a dead sign-in attempt, so the state dies with it:
  // leaving it behind left a used-or-rejected state replayable for as long as
  // the session survived.
  const fail = async (reason: string) => {
    session.oauthState = undefined;
    await session.save();
    return NextResponse.redirect(`${cfg.baseUrl}/?auth=${encodeURIComponent(reason)}`);
  };

  if (!code || !isValidOAuthState(session.oauthState, state)) {
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
  if (!tokenJson.access_token) return await fail("token");

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "DataFolio",
    },
  });
  if (!userRes.ok) return await fail("user");
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

  // Land on the repo the reviewer asked for (?owner=...); otherwise pick a sensible
  // default (own portfolio, else the first reachable one — the dead-end fix).
  if (!session.target?.owner) {
    session.target = pickDefaultTarget(
      portfolios,
      u.login,
      session.target?.repo || cfg.repoName,
    );
  }
  session.oauthState = undefined;

  // The roster's length cap is a guess at what fits; this is the measurement.
  // An oversized cookie is dropped by the browser without an error, which would
  // land the user back on the sign-in screen with no way to tell why.
  const dropped = await fitToCookie(session, cfg.sessionSecret);
  await session.save();

  const landing = new URL(`${cfg.baseUrl}/`);
  if (dropped > 0) landing.searchParams.set("portfolios", `truncated-${dropped}`);
  return NextResponse.redirect(landing.toString());
}
