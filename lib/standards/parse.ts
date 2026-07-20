// Parse and validate a `standards/*.yaml` file into a Standard.
//
// Runs at build time only (see scripts/build-standards.ts) — the app imports the
// generated module, never this. Validation is deliberately strict and throws on
// the first problem: a malformed standard should fail the build, not degrade at
// runtime in a learner's portfolio.

import { load } from "js-yaml";
import type {
  AssessmentMethod,
  Category,
  Colour,
  Ksb,
  MethodKey,
  Standard,
  SubPoint,
} from "./types";

const CATEGORIES: readonly Category[] = ["Knowledge", "Skill", "Behaviour"];

/** KSB codes are a category letter and a number, e.g. K1, S12, B3. */
const KSB_ID = /^[KSB][0-9]+$/;

/** Sub-point codes extend their parent with a dotted suffix, e.g. K3.1. */
const SUBPOINT_ID = /^[KSB][0-9]+\.[0-9]+$/;

class StandardError extends Error {
  constructor(source: string, path: string, message: string) {
    super(`${source}: ${path} ${message}`);
    this.name = "StandardError";
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseStandard(yamlText: string, source: string): Standard {
  const fail = (path: string, message: string) => {
    throw new StandardError(source, path, message);
  };

  const req = (obj: Record<string, unknown>, key: string, path: string) => {
    const v = obj[key];
    if (v === undefined || v === null) fail(`${path}.${key}`, "is required");
    return v;
  };

  const str = (v: unknown, path: string): string => {
    // js-yaml's default schema turns bare dates (2025-10-24) into Date objects
    // and bare numbers into numbers, so coerce rather than reject.
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "number") return String(v);
    if (typeof v !== "string" || v.trim() === "")
      fail(path, "must be a non-empty string");
    return (v as string).trim();
  };

  const doc = load(yamlText);
  if (!isRecord(doc)) fail("(root)", "must be a mapping");
  const root = doc as Record<string, unknown>;

  // ------------------------------------------------------------- methods
  const rawMethods = req(root, "assessment_methods", "");
  if (!isRecord(rawMethods)) fail("assessment_methods", "must be a mapping");

  const methods: Record<MethodKey, AssessmentMethod> = {};
  for (const [key, raw] of Object.entries(
    rawMethods as Record<string, unknown>,
  )) {
    const p = `assessment_methods.${key}`;
    if (!isRecord(raw)) fail(p, "must be a mapping");
    const m = raw as Record<string, unknown>;

    const colourRaw = req(m, "colour", p);
    if (!isRecord(colourRaw)) fail(`${p}.colour`, "must be a mapping");
    const c = colourRaw as Record<string, unknown>;
    const colour: Colour = {
      bg: str(req(c, "bg", `${p}.colour`), `${p}.colour.bg`),
      fg: str(req(c, "fg", `${p}.colour`), `${p}.colour.fg`),
    };

    const collects = req(m, "collects_evidence", p);
    if (typeof collects !== "boolean")
      fail(`${p}.collects_evidence`, "must be true or false");

    methods[key] = {
      key,
      label: str(req(m, "label", p), `${p}.label`),
      abbr: str(req(m, "abbr", p), `${p}.abbr`),
      note: str(req(m, "note", p), `${p}.note`),
      collectsEvidence: collects as boolean,
      colour,
    };
  }
  if (Object.keys(methods).length === 0)
    fail("assessment_methods", "must declare at least one method");

  /** Resolve a `methods:` list, checking every key exists. */
  const methodList = (v: unknown, path: string): MethodKey[] => {
    if (!Array.isArray(v) || v.length === 0)
      fail(path, "must be a non-empty list of assessment method keys");
    const keys = (v as unknown[]).map((k, i) => str(k, `${path}[${i}]`));
    for (const [i, k] of keys.entries()) {
      if (!(k in methods))
        fail(
          `${path}[${i}]`,
          `refers to unknown assessment method "${k}" (known: ${Object.keys(methods).join(", ")})`,
        );
    }
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length) fail(path, `lists "${dupes[0]}" more than once`);
    return keys;
  };

  // ---------------------------------------------------------------- ksbs
  const rawKsbs = req(root, "ksbs", "");
  if (!Array.isArray(rawKsbs) || rawKsbs.length === 0)
    fail("ksbs", "must be a non-empty list");

  const seen = new Set<string>();
  const ksbs: Ksb[] = (rawKsbs as unknown[]).map((raw, i) => {
    const p = `ksbs[${i}]`;
    if (!isRecord(raw)) fail(p, "must be a mapping");
    const k = raw as Record<string, unknown>;

    const id = str(req(k, "id", p), `${p}.id`);
    if (!KSB_ID.test(id))
      fail(`${p}.id`, `"${id}" is not a valid KSB code (expected e.g. K1, S4, B2)`);
    if (seen.has(id)) fail(`${p}.id`, `duplicates "${id}"`);
    seen.add(id);

    const category = str(req(k, "category", p), `${p}.category`) as Category;
    if (!CATEGORIES.includes(category))
      fail(`${p}.category`, `must be one of ${CATEGORIES.join(", ")}`);
    if (category[0] !== id[0])
      fail(
        `${p}.category`,
        `is "${category}" but the code "${id}" implies "${
          CATEGORIES.find((c) => c[0] === id[0]) ?? "?"
        }"`,
      );

    let points: SubPoint[] | undefined;
    if (k.points !== undefined) {
      const rawPoints = k.points;
      if (!Array.isArray(rawPoints) || rawPoints.length === 0)
        fail(`${p}.points`, "must be a non-empty list when present");

      points = (rawPoints as unknown[]).map((rp, j) => {
        const pp = `${p}.points[${j}]`;
        if (!isRecord(rp)) fail(pp, "must be a mapping");
        const sp = rp as Record<string, unknown>;

        const spId = str(req(sp, "id", pp), `${pp}.id`);
        if (!SUBPOINT_ID.test(spId))
          fail(`${pp}.id`, `"${spId}" is not a valid sub-point code`);
        if (spId.split(".")[0] !== id)
          fail(`${pp}.id`, `"${spId}" does not belong to "${id}"`);
        if (seen.has(spId)) fail(`${pp}.id`, `duplicates "${spId}"`);
        seen.add(spId);

        return {
          id: spId,
          text: str(req(sp, "text", pp), `${pp}.text`),
          methods: methodList(req(sp, "methods", pp), `${pp}.methods`),
        };
      });
    }

    return {
      id,
      category,
      short: str(req(k, "short", p), `${p}.short`),
      statement: str(req(k, "statement", p), `${p}.statement`),
      methods: methodList(req(k, "methods", p), `${p}.methods`),
      ...(points ? { points } : {}),
    };
  });

  // Every declared method should be reachable, or it is dead config.
  const used = new Set(
    ksbs.flatMap((k) => [
      ...k.methods,
      ...(k.points ?? []).flatMap((sp) => sp.methods),
    ]),
  );
  for (const key of Object.keys(methods)) {
    if (!used.has(key))
      fail(`assessment_methods.${key}`, "is declared but no KSB uses it");
  }

  return {
    id: str(req(root, "id", ""), "id"),
    reference: str(req(root, "reference", ""), "reference"),
    title: str(req(root, "title", ""), "title"),
    level: Number(str(req(root, "level", ""), "level")),
    published: str(req(root, "published", ""), "published"),
    methods,
    ksbs,
  };
}
