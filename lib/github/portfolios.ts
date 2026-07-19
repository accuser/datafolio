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
// Defensive cap: a coach's roster is small, but never loop unbounded.
const MAX_PAGES = 10;

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
 * anything else → `coach`. Learner first, then coached repos alphabetically.
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

  const me = login.toLowerCase();
  const seen = new Set<string>();
  const portfolios: Portfolio[] = [];

  for (const inst of installations) {
    const repos = await paginate<Repo>(
      token,
      `/user/installations/${inst.id}/repositories`,
      "repositories",
    );
    for (const r of repos) {
      if (r.name !== repoName) continue;
      const key = `${r.owner.login.toLowerCase()}/${r.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      portfolios.push({
        owner: r.owner.login,
        repo: r.name,
        role: r.owner.login.toLowerCase() === me ? "learner" : "coach",
      });
    }
  }

  return portfolios.sort((a, b) => {
    if (a.role !== b.role) return a.role === "learner" ? -1 : 1;
    return a.owner.toLowerCase().localeCompare(b.owner.toLowerCase());
  });
}
