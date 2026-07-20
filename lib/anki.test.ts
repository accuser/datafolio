// Tests for the Anki TSV export.

import assert from "node:assert/strict";
import { ankiFileName, deckNameFor, toAnkiTsv } from "./anki";
import { generateAllStarterCards, generateStarterCards } from "./cards";
import { getStandard, ksbIndex } from "./standards";
import type { Card } from "./types";

const std = getStandard("st0585");
const byId = ksbIndex(std);
const TODAY = "20 Jul 2026";

const card = (over: Partial<Card>): Card => ({
  id: "c1",
  ksbIds: ["K4.2"],
  front: "Front",
  back: "Back",
  source: "learner",
  created: TODAY,
  updated: TODAY,
  ...over,
});

// --- header -----------------------------------------------------------------

const out = toAnkiTsv(std, [card({})]);
const lines = out.split("\n");

// Directives are only honoured at the top of the file, which is exactly why the
// deck is a column rather than a repeated #deck: between sections.
assert.deepEqual(lines.slice(0, 6), [
  "#separator:tab",
  "#html:true",
  "#notetype:Basic",
  "#deck column:3",
  "#tags column:4",
  "#columns:Front\tBack\tDeck\tTags",
]);
assert.ok(out.endsWith("\n"), "a trailing newline keeps the last row importable");

// The declared column indices must match where the fields actually land, or
// every card imports into the wrong deck. 1-based, hence the -1.
const cols = lines[6].split("\t");
assert.equal(cols.length, 4);
assert.equal(cols[3 - 1], deckNameFor(std, card({})), "#deck column:3 is the 3rd field");
assert.ok(cols[4 - 1].includes("K4.2"), "#tags column:4 is the 4th field");

// --- deck routing -----------------------------------------------------------

assert.equal(
  deckNameFor(std, card({ ksbIds: ["K4.2"] })),
  "ST0585::Knowledge::K4 Analytical algorithms",
  "a sub-point card routes to its parent KSB's deck",
);
assert.equal(
  deckNameFor(std, card({ ksbIds: ["B1"] })),
  "ST0585::Behaviour::B1 Inquisitive approach",
);
// A tag that isn't in this standard shouldn't crash the export or silently
// vanish — it lands somewhere obvious instead.
assert.equal(deckNameFor(std, card({ ksbIds: ["Z9"] })), "ST0585::Unsorted");
assert.equal(deckNameFor(std, card({ ksbIds: [] })), "ST0585::Unsorted");

// A label from a future standard must not be able to corrupt the file: a tab
// would shift columns, a "::" would nest a phantom subdeck.
const oddStd = {
  ...std,
  ksbs: std.ksbs.map((k) =>
    k.id === "B1" ? { ...k, short: "Odd\tlabel::nested" } : k,
  ),
};
const oddDeck = deckNameFor(oddStd, card({ ksbIds: ["B1"] }));
assert.equal(oddDeck, "ST0585::Behaviour::B1 Odd label:nested");
assert.equal(
  toAnkiTsv(oddStd, [card({ ksbIds: ["B1"] })]).split("\n")[6].split("\t").length,
  4,
  "a tab in a deck label must not add a column",
);

// --- escaping ---------------------------------------------------------------
// #html:true means unescaped markup is swallowed by the renderer, and a raw tab
// or newline would shift or split the row.

const nasty = toAnkiTsv(std, [
  card({
    front: "Compare <script> & \"quoted\" tags",
    back: "line one\nline two\ttabbed",
  }),
]);
const nastyRow = nasty.split("\n")[6];
assert.ok(nastyRow.includes("&lt;script&gt;"), "angle brackets escaped");
assert.ok(nastyRow.includes("&amp;"), "ampersand escaped");
assert.ok(nastyRow.includes("&quot;"), "quotes escaped so the parser can't read a quoted field");
assert.ok(nastyRow.includes("line one<br>line two"), "newlines become <br>");
assert.equal(nastyRow.split("\t").length, 4, "an embedded tab must not add a column");
assert.equal(nasty.split("\n").length, 8, "an embedded newline must not add a row");

// & must be escaped before < and >, or "&lt;" would itself become "&amp;lt;".
assert.ok(!nastyRow.includes("&amp;lt;"), "escaping order is not double-applied");

// --- tags -------------------------------------------------------------------

const tagged = toAnkiTsv(std, [
  card({ ksbIds: ["K4.2"], tags: ["ST0585", "K4"] }),
]).split("\n")[6].split("\t")[3];
assert.deepEqual(
  tagged.split(" ").sort(),
  ["K4", "K4.2", "ST0585"],
  "the sub-point code is searchable alongside the KSB",
);
// Anki splits tags on spaces, so an internal space would become two tags.
const spaced = toAnkiTsv(std, [card({ tags: ["needs work"] })])
  .split("\n")[6]
  .split("\t")[3];
assert.ok(spaced.includes("needs-work"), "spaces inside a tag are hyphenated");

// --- ordering and whole-portfolio shape -------------------------------------

const all = generateAllStarterCards(std, TODAY);
const body = toAnkiTsv(std, all).trim().split("\n").slice(6);
assert.equal(body.length, all.length, "every card becomes exactly one row");

// Ordered by the standard's KSB order, so decks read K1…B6 rather than by id.
const decks = body.map((r) => r.split("\t")[2]);
assert.ok(
  decks.indexOf("ST0585::Knowledge::K1 Context of Data Science") <
    decks.indexOf("ST0585::Behaviour::B1 Inquisitive approach"),
  "Knowledge decks precede Behaviour decks",
);
assert.ok(
  decks.every((d) => d.startsWith("ST0585::")),
  "everything nests under one collapsible top-level deck",
);
assert.ok(
  !decks.includes("ST0585::Unsorted"),
  "generated cards all map to a real KSB",
);

// Report-only KSBs are never cardable, so they never reach the deck.
assert.ok(!decks.some((d) => d.includes("::S1 ")), "no deck for a report-only KSB");

// --- empty portfolio --------------------------------------------------------

const empty = toAnkiTsv(std, []);
assert.equal(empty.trim().split("\n").length, 6, "header only, no rows");

// --- filename ---------------------------------------------------------------

assert.equal(ankiFileName(std), "datafolio-st0585-revision.txt");

// A seeded card's blank back exports as an empty field rather than dropping the
// column — the learner still gets the prompt to answer in Anki.
const seeded = generateStarterCards(std, byId.K4, TODAY)[0];
const seededRow = toAnkiTsv(std, [seeded]).split("\n")[6].split("\t");
assert.equal(seededRow.length, 4);
assert.equal(seededRow[1], "", "an unanswered card still exports, with an empty back");

console.log("anki.test.ts: ok");
