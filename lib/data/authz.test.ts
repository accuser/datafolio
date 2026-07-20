/**
 * The write-authorization rules the route handlers enforce. These are the
 * security-critical boundaries the security review called out favourably —
 * self-review, reviewer-can't-delete, owner-only cards — and nothing exercised
 * them until now. The routes call exactly these functions, so this is the real
 * decision code, not a parallel copy.
 * Run: `npx tsx --conditions=react-server lib/data/authz.test.ts`.
 */
import {
  canDeleteEvidence,
  canSubmitVerdict,
  canWriteCards,
} from "./authz";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const OWNER = true;
const REVIEWER = false;

// --- self-review: an owner can't submit a verdict on their own evidence ------
{
  for (const status of ["Approved", "Changes"]) {
    const d = canSubmitVerdict(OWNER, status);
    assert(!d.allow, `an owner is refused a ${status} verdict`);
    assert(!d.allow && d.status === 403, `self-review is a 403 (${status})`);
    assert(
      !d.allow && /review your own evidence/.test(d.error),
      "the self-review error explains itself",
    );
  }

  // A reviewer submitting a verdict is the normal case.
  for (const status of ["Approved", "Changes"]) {
    assert(canSubmitVerdict(REVIEWER, status).allow, `a reviewer may submit ${status}`);
  }

  // A learner editing/resubmitting their own item is not a verdict — the status
  // is Draft/Submitted/undefined — so it must be allowed for an owner.
  for (const status of ["Draft", "Submitted", undefined]) {
    assert(
      canSubmitVerdict(OWNER, status).allow,
      `an owner may set a non-verdict status (${status})`,
    );
    assert(
      canSubmitVerdict(REVIEWER, status).allow,
      `a reviewer may set a non-verdict status (${status})`,
    );
  }
}

// --- delete: only the learner who owns the portfolio may delete evidence -----
{
  assert(canDeleteEvidence(OWNER).allow, "an owner may delete their own evidence");

  const d = canDeleteEvidence(REVIEWER);
  assert(!d.allow, "a reviewer may not delete evidence");
  assert(!d.allow && d.status === 403, "a reviewer delete is a 403");
  assert(
    !d.allow && /Only the learner/.test(d.error),
    "the delete error names the boundary",
  );
}

// --- cards: writes are owner-only --------------------------------------------
{
  assert(canWriteCards(OWNER).allow, "an owner may write their own revision cards");

  const d = canWriteCards(REVIEWER);
  assert(!d.allow, "a reviewer may not write revision cards");
  assert(!d.allow && d.status === 403, "a reviewer card write is a 403");
  assert(
    !d.allow && /belong to the learner/.test(d.error),
    "the card error names the boundary",
  );
}

console.log("AUTHZ OK — self-review, reviewer-delete and owner-only-card rules enforced");
