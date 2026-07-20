// Tests for starter-card generation and the mock card store.

import assert from "node:assert/strict";
import {
  cardsFor,
  generateAllStarterCards,
  generateStarterCards,
  genreOf,
  seedCardId,
} from "./cards";
import { createMockCardStore } from "./data/card-store";
import { getStandard, ksbIndex } from "./standards";
import type { Card } from "./types";

const std = getStandard("st0585");
const byId = ksbIndex(std);
const TODAY = "20 Jul 2026";

// --- genre: derived from the flags, not from method names -------------------

assert.equal(genreOf(std, ["knowledge_test"]), "recall");
assert.equal(genreOf(std, ["professional_discussion"]), "rehearsal");
assert.equal(
  genreOf(std, ["professional_discussion", "knowledge_test"]),
  "recall",
  "a mixed target is drilled as recall — the examined half is the one you can fail",
);

// --- generation -------------------------------------------------------------

// K4 is knowledge-test only and its statement is a stem ("...using:"), so the
// sub-points carry it and there is no KSB-level card.
const k4 = generateStarterCards(std, byId.K4, TODAY);
assert.deepEqual(
  k4.map((c) => c.ksbIds[0]),
  ["K4.1", "K4.2", "K4.3", "K4.4", "K4.5"],
  "a stem statement yields no KSB-level card",
);
assert.ok(
  k4.every((c) => c.front.startsWith("Explain: ")),
  "knowledge-test cards are phrased as recall",
);
assert.ok(
  k4.every((c) => c.back === "" && c.source === "seed"),
  "the back is the learner's to write",
);
assert.deepEqual(k4[0].tags, ["ST0585", "K4"], "cards stay traceable to the KSB");

// B1 has no sub-points and a self-contained statement, so it is the mirror case:
// one KSB-level card, phrased for rehearsal rather than recall.
const b1 = generateStarterCards(std, byId.B1, TODAY);
assert.equal(b1.length, 1);
assert.equal(b1[0].ksbIds[0], "B1");
assert.ok(
  b1[0].front.startsWith("Be ready to discuss: "),
  "professional-discussion cards rehearse talking, not recalling",
);

// The prefix lands on the published wording with one full stop, not two.
assert.ok(!b1[0].front.includes(".."), b1[0].front);
assert.ok(b1[0].front.endsWith("."), b1[0].front);

// Report-only KSBs are not cardable at all.
assert.deepEqual(generateStarterCards(std, byId.S1, TODAY), []);

// K3 is mixed: PD at KSB level, two examined sub-points and one discussed one.
// Every sub-point is cardable, and the per-sub-point phrasing follows that
// sub-point's own method rather than the parent's.
const k3 = generateStarterCards(std, byId.K3, TODAY);
assert.deepEqual(k3.map((c) => c.ksbIds[0]), ["K3.1", "K3.2", "K3.3"]);
assert.ok(k3[0].front.startsWith("Explain: "), "K3.1 is examined");
assert.ok(
  k3[2].front.startsWith("Be ready to discuss: "),
  "K3.3 is professional discussion, so it rehearses even though K3.1 recalls",
);

// --- whole standard ---------------------------------------------------------

const all = generateAllStarterCards(std, TODAY);
assert.equal(
  all.length,
  20,
  "9 self-contained cardable KSBs + 11 sub-points under the three stems",
);
assert.equal(
  new Set(all.map((c) => c.id)).size,
  all.length,
  "seeded ids are unique across the standard",
);
assert.ok(
  all.every((c) => !c.ksbIds[0].startsWith("S1")),
  "nothing is seeded against a report-only KSB",
);

// Generation is deterministic: same inputs, same ids. This is what makes a
// second "Generate starter cards" a no-op rather than a duplicate deck.
assert.deepEqual(generateAllStarterCards(std, TODAY), all);
assert.equal(seedCardId("K4.2"), "c-K4.2");

// --- cardsFor: sub-point cards roll up to their parent -----------------------

const mixed: Card[] = [
  ...generateStarterCards(std, byId.K4, TODAY),
  ...generateStarterCards(std, byId.B1, TODAY),
];
assert.equal(cardsFor(mixed, "K4").length, 5, "K4.x cards belong to K4");
assert.equal(cardsFor(mixed, "B1").length, 1);
assert.equal(cardsFor(mixed, "K5").length, 0);

// --- mock store -------------------------------------------------------------

async function main() {
  const store = createMockCardStore();
  assert.deepEqual(await store.load(), []);

  await store.addCards(k4);
  assert.equal((await store.load()).length, 5);

  // Seeding the same KSB twice must not double the deck — the id collision is
  // caught by the store, not left to the caller to check.
  const afterReseed = await store.addCards(
    generateStarterCards(std, byId.K4, TODAY),
  );
  assert.equal(afterReseed.length, 5, "re-seeding is idempotent");

  // A learner card with a fresh id still lands alongside the seeded ones.
  const own: Card = {
    id: "c-own-1",
    ksbIds: ["K4.2"],
    front: "Name three supervised algorithms and when you'd pick each.",
    back: "...",
    source: "learner",
    created: TODAY,
    updated: TODAY,
  };
  assert.equal((await store.addCards([own])).length, 6);

  const edited = await store.updateCard("c-own-1", { back: "rewritten" });
  assert.equal(edited.find((c) => c.id === "c-own-1")!.back, "rewritten");
  assert.equal(
    edited.find((c) => c.id === "c-K4.1")!.back,
    "",
    "patching one card leaves its siblings alone",
  );

  assert.equal((await store.deleteCard("c-own-1")).length, 5);

  console.log("cards.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
