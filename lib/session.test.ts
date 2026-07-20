/**
 * Session sizing and OAuth-state rules.
 *
 * The roster cap exists solely to keep the sealed cookie under the browser's
 * ~4KB limit, and that limit was previously exceeded by a cap that had only been
 * reasoned about, never measured. These assertions do the measuring, so the cap
 * can't drift back over the line unnoticed.
 * Run: `npx tsx --conditions=react-server lib/session.test.ts`.
 */
import {
  OAUTH_STATE_TTL_MS,
  fitToCookie,
  isValidOAuthState,
  sealedLength,
  type SessionData,
} from "./session";
import { isValidOwner, isValidRepoName } from "./github/names";
import type { Portfolio } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const PASSWORD = "x".repeat(32);
/** Must track MAX_PORTFOLIOS in lib/github/portfolios.ts. */
const MAX_PORTFOLIOS = 30;
/** A cookie must fit in ~4KB *including* its name and attributes. */
const COOKIE_MAX_BYTES = 4096;

/**
 * A roster of `n` portfolios whose logins are `loginLength` characters.
 *
 * Length is a parameter because it dominates the sealed size — 39 is GitHub's
 * maximum login and roughly the worst case; 15 is a realistic one.
 */
function roster(n: number, loginLength = 39): Portfolio[] {
  return Array.from({ length: n }, (_, i) => ({
    owner: `apprentice-${String(i).padStart(2, "0")}-${"x".repeat(40)}`.slice(0, loginLength),
    repo: "portfolio-evidence",
    role: i === 0 ? ("learner" as const) : ("reviewer" as const),
  }));
}

function session(portfolios: Portfolio[]): SessionData {
  return {
    user: {
      login: "coach-with-a-long-github-login-name",
      name: "A Coach With A Fairly Long Display Name",
      avatarUrl: "https://avatars.githubusercontent.com/u/12345678?v=4",
    },
    target: { owner: "apprentice-00", repo: "portfolio-evidence" },
    portfolios,
  };
}

async function main() {
  // --- a realistic full roster fits without needing to be trimmed (#36) -----
  {
    const len = await sealedLength(session(roster(MAX_PORTFOLIOS, 15)), PASSWORD);
    assert(
      len < COOKIE_MAX_BYTES,
      `a full roster of ${MAX_PORTFOLIOS} typical logins seals to ${len} bytes, over ${COOKIE_MAX_BYTES}`,
    );
    console.log(`  ${MAX_PORTFOLIOS} portfolios (15-char logins) -> ${len} bytes sealed`);
  }

  // --- the previous cap of 50 overflowed even with short logins -------------
  {
    const len = await sealedLength(session(roster(50, 15)), PASSWORD);
    assert(
      len > COOKIE_MAX_BYTES,
      `the previous cap of 50 was expected to overflow, but sealed to only ${len} bytes`,
    );
  }

  // --- the cap alone is NOT sufficient, which is why fitToCookie exists -----
  // Sealed size scales with login length, so the same 30 entries overflow when
  // the logins are long. Any fix that only lowers the cap is incomplete.
  {
    const len = await sealedLength(session(roster(MAX_PORTFOLIOS, 39)), PASSWORD);
    assert(
      len > COOKIE_MAX_BYTES,
      `expected ${MAX_PORTFOLIOS} max-length logins to overflow (they seal to ${len}); ` +
        "if this now fits, the cap may be able to stand alone",
    );
  }

  // --- fitToCookie trims an oversized roster down to something that fits ----
  {
    const data = session(roster(200));
    const s = data as SessionData & { save: () => Promise<void> };
    const dropped = await fitToCookie(
      s as Parameters<typeof fitToCookie>[0],
      PASSWORD,
    );
    assert(dropped > 0, "an oversized roster reports how many were dropped");
    const kept = data.portfolios!.length;
    assert(kept + dropped === 200, `kept ${kept} + dropped ${dropped} accounts for all 200`);
    const len = await sealedLength(data, PASSWORD);
    assert(len < COOKIE_MAX_BYTES, `the trimmed session fits, got ${len} bytes`);
    // The learner's own portfolio sorts first, so trimming must never drop it.
    assert(data.portfolios![0].role === "learner", "the user's own portfolio survives trimming");
  }

  // --- a roster that already fits is left alone -----------------------------
  {
    const data = session(roster(5));
    const dropped = await fitToCookie(
      data as Parameters<typeof fitToCookie>[0],
      PASSWORD,
    );
    assert(dropped === 0, "nothing is dropped when the session already fits");
    assert(data.portfolios!.length === 5, "the roster is untouched");
  }

  // --- OAuth state: match, mismatch, absence, expiry (#39) ------------------
  {
    const now = 1_000_000;
    const stored = { value: "abc123", issuedAt: now };
    assert(isValidOAuthState(stored, "abc123", now), "a matching, fresh state is accepted");
    assert(!isValidOAuthState(stored, "abc124", now), "a mismatched state is rejected");
    assert(!isValidOAuthState(stored, "abc12", now), "a truncated state is rejected");
    assert(!isValidOAuthState(undefined, "abc123", now), "an absent state is rejected");
    assert(!isValidOAuthState(stored, null, now), "a missing callback state is rejected");
    assert(
      isValidOAuthState(stored, "abc123", now + OAUTH_STATE_TTL_MS - 1),
      "a state just inside the TTL is still accepted",
    );
    assert(
      !isValidOAuthState(stored, "abc123", now + OAUTH_STATE_TTL_MS + 1),
      "a state past the TTL is rejected, so a stale one can't be replayed",
    );
  }

  // --- name grammar (#38) ---------------------------------------------------
  {
    assert(isValidOwner("accuser"), "a plain login is valid");
    assert(isValidOwner("a-b-c"), "hyphens are valid in a login");
    assert(isValidOwner("a".repeat(39)), "39 characters is the maximum login");
    assert(!isValidOwner("a".repeat(40)), "40 characters is too long");
    assert(!isValidOwner("-leading"), "a login can't start with a hyphen");
    assert(!isValidOwner("has space"), "spaces are rejected");
    assert(!isValidOwner("../../etc"), "path traversal is rejected");
    assert(!isValidOwner("owner/repo"), "a slash is rejected");
    assert(!isValidOwner(""), "an empty owner is not a valid owner");

    assert(isValidRepoName("portfolio-evidence"), "the default repo name is valid");
    assert(isValidRepoName("my.repo_name-1"), "dots, underscores and hyphens are valid");
    assert(!isValidRepoName(".."), "`..` is rejected");
    assert(!isValidRepoName("."), "`.` is rejected");
    assert(!isValidRepoName("a/b"), "a slash is rejected in a repo name");
    assert(!isValidRepoName(""), "an empty repo name is rejected");
  }

  console.log("SESSION OK — sealed cookie fits, roster trims, OAuth state expires, names validated");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
