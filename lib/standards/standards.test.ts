// Tests for the standards loader and the ST0585 transcription.
//
// The EXPECTED table below is a deliberately independent second transcription of
// Annex A of the ST0585/AP01 assessment plan. It is not derived from the YAML —
// if the two disagree, one of them mis-read the published table.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseStandard } from "./parse";
import { STANDARDS } from "./generated";
import {
  collectingMethods,
  collectsEvidence,
  getStandard,
  validKsbIds,
} from "./index";
import { readManifest } from "./manifest";

const ROOT = resolve(__dirname, "..", "..");
const read = (f: string) => readFileSync(join(ROOT, "standards", f), "utf8");

const PD = "professional_discussion";
const R = "report";
const KT = "knowledge_test";

/** Annex A, transcribed by hand. Sub-points do not inherit their parent's row. */
const EXPECTED: Record<string, string[]> = {
  K1: [PD],
  K2: [PD],
  K3: [PD, KT],
  "K3.1": [KT],
  "K3.2": [KT],
  "K3.3": [PD],
  K4: [KT],
  "K4.1": [KT],
  "K4.2": [KT],
  "K4.3": [KT],
  "K4.4": [KT],
  "K4.5": [KT],
  K5: [PD, KT],
  "K5.1": [KT],
  "K5.2": [KT],
  "K5.3": [PD],
  S1: [R],
  S2: [R],
  S3: [R],
  S4: [R],
  S5: [R],
  S6: [PD, R],
  S7: [PD],
  S8: [R],
  B1: [PD],
  B2: [PD],
  B3: [PD],
  B4: [PD, R],
  B5: [R],
  B6: [PD],
};

// ---------------------------------------------------------------- ST0585

const st0585 = STANDARDS.st0585;
assert.ok(st0585, "st0585 should be in the generated registry");
assert.equal(st0585.reference, "ST0585/AP01");
assert.equal(st0585.level, 6);

// The standard has 19 KSBs: K1-K5, S1-S8, B1-B6.
assert.equal(st0585.ksbs.length, 19);
assert.equal(st0585.ksbs.filter((k) => k.category === "Knowledge").length, 5);
assert.equal(st0585.ksbs.filter((k) => k.category === "Skill").length, 8);
assert.equal(st0585.ksbs.filter((k) => k.category === "Behaviour").length, 6);

// Every id in the standard appears in EXPECTED and vice versa — catches both a
// dropped KSB and a stale expectation.
const actual: Record<string, string[]> = {};
for (const k of st0585.ksbs) {
  actual[k.id] = k.methods;
  for (const p of k.points ?? []) actual[p.id] = p.methods;
}
assert.deepEqual(
  Object.keys(actual).sort(),
  Object.keys(EXPECTED).sort(),
  "KSB and sub-point ids should match Annex A exactly",
);

for (const [id, methods] of Object.entries(EXPECTED)) {
  assert.deepEqual(
    [...actual[id]].sort(),
    [...methods].sort(),
    `${id} assessment methods should match Annex A`,
  );
}

// Only K3, K4 and K5 carry sub-points.
assert.deepEqual(
  st0585.ksbs.filter((k) => k.points).map((k) => k.id),
  ["K3", "K4", "K5"],
);

// Knowledge test is modelled but not yet collected against.
assert.equal(st0585.methods[KT].collectsEvidence, false);
assert.equal(st0585.methods[PD].collectsEvidence, true);
assert.equal(st0585.methods[R].collectsEvidence, true);

// K4 is knowledge-test only, so it must not be evidence-collectable while KT is
// off. This is the case that would silently break if KT were dropped entirely.
const k4 = st0585.ksbs.find((k) => k.id === "K4")!;
assert.deepEqual(k4.methods, [KT]);
assert.ok(
  k4.methods.every((m) => !st0585.methods[m].collectsEvidence),
  "K4 should collect no evidence while the knowledge test is deferred",
);

// Statements are the published wording, not a paraphrase.
assert.equal(
  st0585.ksbs.find((k) => k.id === "B4")!.statement,
  "Consideration of problems in the context of organisation goals.",
);

// ------------------------------------------------------------- validation

const base = read("st0585.yaml");

function rejects(mutate: (src: string) => string, match: RegExp, why: string) {
  assert.throws(() => parseStandard(mutate(base), "test.yaml"), match, why);
}

rejects(
  (s) => s.replace("methods: [professional_discussion]\n    statement: >-\n      The context", "methods: [pub_quiz]\n    statement: >-\n      The context"),
  /unknown assessment method "pub_quiz"/,
  "unknown method key should be rejected",
);

rejects(
  (s) => s.replace("  - id: K1\n    category: Knowledge", "  - id: K1\n    category: Skill"),
  /category/,
  "category must agree with the code letter",
);

rejects(
  (s) => s.replace("      - id: K3.1", "      - id: K4.9"),
  /does not belong to "K3"/,
  "sub-point must belong to its parent",
);

rejects(
  (s) => s.replace("  - id: K2\n", "  - id: K1\n"),
  /duplicates "K1"/,
  "duplicate KSB codes should be rejected",
);

// A well-formed standard round-trips through the parser unchanged.
assert.deepEqual(parseStandard(base, "st0585.yaml"), st0585);

// --------------------------------------------------------------- manifest

// A repo with no manifest is an ST0585 portfolio — this is what every repo
// created before standards were configurable looks like.
assert.deepEqual(readManifest(null), { standardId: "st0585" });
assert.deepEqual(readManifest(""), { standardId: "st0585" });

assert.deepEqual(readManifest("standard: st0585\n"), { standardId: "st0585" });
assert.deepEqual(readManifest("standard: ST0585\n"), { standardId: "st0585" });
assert.deepEqual(readManifest("standard: st0585 # comment\n"), {
  standardId: "st0585",
});

// Extra keys are ignored, not rejected — the manifest is expected to grow.
assert.deepEqual(readManifest("standard: st0585\ncohort: 2026\n"), {
  standardId: "st0585",
});

// A learner's typo must degrade, never throw.
for (const bad of ["standard: st9999\n", "standard: [1,2\n", "- a\n- b\n"]) {
  const m = readManifest(bad);
  assert.equal(m.standardId, "st0585", `should fall back for ${JSON.stringify(bad)}`);
  assert.ok(m.warning, `should warn for ${JSON.stringify(bad)}`);
}

// ---------------------------------------------------------------- helpers

const std = getStandard("st0585");
assert.equal(getStandard("nope").id, "st0585", "unknown ids fall back");
assert.equal(getStandard(null).id, "st0585");

const ids = validKsbIds(std);
assert.equal(ids.size, 30, "19 KSBs + 11 sub-points");
assert.ok(ids.has("K4.5") && ids.has("S1"));
assert.ok(!ids.has("K9"));

assert.deepEqual(
  collectingMethods(std).map((m) => m.key),
  [PD, R],
  "knowledge test should not be collecting evidence yet",
);

assert.equal(collectsEvidence(std, k4), false, "K4 is knowledge-test only");
assert.equal(
  collectsEvidence(std, std.ksbs.find((k) => k.id === "K3")!),
  true,
  "K3 is also assessed by professional discussion",
);

console.log("standards.test.ts: ok");
