/**
 * The store→HTTP error mapping. These are the cases the old string-matching
 * mapper got wrong: a missing card answered as missing evidence, and GitHub's
 * capital-N "Not Found" falling through to a generic 502.
 * Run: `npx tsx --conditions=react-server lib/data/error-response.test.ts`.
 */
import { storeErrorResponse } from "./error-response";
import { NotFoundError } from "./errors";
import { CONFLICT_MESSAGE } from "../github/commit";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

async function bodyOf(res: Response): Promise<{ error?: string }> {
  return (await res.json()) as { error?: string };
}

async function main() {
  // --- a missing evidence item names evidence, at 404 ---
  {
    const res = storeErrorResponse("t", new NotFoundError("evidence"));
    assert(res.status === 404, `evidence not-found is 404, got ${res.status}`);
    assert(/evidence item/.test((await bodyOf(res)).error ?? ""), "names the evidence item");
  }

  // --- REGRESSION (#55): a missing card names a card, not evidence ---
  {
    const res = storeErrorResponse("t", new NotFoundError("card", "Card c-1 not found"));
    assert(res.status === 404, `card not-found is 404, got ${res.status}`);
    const msg = (await bodyOf(res)).error ?? "";
    assert(/revision card/.test(msg), `names the card, got "${msg}"`);
    assert(!/evidence/.test(msg), "does not mislabel a missing card as evidence");
  }

  // --- REGRESSION (#55): GitHub's capital-N repo 404 is handled, not a 502 ---
  {
    const ghError = Object.assign(new Error("Not Found"), { status: 404 });
    const res = storeErrorResponse("t", ghError);
    assert(res.status === 404, `a repo 404 maps to 404, got ${res.status}`);
    assert(/repository/.test((await bodyOf(res)).error ?? ""), "names the repository");
  }

  // --- a write conflict is a 409 carrying the retry message ---
  {
    const res = storeErrorResponse("t", new Error(CONFLICT_MESSAGE));
    assert(res.status === 409, `conflict is 409, got ${res.status}`);
    assert((await bodyOf(res)).error === CONFLICT_MESSAGE, "relays the conflict message");
  }

  // --- anything else is an opaque 502 that never leaks GitHub's text ---
  {
    const res = storeErrorResponse("t", new Error("secret internal detail: token xyz"));
    assert(res.status === 502, `unknown errors are 502, got ${res.status}`);
    const msg = (await bodyOf(res)).error ?? "";
    assert(!/secret internal detail/.test(msg), "raw error text is not relayed to the client");
  }

  console.log("ERROR-RESPONSE OK — typed errors map to the right status and noun");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
