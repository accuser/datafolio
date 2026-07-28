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
// call, tested against the live API, not a pure rule) and the two field-role
// rules on patching, which live in validateEvidencePatch because they are
// functions of *which fields* the patch touches rather than of the action alone.
// The status rule is the exception and stays here: it turns on the *value*
// written, not on which fields are present, and it belongs beside the other
// pure rules so this file remains the one place to check the set is complete.

export type Decision =
  | { allow: true }
  | { allow: false; status: number; error: string };

const ALLOW: Decision = { allow: true };

// Status is the one field both roles write, which is what makes it look shared.
// It isn't: it's partitioned, and the handshake runs in one direction. The
// learner moves an item Draft → Submitted; the reviewer answers Approved or
// Changes. Neither may play the other's half.
const VERDICT_STATUSES = ["Approved", "Changes"];
const LEARNER_STATUSES = ["Draft", "Submitted"];

/**
 * Who may move an item to a given status.
 *
 * This began as `canSubmitVerdict`, which held only the owner half — an owner
 * may not approve their own evidence. The reviewer half was missing, and the
 * shared-field framing is what hid it: because both roles legitimately write
 * `status`, it read as nobody's exclusive field rather than as two exclusive
 * halves. So nothing stopped a reviewer PATCHing `{status:"Draft"}` to quietly
 * revoke an approval, or `{status:"Submitted"}` to put a learner's unfinished
 * draft into review under their name. docs/org-access-model.md §1.7 already
 * splits the handshake into two rows with opposite ownership; this is that
 * table.
 *
 * Stated as one function over both halves so an absent half is obvious — the
 * same reason the content and feedback rules sit together in validation.ts.
 *
 * An absent status is allowed: a patch that doesn't move the item (a reviewer
 * leaving feedback alone) has no status to authorise.
 */
export function canSetStatus(
  isOwner: boolean,
  status: string | undefined,
): Decision {
  if (status === undefined) return ALLOW;

  if (isOwner && VERDICT_STATUSES.includes(status)) {
    return {
      allow: false,
      status: 403,
      error:
        "You can’t review your own evidence — only a reviewer can approve or request changes.",
    };
  }
  if (!isOwner && LEARNER_STATUSES.includes(status)) {
    return {
      allow: false,
      status: 403,
      error:
        "Only the learner who owns this portfolio can submit or withdraw their evidence.",
    };
  }
  return ALLOW;
}

/**
 * Adding evidence is the learner's own action, for the same reason deleting it
 * is: a reviewer reviews the portfolio, they don't contribute to it.
 *
 * This was the gap in the set. Delete had a rule, cards had a rule, and create
 * had nothing but the `canWrite` push-access check — which a reviewer passes by
 * definition, since push access is exactly what makes them a reviewer. So a
 * reviewer could POST evidence into a learner's portfolio and the App token
 * would commit it under the learner's name.
 */
export function canCreateEvidence(isOwner: boolean): Decision {
  if (!isOwner) {
    return {
      allow: false,
      status: 403,
      error: "Only the learner who owns this portfolio can add evidence.",
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
