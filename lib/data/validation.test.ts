/**
 * Network-free unit test for validateEvidencePatch. Exercises the role-specific
 * write rules (learner vs coach) that the write API relies on, without touching
 * GitHub. Run: `tsx --conditions=react-server lib/data/validation.test.ts`.
 */
import { validateEvidencePatch } from "./validation";
import { getStandard } from "../standards";

const STD = getStandard("st0585");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
}

const patch = (p: Record<string, unknown>) => ({ patch: p });

// --- coach (non-owner) review: status + feedback both accepted ---
{
  const v = validateEvidencePatch(patch({ status: "Approved", feedback: "Great work." }), { isOwner: false, standard: STD });
  assert(v.ok, "coach approve is valid");
  assert(v.patch.status === "Approved", "coach status Approved kept");
  assert(v.patch.feedback === "Great work.", "coach feedback kept");
}
{
  const v = validateEvidencePatch(patch({ status: "Changes", feedback: "Please revise." }), { isOwner: false, standard: STD });
  assert(v.ok && v.patch.status === "Changes" && v.patch.feedback === "Please revise.", "coach request-changes valid");
}

// --- feedback is a coach-only field: a learner (owner) may not write it ---
{
  const v = validateEvidencePatch(patch({ feedback: "self praise" }), { isOwner: true, standard: STD });
  assert(!v.ok, "learner feedback rejected");
  assert(v.status === 403, "learner feedback is 403");
}
{
  // Feedback rejection wins even when smuggled alongside a legitimate edit.
  const v = validateEvidencePatch(patch({ title: "New title", feedback: "y" }), { isOwner: true, standard: STD });
  assert(!v.ok && v.status === 403, "learner title+feedback rejected as 403");
}

// --- owner content edit forces a downgrade when no status is supplied ---
for (const field of [
  { title: "Edited title" },
  { url: "github.com/x/y" },
  { note: "Reworked reflection." },
  { ksbIds: ["S4"] },
]) {
  const v = validateEvidencePatch(patch(field), { isOwner: true, standard: STD });
  assert(v.ok, `owner edit of ${Object.keys(field)[0]} valid`);
  assert(v.patch.status === "Draft", `owner edit of ${Object.keys(field)[0]} forced to Draft`);
}

// --- knowledge-test-only KSBs are not evidence targets ---
// K4 (and its sub-points) are assessed by the knowledge test alone, which does
// not collect portfolio evidence, so a mapping to them must be rejected rather
// than committed to a folder the learner can never satisfy.
{
  const v = validateEvidencePatch(patch({ ksbIds: ["K4"] }), { isOwner: true, standard: STD });
  assert(!v.ok, "K4 rejected — knowledge test collects no evidence");
}
{
  const v = validateEvidencePatch(patch({ ksbIds: ["K4.1"] }), { isOwner: true, standard: STD });
  assert(!v.ok, "K4.1 rejected — sub-point is knowledge-test only");
}
// K3.3 is professional discussion even though its siblings are knowledge test,
// so sub-points must be checked against their own methods, not the parent's.
{
  const v = validateEvidencePatch(patch({ ksbIds: ["K3.3"] }), { isOwner: true, standard: STD });
  assert(v.ok, "K3.3 accepted — assessed by professional discussion");
}
{
  const v = validateEvidencePatch(patch({ ksbIds: ["K3.1"] }), { isOwner: true, standard: STD });
  assert(!v.ok, "K3.1 rejected — knowledge-test sibling of an accepted sub-point");
}

// --- an explicit valid downgrade from the UI is preserved ---
{
  const v = validateEvidencePatch(patch({ title: "Edited", status: "Submitted" }), { isOwner: true, standard: STD });
  assert(v.ok && v.patch.status === "Submitted", "explicit Submitted preserved on owner edit");
}
{
  const v = validateEvidencePatch(patch({ title: "Edited", status: "Draft" }), { isOwner: true, standard: STD });
  assert(v.ok && v.patch.status === "Draft", "explicit Draft preserved on owner edit");
}

// --- an owner's explicit self-approval is left intact for the route to reject ---
{
  const v = validateEvidencePatch(patch({ title: "Edited", status: "Approved" }), { isOwner: true, standard: STD });
  assert(v.ok, "owner edit+Approved passes validation (route rejects self-approval)");
  assert(v.patch.status === "Approved", "explicit Approved not silently downgraded");
}

// --- status-only patches (resubmit) are not treated as content edits ---
{
  const v = validateEvidencePatch(patch({ status: "Submitted" }), { isOwner: true, standard: STD });
  assert(v.ok && v.patch.status === "Submitted", "owner resubmit (status only) unchanged");
}

// --- the downgrade force applies only to the owner, not a coach ---
{
  const v = validateEvidencePatch(patch({ title: "Coach fix" }), { isOwner: false, standard: STD });
  assert(v.ok && v.patch.status === undefined, "coach content edit not force-downgraded");
}

// --- unchanged baseline behaviour still holds ---
{
  const v = validateEvidencePatch(patch({}), { isOwner: false, standard: STD });
  assert(!v.ok && v.error === "Nothing to update", "empty patch rejected");
}
{
  const v = validateEvidencePatch(patch({ status: "Bogus" }), { isOwner: false, standard: STD });
  assert(!v.ok && v.error === "Invalid status", "invalid status rejected");
}
{
  const v = validateEvidencePatch(patch({ ksbIds: ["not-a-ksb"] }), { isOwner: true, standard: STD });
  assert(!v.ok, "unknown ksb id rejected");
}

console.log("VALIDATION OK — learner/coach write rules enforced");
