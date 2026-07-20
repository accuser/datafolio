// Typed errors the stores throw, so the route mapper can switch on the error's
// identity rather than pattern-matching its prose.
//
// The message string is for the log; the *type* is the contract. Matching on
// message text meant "Card <id> not found" was answered with "That evidence
// item no longer exists" (wrong noun), while GitHub's own capital-N "Not Found"
// missed the match entirely and a deleted repo fell through to a generic 502.

/** The kind of thing that was missing, so the mapper can name it correctly. */
export type ResourceKind = "evidence" | "card" | "repository";

/** A specific resource was asked for and isn't there (maps to HTTP 404). */
export class NotFoundError extends Error {
  constructor(readonly kind: ResourceKind, message?: string) {
    super(message ?? `${kind} not found`);
    this.name = "NotFoundError";
  }
}
