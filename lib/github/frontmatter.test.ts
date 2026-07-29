// Regression tests for inherited-key lookups in the index.md parser.
//
// `status:` and `route:` are typed by hand in a learner's repo, so any string
// can arrive as a lookup key. On a default-prototype map, a key that exists on
// Object.prototype ("constructor", "__proto__") resolves to something truthy
// instead of missing — `status: constructor` put a Function into
// Evidence.status and crashed the portfolio render for the learner and their
// reviewer. These pin the fallback behaviour for every such key.
//
// Run: `npx tsx --test --conditions=react-server lib/github/frontmatter.test.ts`

import assert from "node:assert/strict";
import { parseIndexMd, repoStatusToDomain } from "./frontmatter";

// ---- repoStatusToDomain ----------------------------------------------------

// The four repo statuses map, case-insensitively.
assert.equal(repoStatusToDomain("draft"), "Draft");
assert.equal(repoStatusToDomain("SUBMITTED"), "Submitted");
assert.equal(repoStatusToDomain("Approved"), "Approved");
assert.equal(repoStatusToDomain("changes"), "Changes");

// Everything else falls back to Draft — including keys Object.prototype has.
assert.equal(repoStatusToDomain("wip"), "Draft");
assert.equal(repoStatusToDomain("constructor"), "Draft");
assert.equal(repoStatusToDomain("__proto__"), "Draft");

// ---- parseIndexMd with hand-typed inherited keys ---------------------------

const withEvidenceStatus = (status: string) =>
  [
    "---",
    "ksb: K1",
    "type: Knowledge",
    "title: The context of Data Science.",
    "methods: [professional_discussion]",
    "status: in-progress",
    "evidence:",
    "  - id: e1",
    "    title: A reflection",
    "    type: reflection",
    "    maps: [K1]",
    `    status: ${status}`,
    "    date: 2026-07-01",
    "    note: |-",
    "      Some text.",
    "updated: 2026-07-01",
    "---",
    "",
    "# K1",
  ].join("\n");

for (const status of ["constructor", "__proto__"]) {
  const p = parseIndexMd(withEvidenceStatus(status));
  assert.equal(
    p.evidence[0].status,
    "Draft",
    `status: ${status} must fall back to Draft, not an inherited value`,
  );
}

// A real status on the same file still maps — the gate is per-key, not a
// blanket fallback.
assert.equal(
  parseIndexMd(withEvidenceStatus("approved")).evidence[0].status,
  "Approved",
);

// ---- legacy `route:` with hand-typed inherited keys ------------------------

const withRoute = (route: string) =>
  [
    "---",
    "ksb: K1",
    "type: Knowledge",
    "title: The context of Data Science.",
    `route: ${route}`,
    "status: not-started",
    "evidence: []",
    "updated: 2026-01-01",
    "---",
    "",
    "# K1",
  ].join("\n");

for (const route of ["constructor", "__proto__"]) {
  assert.deepEqual(
    parseIndexMd(withRoute(route)).methods,
    [],
    `route: ${route} must take the unknown-route fallback, not an inherited value`,
  );
}

// A real legacy route on the same file still maps.
assert.deepEqual(parseIndexMd(withRoute("portfolio")).methods, [
  "professional_discussion",
]);

console.log("frontmatter.test.ts: ok");
