// Parse a DataFolio `evidence/<KSB>/index.md` file back into the app's domain
// model. This is the exact inverse of `genMd` in lib/domain.ts: given the file
// that `genMd` writes (and a GitHub-backed data layer commits), reconstruct the
// front-matter fields plus a domain `Evidence[]`.
//
// The file is a YAML front-matter block delimited by `---`, followed by a
// Markdown body. `genMd` writes one `##` body section per front-matter
// `evidence:` entry, in the SAME ORDER, so we recover each item's reflection
// note by pairing body sections with front-matter entries by index.

import { load } from "js-yaml";
import type { Evidence, EvidenceStatus, EvidenceType } from "../types";

// ---- Public shape ----------------------------------------------------------

export interface ParsedFolder {
  ksb: string;
  type: string;
  title: string;
  route: string;
  /** Repo roll-up status string, verbatim: not-started | in-progress | submitted | approved. */
  status: string;
  subpoints: { id: string; covered: boolean }[];
  /** Domain Evidence items, in front-matter order. */
  evidence: Evidence[];
  updated: string;
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
function asIsoString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

// ---- Front-matter split (mirrors the Python coverage script) ---------------

/**
 * Python's `text.split('---', 2)` splits on at most the first two occurrences,
 * keeping the remainder intact as the final element. JS's native `split` with a
 * limit drops the remainder, so replicate the Python semantics here.
 */
function splitWithLimit(text: string, sep: string, limit: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (out.length < limit) {
    const i = rest.indexOf(sep);
    if (i === -1) break;
    out.push(rest.slice(0, i));
    rest = rest.slice(i + sep.length);
  }
  out.push(rest);
  return out;
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
  feedback?: unknown;
}

interface RawFrontMatter {
  ksb?: unknown;
  type?: unknown;
  title?: unknown;
  route?: unknown;
  status?: unknown;
  subpoints?: unknown;
  evidence?: unknown;
  updated?: unknown;
}

// ---- Body note recovery ----------------------------------------------------

/**
 * Split the Markdown body into per-evidence sections. `genMd` starts each
 * section with a `## ` heading and emits them in front-matter order, so the
 * returned array lines up with the `evidence:` list by index.
 */
function bodySections(body: string): string[][] {
  const lines = body.split("\n");
  const sections: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = [line];
      sections.push(current);
    } else if (current) {
      current.push(line);
    }
  }
  return sections;
}

/**
 * Recover the reflection note from one body section. `genMd` lays a section out
 * as: the `## ` heading, an optional `- Link:`/`- File:` line, a `- Maps:` line,
 * then (if a note exists) a blank line + the note text, then (if feedback
 * exists) a blank line + `> Coach: …`, then a trailing blank line. The note is
 * therefore everything between the `- Maps:` line and either the `> Coach:` line
 * or the end of the section, with surrounding blank lines trimmed.
 */
function extractNote(section: string[]): string {
  const mapsIdx = section.findIndex((l) => l.startsWith("- Maps:"));
  if (mapsIdx === -1) return "";
  let tail = section.slice(mapsIdx + 1);
  const coachIdx = tail.findIndex((l) => l.startsWith("> Coach:"));
  if (coachIdx !== -1) tail = tail.slice(0, coachIdx);
  // Trim leading and trailing blank lines (the separators genMd inserts).
  while (tail.length && tail[0].trim() === "") tail.shift();
  while (tail.length && tail[tail.length - 1].trim() === "") tail.pop();
  return tail.join("\n");
}

// ---- Main entry ------------------------------------------------------------

/** Parse an `evidence/<KSB>/index.md` string into the domain model. */
export function parseIndexMd(md: string): ParsedFolder {
  // `['', frontMatterYaml, body]` — same split the coverage script relies on.
  const parts = splitWithLimit(md, "---", 2);
  if (parts.length < 3) {
    throw new Error("parseIndexMd: no front-matter block found (expected two `---` fences).");
  }
  const frontMatterYaml = parts[1];
  const body = parts[2];

  const fm = (load(frontMatterYaml) ?? {}) as RawFrontMatter;

  const rawEvidence: RawEvidence[] = Array.isArray(fm.evidence)
    ? (fm.evidence as RawEvidence[])
    : [];
  const sections = bodySections(body);

  const evidence: Evidence[] = rawEvidence.map((item, i) => {
    const type = String(item.type) as EvidenceType;
    const maps = Array.isArray(item.maps) ? item.maps.map((m) => String(m)) : [];

    const ev: Evidence = {
      id: String(item.id),
      ksbIds: maps,
      type,
      title: String(item.title ?? ""),
      // Notes only live on reflection items in the domain model; recover from
      // the paired body section.
      note: type === "reflection" ? extractNote(sections[i] ?? []) : "",
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
    ? (fm.subpoints as { id?: unknown; covered?: unknown }[]).map((s) => ({
        id: String(s.id),
        covered: Boolean(s.covered),
      }))
    : [];

  return {
    ksb: String(fm.ksb ?? ""),
    type: String(fm.type ?? ""),
    title: String(fm.title ?? ""),
    route: String(fm.route ?? ""),
    status: String(fm.status ?? ""),
    subpoints,
    evidence,
    updated: asIsoString(fm.updated),
  };
}
