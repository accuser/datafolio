/**
 * Network-free unit test for fetchUserPortfolios. Stubs global fetch with a
 * canned GitHub App installations/repositories view and asserts the filtering
 * (portfolio repo name only), role derivation (own = learner, else reviewer),
 * de-duping and ordering. Run: `tsx lib/github/portfolios.test.ts`.
 */
import { fetchUserPortfolios, pickDefaultTarget } from "./portfolios";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const REPO = "portfolio-evidence";

/** Build a fetch stub from an installation-id → repos map. */
function stubFetch(
  installationIds: number[],
  reposByInstallation: Record<number, Array<{ name: string; owner: string }>>,
) {
  return async (url: string | URL): Promise<Response> => {
    const path = new URL(url.toString()).pathname;
    const json = (body: unknown) =>
      ({ ok: true, status: 200, json: async () => body }) as Response;

    if (path === "/user/installations") {
      return json({ installations: installationIds.map((id) => ({ id })) });
    }
    const m = path.match(/^\/user\/installations\/(\d+)\/repositories$/);
    if (m) {
      const repos = (reposByInstallation[Number(m[1])] ?? []).map((r) => ({
        name: r.name,
        owner: { login: r.owner },
      }));
      return json({ repositories: repos });
    }
    throw new Error("unexpected path " + path);
  };
}

async function withFetch<T>(fn: () => Promise<T>, stub: typeof fetch): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = stub as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

async function main() {
  // --- own repo → learner; collaborator repos → reviewer; sorted learner-first ---
  {
    const stub = stubFetch([1, 2, 3], {
      1: [{ name: REPO, owner: "alice" }], // own
      2: [{ name: REPO, owner: "bob" }], // reviewered
      3: [{ name: REPO, owner: "carol" }], // reviewered
    });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "alice", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 3, "three portfolios found");
    assert(result[0].owner === "alice" && result[0].role === "learner", "own repo is learner, first");
    assert(result[1].owner === "bob" && result[1].role === "reviewer", "bob reviewered, alphabetical");
    assert(result[2].owner === "carol" && result[2].role === "reviewer", "carol reviewered, after bob");
  }

  // --- non-portfolio repos are filtered out ---
  {
    const stub = stubFetch([1], {
      1: [
        { name: REPO, owner: "alice" },
        { name: "some-other-repo", owner: "alice" },
        { name: "dotfiles", owner: "bob" },
      ],
    });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "alice", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 1, "only the portfolio repo survives the name filter");
    assert(result[0].owner === "alice", "the surviving repo is the portfolio repo");
  }

  // --- a reviewer who owns no portfolio: all reviewered, no learner entry ---
  {
    const stub = stubFetch([1, 2], {
      1: [{ name: REPO, owner: "bob" }],
      2: [{ name: REPO, owner: "carol" }],
    });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "revieweronly", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 2, "reviewer-only sees both reviewered repos");
    assert(
      result.every((p) => p.role === "reviewer"),
      "reviewer-only has no learner entry",
    );
  }

  // --- the same repo seen via two installations is de-duped ---
  {
    const stub = stubFetch([1, 2], {
      1: [{ name: REPO, owner: "bob" }],
      2: [{ name: REPO, owner: "bob" }],
    });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "alice", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 1, "duplicate owner/repo collapsed to one");
  }

  // --- case-insensitive owner match for the learner role ---
  {
    const stub = stubFetch([1], { 1: [{ name: REPO, owner: "Alice" }] });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "alice", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result[0].role === "learner", "owner match is case-insensitive");
  }

  // --- case-insensitive repo-name filter (differently-cased repo still matches) ---
  {
    const stub = stubFetch([1], {
      1: [
        { name: "Portfolio-Evidence", owner: "alice" },
        { name: "not-it", owner: "bob" },
      ],
    });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "alice", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 1, "differently-cased repo name still matches");
    assert(result[0].owner === "alice", "the cased portfolio repo is kept");
  }

  // --- one failing installation degrades gracefully (allSettled) ---
  {
    const stub = async (url: string | URL): Promise<Response> => {
      const path = new URL(url.toString()).pathname;
      const json = (body: unknown) =>
        ({ ok: true, status: 200, json: async () => body }) as Response;
      if (path === "/user/installations") {
        return json({ installations: [{ id: 1 }, { id: 2 }] });
      }
      if (path === "/user/installations/1/repositories") {
        return { ok: false, status: 500 } as Response; // this one blows up
      }
      return json({ repositories: [{ name: REPO, owner: { login: "bob" } }] });
    };
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "alice", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 1 && result[0].owner === "bob", "surviving installation still yields its portfolios");
  }

  // --- roster is length-capped for cookie safety (learner kept, first) ---
  {
    const many = Array.from({ length: 80 }, (_, i) => ({
      name: REPO,
      owner: `reviewer-${String(i).padStart(3, "0")}`,
    }));
    many.push({ name: REPO, owner: "alice" }); // the user's own, unsorted position
    const stub = stubFetch([1], { 1: many });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "alice", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 30, "roster capped at MAX_PORTFOLIOS");
    assert(result[0].owner === "alice" && result[0].role === "learner", "own portfolio survives the cap, first");
  }

  // --- pickDefaultTarget: own repo wins ---
  {
    const portfolios = [
      { owner: "alice", repo: REPO, role: "learner" as const },
      { owner: "bob", repo: REPO, role: "reviewer" as const },
    ];
    const t = pickDefaultTarget(portfolios, "alice", REPO);
    assert(t.owner === "alice" && t.repo === REPO, "own portfolio is the default target");
  }

  // --- pickDefaultTarget: reviewer with no own repo lands on the first reachable (the dead-end fix) ---
  {
    const portfolios = [
      { owner: "bob", repo: REPO, role: "reviewer" as const },
      { owner: "carol", repo: REPO, role: "reviewer" as const },
    ];
    const t = pickDefaultTarget(portfolios, "revieweronly", REPO);
    assert(t.owner === "bob" && t.repo === REPO, "reviewer-only lands on first reachable portfolio, not a dead end");
  }

  // --- pickDefaultTarget: no portfolios → best-effort own-login default ---
  {
    const t = pickDefaultTarget([], "newbie", REPO);
    assert(t.owner === "newbie" && t.repo === REPO, "empty roster falls back to own login + default repo");
  }

  console.log("portfolios.test.ts: all assertions passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
