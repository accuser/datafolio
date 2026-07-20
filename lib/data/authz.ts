// The write-authorization rules the route handlers enforce, as pure functions.
//
// These are the security-critical boundaries: who may review, delete, or touch
// revision cards. They lived inline in the handlers as one-off `if` statements,
// where nothing exercised them — so they're pulled out here, called from the
// routes, and covered exhaustively in authz.test.ts. Extracting them is what
// makes them testable without standing up the whole Next request pipeline.
//
// `isOwner` means the signed-in user owns the target repo, i.e. is the learner
// rather than a reviewer (a collaborator with push access). It's resolved once
// per request on RepoContext; every rule below is a function of it.
//
// Not covered here: the `canWrite` gate (a GitHub push-access check — a network
// call, tested against the live API, not a pure rule) and the learner-can't-set-
// feedback rule (which lives in validateEvidencePatch, already tested).

export type Decision =
  | { allow: true }
  | { allow: false; status: number; error: string };

const ALLOW: Decision = { allow: true };

/**
 * A review verdict — Approve or Request changes — is a reviewer action. The repo
 * owner is the learner, so an owner submitting one is reviewing their own
 * evidence, which the client role toggle must not be able to do.
 */
export function canSubmitVerdict(
  isOwner: boolean,
  status: string | undefined,
): Decision {
  if (isOwner && (status === "Approved" || status === "Changes")) {
    return {
      allow: false,
      status: 403,
      error:
        "You can’t review your own evidence — only a reviewer can approve or request changes.",
    };
  }
  return ALLOW;
}

/**
 * Deleting evidence is the learner's own action. A reviewer has push access and
 * so the App token would happily commit the delete for them — but reviewing
 * evidence is not the same as removing it.
 */
export function canDeleteEvidence(isOwner: boolean): Decision {
  if (!isOwner) {
    return {
      allow: false,
      status: 403,
      error: "Only the learner who owns this portfolio can delete evidence.",
    };
  }
  return ALLOW;
}

/**
 * Revision cards are the learner's own preparation. A reviewer can read the
 * repo but has no business editing someone's revision deck, even though their
 * push access would technically allow the commit.
 */
export function canWriteCards(isOwner: boolean): Decision {
  if (!isOwner) {
    return {
      allow: false,
      status: 403,
      error: "Revision cards belong to the learner — only they can change them.",
    };
  }
  return ALLOW;
}
