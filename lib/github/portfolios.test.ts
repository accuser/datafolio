/**
 * Network-free unit test for fetchUserPortfolios. Stubs global fetch with a
 * canned GitHub App installations/repositories view and asserts the filtering
 * (portfolio repo name only), role derivation (own = learner, else coach),
 * de-duping and ordering. Run: `tsx lib/github/portfolios.test.ts`.
 */
import { fetchUserPortfolios } from "./portfolios";

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
  // --- own repo → learner; collaborator repos → coach; sorted learner-first ---
  {
    const stub = stubFetch([1, 2, 3], {
      1: [{ name: REPO, owner: "alice" }], // own
      2: [{ name: REPO, owner: "bob" }], // coached
      3: [{ name: REPO, owner: "carol" }], // coached
    });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "alice", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 3, "three portfolios found");
    assert(result[0].owner === "alice" && result[0].role === "learner", "own repo is learner, first");
    assert(result[1].owner === "bob" && result[1].role === "coach", "bob coached, alphabetical");
    assert(result[2].owner === "carol" && result[2].role === "coach", "carol coached, after bob");
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

  // --- a coach who owns no portfolio: all coached, no learner entry ---
  {
    const stub = stubFetch([1, 2], {
      1: [{ name: REPO, owner: "bob" }],
      2: [{ name: REPO, owner: "carol" }],
    });
    const result = await withFetch(
      () => fetchUserPortfolios("tok", "coachonly", REPO),
      stub as unknown as typeof fetch,
    );
    assert(result.length === 2, "coach-only sees both coached repos");
    assert(
      result.every((p) => p.role === "coach"),
      "coach-only has no learner entry",
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

  console.log("portfolios.test.ts: all assertions passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
