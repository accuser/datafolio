import "server-only";
import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { requireGitHubConfig } from "./github/config";

// Encrypted, httpOnly session cookie (iron-session). Holds only the signed-in
// user's public identity and the repo they're currently working against — no
// long-lived GitHub token is persisted (repo access uses installation tokens).

export interface SessionUser {
  login: string;
  name: string;
  avatarUrl: string;
}

export interface SessionData {
  user?: SessionUser;
  /** The learner repo currently in view (owner = learner login). */
  target?: { owner: string; repo: string };
  /** CSRF state for the in-flight OAuth round-trip. */
  oauthState?: string;
}

const COOKIE_NAME = "datafolio_session";

export async function getSession(): Promise<IronSession<SessionData>> {
  const cfg = requireGitHubConfig();
  return getIronSession<SessionData>(await cookies(), {
    password: cfg.sessionSecret,
    cookieName: COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });
}
