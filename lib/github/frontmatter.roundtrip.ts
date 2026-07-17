// Standalone round-trip check (not a framework test):
//   genMd(sample, ksb)  ->  parseIndexMd(md)  ===  sample
//
// Run from the datafolio project root:
//   npx tsx lib/github/frontmatter.roundtrip.ts

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { genMd } from "../domain";
import { KSB_BY_ID } from "../ksbs";
import type { Evidence } from "../types";
import { parseIndexMd } from "./frontmatter";

// ---- Sample: a KSB WITH sub-points (K4) + 3 evidence items ------------------

const ksb = KSB_BY_ID["K4"];

const sample: Evidence[] = [
  {
    id: "e1",
    ksbIds: ["K4", "K4.1"], // roots to K4; covers sub-point K4.1
    type: "github",
    title: "Churn model notebook",
    url: "github.com/you/portfolio-evidence/blob/main/churn.ipynb",
    status: "Submitted",
    date: "2 Jul 2026",
    feedback: "Great start — add a validation split.",
  },
  {
    id: "e2",
    ksbIds: ["K4.2"], // covers sub-point K4.2
    type: "reflection",
    title: "Reflection on model selection",
    note:
      "I compared logistic regression, random forests and gradient boosting.\n" +
      "Gradient boosting won on AUC and calibration.\n" +
      "\n" +
      "Next I would tune regularisation and revisit feature leakage.",
    status: "Draft",
    date: "10 Jul 2026",
    feedback: "Good depth — mention cross-validation next time.",
  },
  {
    id: "e3",
    ksbIds: ["K4.3"], // covers sub-point K4.3
    type: "upload",
    title: "Confusion matrix export",
    fileName: "confusion-matrix.png",
    status: "Approved",
    date: "15 Jun 2026",
    feedback: "",
  },
];

// ---- Comparison helpers ----------------------------------------------------

/** Canonical form: optional strings collapse undefined -> "" so absent and
 *  empty compare equal (consistent with the parser's mapping). */
function canon(e: Evidence) {
  return {
    id: e.id,
    ksbIds: [...e.ksbIds],
    type: e.type,
    title: e.title,
    url: e.url ?? "",
    fileName: e.fileName ?? "",
    note: e.note ?? "",
    status: e.status,
    date: e.date,
    feedback: e.feedback ?? "",
  };
}

function assertDeepEqual(actual: unknown, expected: unknown, ctx: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`Mismatch (${ctx}):\n  expected: ${b}\n  actual:   ${a}`);
  }
}

// ---- 1) Full round-trip ----------------------------------------------------

const md = genMd(sample, ksb);
const parsed = parseIndexMd(md);

if (parsed.ksb !== "K4") throw new Error(`ksb: expected K4, got ${parsed.ksb}`);
if (parsed.evidence.length !== sample.length) {
  throw new Error(
    `evidence count: expected ${sample.length}, got ${parsed.evidence.length}`,
  );
}

sample.forEach((orig, i) => {
  assertDeepEqual(canon(parsed.evidence[i]), canon(orig), `evidence[${i}] id=${orig.id}`);
});

// Sub-points: K4.1, K4.2, K4.3 covered; K4.4, K4.5 not.
const covered = new Set(
  parsed.subpoints.filter((s) => s.covered).map((s) => s.id),
);
["K4.1", "K4.2", "K4.3"].forEach((id) => {
  if (!covered.has(id)) throw new Error(`sub-point ${id} should be covered`);
});
["K4.4", "K4.5"].forEach((id) => {
  if (covered.has(id)) throw new Error(`sub-point ${id} should NOT be covered`);
});

// ---- 2) Real empty template file ------------------------------------------

// Self-contained fixture (a copy of the template repo's empty K1 index.md),
// resolved relative to this file so the test runs on any machine / in CI.
const templatePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "empty-K1-index.md",
);
const templateMd = readFileSync(templatePath, "utf8");
const template = parseIndexMd(templateMd);

if (template.ksb !== "K1") throw new Error(`template ksb: expected K1, got ${template.ksb}`);
if (template.evidence.length !== 0) {
  throw new Error(`template evidence: expected [], got ${template.evidence.length} items`);
}
if (template.subpoints.length !== 0) {
  throw new Error(`template subpoints: expected none, got ${template.subpoints.length}`);
}

console.log("ROUND-TRIP OK");
