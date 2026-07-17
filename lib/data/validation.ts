import "server-only";
import { randomUUID } from "node:crypto";
import { KSBS } from "../ksbs";
import { todayLabel } from "../domain";
import type { Evidence, EvidenceStatus, EvidenceType } from "../types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, base64Bytes, sanitizeFileName } from "./uploads";

// Server-side validation for POST /api/evidence. The client is untrusted: it
// supplies `title`/`type`/`ksbIds`/`status`/`id`/`fileName` verbatim, so every
// field is checked here before anything is committed to the learner's repo.

/** Every id an item may legitimately map to: KSB codes plus sub-point ids. */
const VALID_KSB_IDS: ReadonlySet<string> = new Set(
  KSBS.flatMap((k) => [k.id, ...(k.points ?? []).map((p) => p.id)]),
);

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
export function validateNewEvidence(body: unknown): ValidatedEvidence {
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

  const ksbIds = Array.isArray(r.ksbIds)
    ? r.ksbIds.filter((x): x is string => typeof x === "string" && VALID_KSB_IDS.has(x))
    : [];
  if (!ksbIds.length) {
    return { ok: false, error: "Map the evidence to at least one KSB or sub-point" };
  }

  // Only Draft or Submitted may be created; approval is a coach action.
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
  | { ok: false; error: string };

/**
 * Validate a PATCH body (learner edit / resubmit, or coach review). Only a
 * known, safe subset of fields may be changed; everything else is dropped, and
 * each supplied field is type-/length-checked. id and date are never patchable.
 */
export function validateEvidencePatch(body: unknown): ValidatedPatch {
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
  if ("feedback" in r) patch.feedback = str(r.feedback).slice(0, FEEDBACK_MAX);
  if ("ksbIds" in r) {
    const ksbIds = Array.isArray(r.ksbIds)
      ? r.ksbIds.filter((x): x is string => typeof x === "string" && VALID_KSB_IDS.has(x))
      : [];
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

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update" };
  }
  return { ok: true, patch };
}
