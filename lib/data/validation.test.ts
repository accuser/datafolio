/**
 * Network-free unit test for validateEvidencePatch. Exercises the role-specific
 * write rules (learner vs coach) that the write API relies on, without touching
 * GitHub. Run: `tsx --conditions=react-server lib/data/validation.test.ts`.
 */
import { validateEvidencePatch } from "./validation";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const patch = (p: Record<string, unknown>) => ({ patch: p });

// --- coach (non-owner) review: status + feedback both accepted ---
{
  const v = validateEvidencePatch(patch({ status: "Approved", feedback: "Great work." }), { isOwner: false });
  assert(v.ok, "coach approve is valid");
  assert(v.patch.status === "Approved", "coach status Approved kept");
  assert(v.patch.feedback === "Great work.", "coach feedback kept");
}
{
  const v = validateEvidencePatch(patch({ status: "Changes", feedback: "Please revise." }), { isOwner: false });
  assert(v.ok && v.patch.status === "Changes" && v.patch.feedback === "Please revise.", "coach request-changes valid");
}

// --- feedback is a coach-only field: a learner (owner) may not write it ---
{
  const v = validateEvidencePatch(patch({ feedback: "self praise" }), { isOwner: true });
  assert(!v.ok, "learner feedback rejected");
  assert(v.status === 403, "learner feedback is 403");
}
{
  // Feedback rejection wins even when smuggled alongside a legitimate edit.
  const v = validateEvidencePatch(patch({ title: "New title", feedback: "y" }), { isOwner: true });
  assert(!v.ok && v.status === 403, "learner title+feedback rejected as 403");
}

// --- owner content edit forces a downgrade when no status is supplied ---
for (const field of [
  { title: "Edited title" },
  { url: "github.com/x/y" },
  { note: "Reworked reflection." },
  { ksbIds: ["K4"] },
]) {
  const v = validateEvidencePatch(patch(field), { isOwner: true });
  assert(v.ok, `owner edit of ${Object.keys(field)[0]} valid`);
  assert(v.patch.status === "Draft", `owner edit of ${Object.keys(field)[0]} forced to Draft`);
}

// --- an explicit valid downgrade from the UI is preserved ---
{
  const v = validateEvidencePatch(patch({ title: "Edited", status: "Submitted" }), { isOwner: true });
  assert(v.ok && v.patch.status === "Submitted", "explicit Submitted preserved on owner edit");
}
{
  const v = validateEvidencePatch(patch({ title: "Edited", status: "Draft" }), { isOwner: true });
  assert(v.ok && v.patch.status === "Draft", "explicit Draft preserved on owner edit");
}

// --- an owner's explicit self-approval is left intact for the route to reject ---
{
  const v = validateEvidencePatch(patch({ title: "Edited", status: "Approved" }), { isOwner: true });
  assert(v.ok, "owner edit+Approved passes validation (route rejects self-approval)");
  assert(v.patch.status === "Approved", "explicit Approved not silently downgraded");
}

// --- status-only patches (resubmit) are not treated as content edits ---
{
  const v = validateEvidencePatch(patch({ status: "Submitted" }), { isOwner: true });
  assert(v.ok && v.patch.status === "Submitted", "owner resubmit (status only) unchanged");
}

// --- the downgrade force applies only to the owner, not a coach ---
{
  const v = validateEvidencePatch(patch({ title: "Coach fix" }), { isOwner: false });
  assert(v.ok && v.patch.status === undefined, "coach content edit not force-downgraded");
}

// --- unchanged baseline behaviour still holds ---
{
  const v = validateEvidencePatch(patch({}), { isOwner: false });
  assert(!v.ok && v.error === "Nothing to update", "empty patch rejected");
}
{
  const v = validateEvidencePatch(patch({ status: "Bogus" }), { isOwner: false });
  assert(!v.ok && v.error === "Invalid status", "invalid status rejected");
}
{
  const v = validateEvidencePatch(patch({ ksbIds: ["not-a-ksb"] }), { isOwner: true });
  assert(!v.ok, "unknown ksb id rejected");
}

console.log("VALIDATION OK — learner/coach write rules enforced");
