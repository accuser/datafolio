/**
 * The write-authorization rules the route handlers enforce. These are the
 * security-critical boundaries the security review called out favourably —
 * self-review, reviewer-can't-delete, owner-only cards — and nothing exercised
 * them until now. The routes call exactly these functions, so this is the real
 * decision code, not a parallel copy.
 * Run: `npx tsx --conditions=react-server lib/data/authz.test.ts`.
 */
import {
  canCreateEvidence,
  canDeleteEvidence,
  canSetStatus,
  canWriteCards,
} from "./authz";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const OWNER = true;
const REVIEWER = false;

// --- status: the handshake is partitioned, one cell per role ------------------
//
// Every cell of the status half of docs/org-access-model.md §1.7. The reviewer
// half of this used to assert the opposite — "a reviewer may set a non-verdict
// status" — which pinned the missing rule in place as expected behaviour, the
// same way validation.test.ts pinned the missing content rule. Replaced rather
// than extended: the premise was wrong, not incomplete.
{
  // An owner may not review their own evidence.
  for (const status of ["Approved", "Changes"]) {
    const d = canSetStatus(OWNER, status);
    assert(!d.allow, `an owner is refused a ${status} verdict`);
    assert(!d.allow && d.status === 403, `self-review is a 403 (${status})`);
    assert(
      !d.allow && /review your own evidence/.test(d.error),
      "the self-review error explains itself",
    );
  }

  // A reviewer submitting a verdict is the normal case.
  for (const status of ["Approved", "Changes"]) {
    assert(canSetStatus(REVIEWER, status).allow, `a reviewer may submit ${status}`);
  }

  // A learner drafting or submitting their own item is the normal case.
  for (const status of ["Draft", "Submitted"]) {
    assert(canSetStatus(OWNER, status).allow, `an owner may set ${status}`);
  }

  // The half that was missing. `Submitted` puts a learner's unfinished draft
  // into review under their name; `Draft` silently revokes an approval. Both are
  // a reviewer writing learner-owned state.
  for (const status of ["Draft", "Submitted"]) {
    const d = canSetStatus(REVIEWER, status);
    assert(!d.allow, `a reviewer may not set ${status}`);
    assert(!d.allow && d.status === 403, `a reviewer status move is a 403 (${status})`);
    assert(
      !d.allow && /Only the learner/.test(d.error),
      `the status error names the boundary (${status})`,
    );
  }

  // A patch that doesn't move the item has no status to authorise — a reviewer
  // amending feedback alone, say. Allowed for both roles.
  assert(canSetStatus(OWNER, undefined).allow, "an owner may patch without a status");
  assert(canSetStatus(REVIEWER, undefined).allow, "a reviewer may patch without a status");
}

// --- create: only the learner who owns the portfolio may add evidence --------
//
// The gap in the set: delete and cards had rules, create had only the push-access
// check, which a reviewer passes by definition.
{
  assert(canCreateEvidence(OWNER).allow, "an owner may add their own evidence");

  const create = canCreateEvidence(REVIEWER);
  assert(!create.allow, "a reviewer may not add evidence");
  assert(!create.allow && create.status === 403, "a reviewer create is a 403");
  assert(
    !create.allow && /Only the learner/.test(create.error),
    "the create error names the boundary",
  );
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

console.log(
  "AUTHZ OK — status partition, reviewer-create, reviewer-delete and owner-only-card rules enforced",
);
