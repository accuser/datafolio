// Parse a DataFolio `evidence/<KSB>/index.md` file back into the app's domain
// model. This is the exact inverse of `genMd` in lib/domain.ts: given the file
// that `genMd` writes (and a GitHub-backed data layer commits), reconstruct the
// front-matter fields plus a domain `Evidence[]`.
//
// The file is a YAML front-matter block delimited by `---` fence lines,
// followed by a Markdown body. Everything the app needs — including each
// reflection's note — lives in the front-matter; the body is presentation only
// and is never parsed back (so user text in the body can't corrupt a load).

import { load } from "js-yaml";
import type { Evidence, EvidenceStatus, EvidenceType } from "../types";

// ---- Public shape ----------------------------------------------------------

export interface ParsedFolder {
  ksb: string;
  type: string;
  title: string;
  /**
   * Assessment method keys. Files written before standards were configurable
   * carry a single `route:` scalar instead; those are mapped onto the ST0585
   * method keys so old folders keep parsing. See `methodsFromFrontMatter`.
   */
  methods: string[];
  /** Repo roll-up status string, verbatim: not-started | in-progress | submitted | approved. */
  status: string;
  subpoints: { id: string; methods: string[]; covered: boolean }[];
  /** Domain Evidence items, in front-matter order. */
  evidence: Evidence[];
  updated: string;
}

/**
 * The legacy `route:` scalar, mapped to method keys.
 *
 * `portfolio` meant "portfolio work and professional discussion" — the two were
 * welded together — so it maps to professional discussion alone. Nothing reads
 * these values to make decisions (the standard is the authority on how a KSB is
 * assessed); they exist so an un-migrated file still round-trips.
 */
const LEGACY_ROUTES: Record<string, string[]> = {
  portfolio: ["professional_discussion"],
  project: ["report"],
  both: ["professional_discussion", "report"],
};

function methodsFromFrontMatter(fm: {
  methods?: unknown;
  route?: unknown;
}): string[] {
  if (Array.isArray(fm.methods)) return fm.methods.map((m) => String(m));
  const route = String(fm.route ?? "").toLowerCase();
  return LEGACY_ROUTES[route] ?? [];
}

// ---- Small converters (exported — handy for callers/tests) -----------------

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Lowercase repo status → Capitalized domain `EvidenceStatus`. */
export function repoStatusToDomain(status: string): EvidenceStatus {
  const map: Record<string, EvidenceStatus> = {
    draft: "Draft",
    submitted: "Submitted",
    approved: "Approved",
    changes: "Changes",
  };
  const key = String(status).toLowerCase();
  return map[key] ?? "Draft";
}

/** ISO `2026-06-12` → display `"12 Jun 2026"` (day without leading zero). */
export function isoToDisplayDate(iso: string): string {
  const s = asIsoString(iso);
  const parts = s.split("-");
  if (parts.length < 3) return s;
  const [y, m, d] = parts;
  const day = parseInt(d, 10);
  const month = MONTHS[parseInt(m, 10) - 1] ?? m;
  return `${day} ${month} ${y}`;
}

/**
 * Normalise a front-matter date value to an ISO `YYYY-MM-DD` string. js-yaml's
 * default schema parses bare `2026-06-12` timestamps into `Date` objects, so
 * accept either. `null`/`undefined` (e.g. the template's empty `updated:`)
 * become an empty string.
 */
export function asIsoString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

// ---- Front-matter split (line-anchored fences) -----------------------------

/**
 * Split an index.md into its YAML front-matter and Markdown body. The block is
 * delimited by `---` lines (a `---` on its own line, ignoring trailing
 * whitespace) — NOT by any `---` substring, so titles/notes/feedback that
 * contain `---` no longer split the file in the wrong place.
 */
export function splitFrontMatter(
  md: string,
  label = "parseIndexMd",
): { frontMatter: string; body: string } {
  const lines = md.split(/\r?\n/);
  // A fence is `---` at column 0 (trailing whitespace tolerated). Crucially it
  // must NOT be indented: an indented `---` is block-scalar content (e.g. a
  // literal `---` line inside a reflection note), not a fence.
  const isFence = (l: string | undefined) => /^---[ \t]*$/.test(l ?? "");
  if (!isFence(lines[0])) {
    throw new Error(`${label}: no front-matter block found (expected an opening \`---\` fence).`);
  }
  const end = lines.findIndex((l, i) => i > 0 && isFence(l));
  if (end === -1) {
    throw new Error(`${label}: unterminated front-matter block (missing closing \`---\` fence).`);
  }
  return {
    frontMatter: lines.slice(1, end).join("\n"),
    body: lines.slice(end + 1).join("\n"),
  };
}

// ---- Raw front-matter item shape (as YAML-loaded) --------------------------

interface RawEvidence {
  id?: unknown;
  title?: unknown;
  type?: unknown;
  file?: unknown;
  ref?: unknown;
  maps?: unknown;
  status?: unknown;
  date?: unknown;
  reviewed_by?: unknown;
  note?: unknown;
  feedback?: unknown;
}

interface RawFrontMatter {
  ksb?: unknown;
  type?: unknown;
  title?: unknown;
  methods?: unknown;
  /** Legacy: superseded by `methods`. Still read so old folders keep parsing. */
  route?: unknown;
  status?: unknown;
  subpoints?: unknown;
  evidence?: unknown;
  updated?: unknown;
}

// ---- Main entry ------------------------------------------------------------

/** Parse an `evidence/<KSB>/index.md` string into the domain model. */
export function parseIndexMd(md: string): ParsedFolder {
  const { frontMatter } = splitFrontMatter(md);

  const fm = (load(frontMatter) ?? {}) as RawFrontMatter;

  const rawEvidence: RawEvidence[] = Array.isArray(fm.evidence)
    ? (fm.evidence as RawEvidence[])
    : [];

  const evidence: Evidence[] = rawEvidence.map((item) => {
    const type = String(item.type) as EvidenceType;
    const maps = Array.isArray(item.maps) ? item.maps.map((m) => String(m)) : [];

    const ev: Evidence = {
      id: String(item.id),
      ksbIds: maps,
      type,
      title: String(item.title ?? ""),
      // Notes only live on reflection items in the domain model; read the note
      // straight from the front-matter (block scalar).
      note: type === "reflection" && item.note != null ? String(item.note) : "",
      status: repoStatusToDomain(String(item.status)),
      date: isoToDisplayDate(asIsoString(item.date)),
      feedback: item.feedback == null ? "" : String(item.feedback),
    };

    // github → domain `url` (protocol stripped); upload → `fileName`.
    if (type === "github" && item.ref != null) {
      ev.url = String(item.ref).replace(/^https?:\/\//, "");
    }
    if (type === "upload" && item.file != null) {
      ev.fileName = String(item.file);
    }

    return ev;
  });

  const subpoints = Array.isArray(fm.subpoints)
    ? (fm.subpoints as { id?: unknown; methods?: unknown; covered?: unknown }[]).map(
        (s) => ({
          id: String(s.id),
          methods: Array.isArray(s.methods) ? s.methods.map((m) => String(m)) : [],
          covered: Boolean(s.covered),
        }),
      )
    : [];

  return {
    ksb: String(fm.ksb ?? ""),
    type: String(fm.type ?? ""),
    title: String(fm.title ?? ""),
    methods: methodsFromFrontMatter(fm),
    status: String(fm.status ?? ""),
    subpoints,
    evidence,
    updated: asIsoString(fm.updated),
  };
}
