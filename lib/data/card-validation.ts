// Server-side validation for revision cards.
//
// Cards have no review workflow, so this is much smaller than the evidence
// rules: there is no status to police and no reviewer field a learner mustn't
// write. What remains is that a card must revise something real in this
// standard, and that a hand-crafted request can't write unbounded text into the
// learner's repo.

import { cardable, ksbIndex, type Standard } from "../standards";
import { rootOf, todayLabel } from "../domain";
import type { Card } from "../types";

const FRONT_MAX = 2000;
const BACK_MAX = 10000;
const TAG_MAX = 60;
const MAX_TAGS = 12;
/** One generated starter set is ~5 cards; this is a bulk-write ceiling. */
const MAX_CARDS_PER_REQUEST = 100;

export type ValidatedCards =
  | { ok: true; cards: Card[] }
  | { ok: false; error: string; status?: number };

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * Every target must exist in the standard AND be cardable. The second check is
 * the one that matters: without it a request could file cards against a
 * report-only KSB, which the UI never offers and which no export would place in
 * a sensible deck.
 */
function targetsValid(standard: Standard, ids: string[]): boolean {
  if (!ids.length) return false;
  const byId = ksbIndex(standard);
  return ids.every((id) => {
    const ksb = byId[rootOf(id)];
    if (!ksb) return false;
    // A sub-point target must actually be one of that KSB's sub-points.
    if (id.includes(".") && !(ksb.points ?? []).some((p) => p.id === id)) return false;
    return cardable(standard, ksb);
  });
}

function validateOne(raw: unknown, standard: Standard): Card | string {
  if (typeof raw !== "object" || raw === null) return "Each card must be an object";
  const r = raw as Record<string, unknown>;

  const front = str(r.front).trim();
  if (!front) return "A card needs a front";
  if (front.length > FRONT_MAX) return "Card front is too long";
  const back = str(r.back);
  if (back.length > BACK_MAX) return "Card back is too long";

  const ksbIds = Array.isArray(r.ksbIds) ? r.ksbIds.map(str) : [];
  if (!targetsValid(standard, ksbIds)) {
    return "Map the card to at least one KSB or sub-point that supports revision cards";
  }

  const tags = (Array.isArray(r.tags) ? r.tags.map(str) : [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS)
    .map((t) => t.slice(0, TAG_MAX));

  const today = todayLabel();
  const id = str(r.id).trim();
  return {
    // Client-supplied ids are kept, unlike evidence: seeded ids are derived from
    // the KSB a card revises, and that derivation is exactly what makes
    // re-seeding idempotent. The store de-dupes, so a collision is a no-op
    // rather than an overwrite.
    id: id || `c${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ksbIds,
    front,
    back,
    source: str(r.source) === "seed" ? "seed" : "learner",
    created: str(r.created) || today,
    updated: today,
    ...(tags.length ? { tags } : {}),
  };
}

/** Validate a POST body: `{ cards: Card[] }`. */
export function validateNewCards(body: unknown, standard: Standard): ValidatedCards {
  const raw =
    typeof body === "object" && body !== null && Array.isArray((body as { cards?: unknown }).cards)
      ? ((body as { cards: unknown[] }).cards as unknown[])
      : null;
  if (!raw) return { ok: false, error: "Expected a `cards` array" };
  if (!raw.length) return { ok: false, error: "No cards to add" };
  if (raw.length > MAX_CARDS_PER_REQUEST) {
    return { ok: false, error: "Too many cards in one request" };
  }
  const cards: Card[] = [];
  for (const item of raw) {
    const result = validateOne(item, standard);
    if (typeof result === "string") return { ok: false, error: result };
    cards.push(result);
  }
  return { ok: true, cards };
}

export type ValidatedCardPatch =
  | { ok: true; patch: Partial<Card> }
  | { ok: false; error: string; status?: number };

/**
 * Validate a PATCH body. Only the fields a learner can actually edit are
 * accepted — id, source and created are not patchable, so an edit can't
 * re-label a hand-written card as a generated starter (which would let a bulk
 * "clear starters" silently delete the learner's own work).
 */
export function validateCardPatch(body: unknown, standard: Standard): ValidatedCardPatch {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Expected a JSON body" };
  }
  const r = (body as { patch?: unknown }).patch;
  if (typeof r !== "object" || r === null) {
    return { ok: false, error: "Expected a `patch` object" };
  }
  const p = r as Record<string, unknown>;
  const patch: Partial<Card> = {};

  if ("front" in p) {
    const front = str(p.front).trim();
    if (!front) return { ok: false, error: "A card needs a front" };
    if (front.length > FRONT_MAX) return { ok: false, error: "Card front is too long" };
    patch.front = front;
  }
  if ("back" in p) {
    const back = str(p.back);
    if (back.length > BACK_MAX) return { ok: false, error: "Card back is too long" };
    patch.back = back;
  }
  if ("ksbIds" in p) {
    const ksbIds = Array.isArray(p.ksbIds) ? p.ksbIds.map(str) : [];
    if (!targetsValid(standard, ksbIds)) {
      return { ok: false, error: "Map the card to at least one KSB that supports revision cards" };
    }
    patch.ksbIds = ksbIds;
  }
  if (!Object.keys(patch).length) {
    return { ok: false, error: "Nothing to update" };
  }
  patch.updated = todayLabel();
  return { ok: true, patch };
}
