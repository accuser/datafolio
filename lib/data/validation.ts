import "server-only";
import { randomUUID } from "node:crypto";
import { rootOf, todayLabel } from "../domain";
import { ksbIndex, validKsbIds, type Standard } from "../standards";
import type { Evidence, EvidenceStatus, EvidenceType } from "../types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, base64Bytes, sanitizeFileName } from "./uploads";

// Server-side validation for POST /api/evidence. The client is untrusted: it
// supplies `title`/`type`/`ksbIds`/`status`/`id`/`fileName` verbatim, so every
// field is checked here before anything is committed to the learner's repo.
//
// Which ids are valid depends on the portfolio's standard, so the caller resolves
// it (from the repo's datafolio.yml) and passes it in.

/**
 * Filter a client-supplied id list to those this standard actually assesses by a
 * method that collects evidence.
 *
 * Sub-points are checked against their own methods, not the parent's: K3.1 is
 * knowledge-test only even though K3 is also professional discussion.
 */
function acceptableIds(standard: Standard, raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const valid = validKsbIds(standard);
  const byId = ksbIndex(standard);
  return raw.filter((x): x is string => {
    if (typeof x !== "string" || !valid.has(x)) return false;
    const parent = byId[rootOf(x)];
    if (!parent) return false;
    const point = parent.points?.find((p) => p.id === x);
    const methods = point ? point.methods : parent.methods;
    return methods.some((m) => standard.methods[m]?.collectsEvidence);
  });
}

const TITLE_MAX = 200;
const URL_MAX = 500;
const NOTE_MAX = 20_000;
const FEEDBACK_MAX = 5_000;

const EVIDENCE_STATUSES: readonly EvidenceStatus[] = [
  "Draft",
  "Submitted",
  "Approved",
  "Changes",
];

export type ValidatedEvidence =
  | { ok: true; item: Evidence; fileContentBase64?: string }
  | { ok: false; error: string };

interface RawBody {
  item?: unknown;
  fileContentBase64?: unknown;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Validate and normalise a new-evidence POST body into a trusted Evidence item.
 * The `id`, `date`, `status` (beyond Draft/Submitted) and `feedback` are all
 * assigned server-side, so a learner cannot shadow an existing id or POST a
 * born-Approved item; the upload filename is sanitised and size-capped.
 */
export function validateNewEvidence(
  body: unknown,
  standard: Standard,
): ValidatedEvidence {
  const b = (body ?? {}) as RawBody;
  const raw = b.item;
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Missing evidence item" };
  }
  const r = raw as Record<string, unknown>;

  const title = str(r.title).trim();
  if (!title) return { ok: false, error: "Evidence title is required" };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Title is too long (max ${TITLE_MAX} characters)` };
  }

  const type = r.type as EvidenceType;
  if (type !== "github" && type !== "reflection" && type !== "upload") {
    return { ok: false, error: "Invalid evidence type" };
  }

  const ksbIds = acceptableIds(standard, r.ksbIds);
  if (!ksbIds.length) {
    return { ok: false, error: "Map the evidence to at least one KSB or sub-point" };
  }

  // Only Draft or Submitted may be created; approval is a reviewer action.
  const status = r.status === "Submitted" ? "Submitted" : "Draft";

  const item: Evidence = {
    id: "e" + randomUUID(), // server-assigned — ignore any client id (no shadowing)
    ksbIds,
    type,
    title,
    status,
    date: todayLabel(),
    feedback: "",
  };

  let fileContentBase64: string | undefined;

  if (type === "github") {
    item.url = str(r.url).slice(0, URL_MAX);
  } else if (type === "reflection") {
    item.note = str(r.note).slice(0, NOTE_MAX);
  } else if (type === "upload") {
    const b64 = str(b.fileContentBase64);
    if (!b64) return { ok: false, error: "Upload is missing file contents" };
    if (base64Bytes(b64) > MAX_UPLOAD_BYTES) {
      return { ok: false, error: `File is too large (max ${MAX_UPLOAD_MB} MB)` };
    }
    const fileName = sanitizeFileName(str(r.fileName));
    if (!str(r.fileName).trim()) {
      return { ok: false, error: "Upload is missing a filename" };
    }
    item.fileName = fileName;
    fileContentBase64 = b64;
  }

  return { ok: true, item, fileContentBase64 };
}

export type ValidatedPatch =
  | { ok: true; patch: Partial<Evidence> }
  | { ok: false; error: string; status?: number };

/** Content fields a learner owns; editing any of them invalidates a review. */
const CONTENT_FIELDS = ["title", "url", "note", "ksbIds"] as const;

/**
 * Validate a PATCH body (learner edit / resubmit, or a reviewer's verdict). Only a
 * known, safe subset of fields may be changed; everything else is dropped, and
 * each supplied field is type-/length-checked. id and date are never patchable.
 *
 * `isOwner` (login === repo owner, i.e. the learner) gates the role-specific
 * rules that the UI enforces but a hand-crafted request otherwise wouldn't:
 *   - `feedback` is the reviewer's field, so a learner may not write it (403).
 *   - editing content invalidates any prior review, so an owner edit that omits
 *     a status is forced back to Draft rather than silently keeping Approved.
 * (Rejecting a learner's explicit self-approval stays with the route handler.)
 */
export function validateEvidencePatch(
  body: unknown,
  { isOwner, standard }: { isOwner: boolean; standard: Standard },
): ValidatedPatch {
  const raw = (body as { patch?: unknown } | null)?.patch;
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Missing patch" };
  }
  const r = raw as Record<string, unknown>;
  const patch: Partial<Evidence> = {};

  if ("title" in r) {
    const title = str(r.title).trim();
    if (!title) return { ok: false, error: "Evidence title is required" };
    if (title.length > TITLE_MAX) {
      return { ok: false, error: `Title is too long (max ${TITLE_MAX} characters)` };
    }
    patch.title = title;
  }
  if ("url" in r) patch.url = str(r.url).slice(0, URL_MAX);
  if ("note" in r) patch.note = str(r.note).slice(0, NOTE_MAX);
  if ("feedback" in r) {
    // "Reviewer feedback" is a review field: only a non-owner (reviewer) may set it.
    if (isOwner) {
      return {
        ok: false,
        error: "Only a reviewer can leave feedback on evidence.",
        status: 403,
      };
    }
    patch.feedback = str(r.feedback).slice(0, FEEDBACK_MAX);
  }
  if ("ksbIds" in r) {
    const ksbIds = acceptableIds(standard, r.ksbIds);
    if (!ksbIds.length) {
      return { ok: false, error: "Map the evidence to at least one KSB or sub-point" };
    }
    patch.ksbIds = ksbIds;
  }
  if ("status" in r) {
    if (!EVIDENCE_STATUSES.includes(r.status as EvidenceStatus)) {
      return { ok: false, error: "Invalid status" };
    }
    patch.status = r.status as EvidenceStatus;
  }

  // A learner editing content must not leave the item Approved/Changes. The UI
  // always downgrades on edit; enforce it here for requests that don't. An
  // explicit Approved/Changes is left for the route's self-approval rejection.
  const editsContent = CONTENT_FIELDS.some((f) => f in r);
  if (isOwner && editsContent && patch.status === undefined) {
    patch.status = "Draft";
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update" };
  }
  return { ok: true, patch };
}
