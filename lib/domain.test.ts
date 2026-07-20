// Tests for the KSB/sub-point roll-up rules in lib/domain.ts.
//
// The distinction these pin down: a KSB is evidenced by anything whose tag roots
// to it (K3 counts K3.1), but a sub-point is evidenced only by items naming it
// exactly. Getting that wrong would mark every sub-point of a KSB covered as
// soon as one sibling was.

import assert from "node:assert/strict";
import { evFor, evForPoint, ksbStatusKey, pointStatusKey, rootOf } from "./domain";
import type { Evidence } from "./types";

const ev = (id: string, ksbIds: string[], status: Evidence["status"]): Evidence => ({
  id,
  ksbIds,
  type: "github",
  title: id,
  status,
  date: "1 Jan 2026",
  feedback: "",
});

const evidence: Evidence[] = [
  ev("a", ["K3.3"], "Approved"),
  ev("b", ["K3.1"], "Draft"),
  ev("c", ["S6", "K5.3"], "Submitted"),
];

// --- rootOf -----------------------------------------------------------------
assert.equal(rootOf("K3.3"), "K3");
assert.equal(rootOf("K3"), "K3");
assert.equal(rootOf("S6"), "S6");

// --- evFor: sub-point tags roll up to the parent -----------------------------
assert.deepEqual(evFor(evidence, "K3").map((e) => e.id), ["a", "b"]);
assert.deepEqual(evFor(evidence, "K5").map((e) => e.id), ["c"]);
assert.deepEqual(evFor(evidence, "K4").map((e) => e.id), []);

// --- evForPoint: exact match only --------------------------------------------
assert.deepEqual(evForPoint(evidence, "K3.3").map((e) => e.id), ["a"]);
assert.deepEqual(
  evForPoint(evidence, "K3.2").map((e) => e.id),
  [],
  "a sibling's evidence must not cover K3.2",
);
// The parent code is not a sub-point, so it matches nothing here.
assert.deepEqual(evForPoint(evidence, "K3").map((e) => e.id), []);

// --- status roll-up ----------------------------------------------------------
// K3 has an Approved item (a) and a Draft (b); Approved wins at KSB level.
assert.equal(ksbStatusKey(evidence, "K3"), "approved");
assert.equal(ksbStatusKey(evidence, "K4"), "notstarted");

// But per sub-point the statuses are independent.
assert.equal(pointStatusKey(evidence, "K3.3"), "approved");
assert.equal(
  pointStatusKey(evidence, "K3.1"),
  "inprogress",
  "a Draft item leaves its sub-point in progress",
);
assert.equal(
  pointStatusKey(evidence, "K3.2"),
  "notstarted",
  "an unevidenced sub-point stays not-started even when its siblings are done",
);
assert.equal(pointStatusKey(evidence, "K5.3"), "submitted");

console.log("domain.test.ts: ok");
