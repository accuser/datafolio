// Round-trip: renderCardsMd → revision/<KSB>/cards.md → parseCardsMd.
//
// The repo file is the source of truth, so anything that survives a commit must
// survive a reload. The cases below are the ones that would corrupt a file
// rather than merely look untidy.

import assert from "node:assert/strict";
import { generateStarterCards, renderCardsMd } from "../cards";
import { parseCardsMd } from "./cards-frontmatter";
import { getStandard, ksbIndex } from "../standards";
import type { Card } from "../types";

const std = getStandard("st0585");
const byId = ksbIndex(std);
const TODAY = "20 Jul 2026";

// --- generated starters round-trip unchanged --------------------------------

const seeded = generateStarterCards(std, byId.K4, TODAY);
const parsed = parseCardsMd(renderCardsMd(byId.K4, seeded));

assert.equal(parsed.ksb, "K4");
assert.equal(parsed.cards.length, seeded.length);
assert.deepEqual(
  parsed.cards.map((c) => c.id),
  seeded.map((c) => c.id),
  "ids survive, which is what keeps re-seeding idempotent across a reload",
);
assert.deepEqual(parsed.cards[0], seeded[0]);
assert.equal(parsed.cards[0].source, "seed");
assert.equal(parsed.cards[0].back, "", "an unanswered starter stays unanswered");

// --- content that could break the file --------------------------------------

const nasty: Card[] = [
  {
    id: "c-nasty",
    ksbIds: ["K4.2"],
    // A `---` on its own line is a front-matter fence. Inside a quoted scalar it
    // must not split the file — this is the bug the evidence parser already
    // guards, and cards get the learner's free text too.
    front: "What does this mean?\n---\nnot a fence",
    back: 'Quotes " and \' and a colon: value, plus a #hash and a - dash',
    tags: ["ST0585", "K4"],
    source: "learner",
    created: TODAY,
    updated: TODAY,
  },
];
const nastyBack = parseCardsMd(renderCardsMd(byId.K4, nasty));
assert.equal(nastyBack.cards.length, 1, "a `---` inside a card must not split the file");
assert.deepEqual(nastyBack.cards[0], nasty[0]);

// Body text is presentation only: a card whose back contains what looks like
// front matter must not be re-read out of the body.
const spoof: Card[] = [
  {
    id: "c-spoof",
    ksbIds: ["K4.1"],
    front: "Spoof",
    back: "---\ncards:\n  - id: injected\n    maps: [K4.1]\n    front: nope\n---",
    source: "learner",
    created: TODAY,
    updated: TODAY,
  },
];
const spoofBack = parseCardsMd(renderCardsMd(byId.K4, spoof));
assert.equal(spoofBack.cards.length, 1, "body content is never parsed back");
assert.equal(spoofBack.cards[0].id, "c-spoof");

// --- hand-edited files ------------------------------------------------------

// A card with no id or no mapping can't be edited, deleted, or filed, so it is
// dropped rather than loaded into a state the app can't act on.
const handEdited = `---
ksb: K4
type: Knowledge
cards:
  - id: c-ok
    maps: [K4.1]
    source: learner
    front: Fine
    back: ""
  - maps: [K4.1]
    front: No id
  - id: c-nomaps
    front: No mapping
updated: 2026-07-20
---
# body
`;
const he = parseCardsMd(handEdited);
assert.deepEqual(he.cards.map((c) => c.id), ["c-ok"]);

// An unknown source value is treated as the learner's own, never as a starter —
// otherwise a bulk "clear starters" could delete hand-written work.
const oddSource = parseCardsMd(`---
ksb: K4
cards:
  - id: c1
    maps: [K4.1]
    source: imported
    front: Hello
---
`);
assert.equal(oddSource.cards[0].source, "learner");

// Missing dates degrade to empty strings rather than "Invalid Date".
assert.equal(oddSource.cards[0].created, "");
assert.equal(oddSource.cards[0].updated, "", "updated falls back to created");

// A file with no front matter is a hard error, not a silent empty deck — that
// would look like the learner's cards had vanished.
assert.throws(() => parseCardsMd("# just a heading\n"), /parseCardsMd/);

// --- empty folder -----------------------------------------------------------

const emptyMd = renderCardsMd(byId.K4, []);
assert.deepEqual(parseCardsMd(emptyMd).cards, []);
assert.ok(emptyMd.includes("_No cards yet._"));

console.log("cards-md.roundtrip.ts: ok");
