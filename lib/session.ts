import "server-only";
import { getIronSession, sealData, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { requireGitHubConfig } from "./github/config";
import type { Portfolio } from "./types";

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
  /**
   * Portfolios the user can reach (own + those they review), enumerated once at
   * sign-in. Cached here rather than re-derived per request so we never hold a
   * long-lived GitHub token — the switcher reads this list directly.
   *
   * This lives in the encrypted cookie, which browsers cap at ~4KB and drop
   * *silently* when it's exceeded — a coach with a large roster would complete
   * OAuth and land back signed out, forever, with no error anywhere. The list is
   * length-capped at enumeration time (see MAX_PORTFOLIOS), and `fitToCookie`
   * measures the actual sealed payload before saving rather than trusting that
   * cap to have been calculated correctly.
   */
  portfolios?: Portfolio[];
  /** CSRF state for the in-flight OAuth round-trip. */
  oauthState?: OAuthState;
}

/**
 * The in-flight OAuth state, with the time it was issued.
 *
 * Timestamped so a state left behind by an abandoned or failed sign-in can't be
 * replayed indefinitely.
 */
export interface OAuthState {
  value: string;
  /** ms since epoch, per `Date.now()`. */
  issuedAt: number;
}

/** How long an unused OAuth state stays valid. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** True when `state` is present, unexpired, and matches what came back. */
export function isValidOAuthState(
  stored: OAuthState | undefined,
  returned: string | null,
  now: number = Date.now(),
): boolean {
  if (!stored?.value || !returned) return false;
  if (now - stored.issuedAt > OAUTH_STATE_TTL_MS) return false;
  // Compare the whole string regardless of where it first differs, so the
  // comparison's duration can't be used to recover the expected value.
  if (stored.value.length !== returned.length) return false;
  let diff = 0;
  for (let i = 0; i < stored.value.length; i++) {
    diff |= stored.value.charCodeAt(i) ^ returned.charCodeAt(i);
  }
  return diff === 0;
}

const COOKIE_NAME = "datafolio_session";

/** Browsers drop a cookie larger than ~4KB, silently and without an error. */
const COOKIE_MAX_BYTES = 4096;
/** Room for `datafolio_session=` plus Path/HttpOnly/SameSite/Secure/Expires. */
const COOKIE_ATTRIBUTE_BUDGET = 256;
const SEALED_BUDGET = COOKIE_MAX_BYTES - COOKIE_ATTRIBUTE_BUDGET - COOKIE_NAME.length - 1;

/** The stored fields only — an IronSession also carries save/destroy methods. */
function payload(data: SessionData): SessionData {
  return {
    ...(data.user ? { user: data.user } : {}),
    ...(data.target ? { target: data.target } : {}),
    ...(data.portfolios ? { portfolios: data.portfolios } : {}),
    ...(data.oauthState ? { oauthState: data.oauthState } : {}),
  };
}

/** Byte length of the sealed cookie value for a given payload. */
export async function sealedLength(
  data: SessionData,
  password: string,
): Promise<number> {
  return (await sealData(payload(data), { password })).length;
}

/**
 * Drop portfolios until the sealed session actually fits in a cookie.
 *
 * The length cap on the roster exists precisely to prevent an oversized cookie,
 * but it was a guess, and the guess was wrong — so this measures the real sealed
 * payload instead. Binary search rather than dropping one at a time: sealing is
 * key-derivation work, and a linear walk down a full roster would add seconds to
 * sign-in.
 *
 * Returns how many were dropped, so the caller can tell the user their roster is
 * incomplete rather than quietly showing them a short list.
 */
export async function fitToCookie(
  session: IronSession<SessionData>,
  password: string,
): Promise<number> {
  const all = session.portfolios ?? [];
  if (!all.length) return 0;
  const fits = async (n: number) =>
    (await sealedLength({ ...payload(session), portfolios: all.slice(0, n) }, password)) <=
    SEALED_BUDGET;

  if (await fits(all.length)) return 0;

  // Largest prefix that fits. `lo` is known-good (0 always fits: if even an
  // empty roster doesn't, no amount of trimming helps and we save what we can).
  let lo = 0;
  let hi = all.length;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await fits(mid)) lo = mid;
    else hi = mid;
  }
  session.portfolios = all.slice(0, lo);
  return all.length - lo;
}

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
