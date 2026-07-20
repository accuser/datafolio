import type { Portfolio } from "../types";

// Enumerate the portfolios a signed-in user can reach. Uses the user-to-server
// token (plain fetch, like the auth routes) to intersect two facts GitHub
// already knows: which repos this user has access to, and where our App is
// installed. `GET /user/installations/{id}/repositories` returns exactly that
// intersection — repos the user reaches as owner OR collaborator, under an
// installation of this App. We filter to the portfolio repo name and derive
// the role. This surfaces nothing the user couldn't already open by hand; it's
// discovery, not new access.

const API = "https://api.github.com";
const PER_PAGE = 100;
// Defensive cap: a reviewer's roster is small, but never loop unbounded.
const MAX_PAGES = 10;
// The list is cached in the encrypted session cookie (~4KB browser limit) and
// sent on every request, so bound its length. Rosters this large are the
// provider-scale case the collaborator model doesn't target; truncating keeps
// the learner's own portfolio (sorted first) and the alphabetically-first
// reviewed repos rather than risking an oversized cookie.
const MAX_PORTFOLIOS = 50;

interface Installation {
  id: number;
}

interface Repo {
  name: string;
  owner: { login: string };
}

async function ghGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "DataFolio",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

/** Page through an endpoint that wraps its list under `key` (installations,
 *  repositories) until a short page is returned or the cap is hit. */
async function paginate<T>(
  token: string,
  path: string,
  key: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await ghGet<Record<string, T[]>>(
      token,
      `${path}${sep}per_page=${PER_PAGE}&page=${page}`,
    );
    const batch = data[key] ?? [];
    out.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return out;
}

/**
 * The portfolios `login` can reach, given their user token. `repoName` is the
 * shared portfolio repo name (env `DATAFOLIO_REPO_NAME`). Own repo → `learner`,
 * anything else → `reviewer`. Learner first, then reviewed repos alphabetically.
 */
export async function fetchUserPortfolios(
  token: string,
  login: string,
  repoName: string,
): Promise<Portfolio[]> {
  const installations = await paginate<Installation>(
    token,
    "/user/installations",
    "installations",
  );

  // Fan out the per-installation repo listings rather than paging serially —
  // this runs inside the OAuth callback, so sequential round-trips add straight
  // to sign-in latency. allSettled so one bad installation degrades to fewer
  // portfolios instead of wiping the whole roster.
  const results = await Promise.allSettled(
    installations.map((inst) =>
      paginate<Repo>(
        token,
        `/user/installations/${inst.id}/repositories`,
        "repositories",
      ),
    ),
  );

  const me = login.toLowerCase();
  const wanted = repoName.toLowerCase();
  const seen = new Set<string>();
  const portfolios: Portfolio[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const r of result.value) {
      // GitHub repo names match case-insensitively; align with owner handling
      // so a differently-cased DATAFOLIO_REPO_NAME can't silently drop everyone.
      if (r.name.toLowerCase() !== wanted) continue;
      const key = `${r.owner.login.toLowerCase()}/${r.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      portfolios.push({
        owner: r.owner.login,
        repo: r.name,
        role: r.owner.login.toLowerCase() === me ? "learner" : "reviewer",
      });
    }
  }

  portfolios.sort((a, b) => {
    if (a.role !== b.role) return a.role === "learner" ? -1 : 1;
    return a.owner.toLowerCase().localeCompare(b.owner.toLowerCase());
  });

  return portfolios.slice(0, MAX_PORTFOLIOS);
}

/**
 * The portfolio to land on after sign-in when the caller hasn't already pinned
 * one (e.g. a reviewer deep-linking `?owner=`): the user's own repo if they have
 * it, else the first portfolio they can reach — which is what stops a reviewer who
 * owns no portfolio hitting a dead end — else a best-effort own-login default.
 */
export function pickDefaultTarget(
  portfolios: Portfolio[],
  login: string,
  defaultRepo: string,
): { owner: string; repo: string } {
  const own = portfolios.find((p) => p.role === "learner");
  const fallback = own ?? portfolios[0];
  return fallback
    ? { owner: fallback.owner, repo: fallback.repo }
    : { owner: login, repo: defaultRepo };
}
