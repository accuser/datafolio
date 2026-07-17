import type { CSSProperties } from "react";
import type {
  Category,
  Evidence,
  EvidenceStatus,
  EvidenceType,
  Ksb,
  KsbStatusKey,
  RouteKey,
} from "./types";

// ---- Evidence ↔ KSB matching (by root code) -------------------------------

/** "K4.2" → "K4". Sub-point tags roll up to their parent KSB. */
export function rootOf(tag: string): string {
  return tag.split(".")[0];
}

/** Evidence items that map to a KSB (via any of their tags' root codes). */
export function evFor(evidence: Evidence[], kid: string): Evidence[] {
  return evidence.filter((e) => e.ksbIds.some((t) => rootOf(t) === kid));
}

/** Evidence items whose maps[] contain this exact sub-point id. */
export function evForPoint(evidence: Evidence[], pid: string): Evidence[] {
  return evidence.filter((e) => e.ksbIds.includes(pid));
}

/** Derived KSB status: no evidence → not-started; any approved → approved;
 *  else any submitted → submitted; else → in-progress. */
export function ksbStatusKey(evidence: Evidence[], kid: string): KsbStatusKey {
  const ev = evFor(evidence, kid);
  if (!ev.length) return "notstarted";
  if (ev.some((e) => e.status === "Approved")) return "approved";
  if (ev.some((e) => e.status === "Submitted")) return "submitted";
  return "inprogress";
}

// ---- Presentation metadata -------------------------------------------------

export interface Meta {
  label: string;
  bg: string;
  fg: string;
}

export function statusMeta(key: KsbStatusKey): Meta {
  return {
    notstarted: { label: "Not started", bg: "#f4f4f5", fg: "#71717a" },
    inprogress: { label: "In progress", bg: "#fef3c7", fg: "#92400e" },
    submitted: { label: "Awaiting review", bg: "#dbeafe", fg: "#1e40af" },
    approved: { label: "Approved", bg: "#dcfce7", fg: "#166534" },
  }[key];
}

export function evMeta(status: EvidenceStatus): Meta {
  return {
    Draft: { label: "Draft", bg: "#f4f4f5", fg: "#71717a" },
    Submitted: { label: "Awaiting review", bg: "#dbeafe", fg: "#1e40af" },
    Approved: { label: "Approved", bg: "#dcfce7", fg: "#166534" },
    Changes: { label: "Changes requested", bg: "#ffedd5", fg: "#9a3412" },
  }[status];
}

export interface RouteMeta extends Meta {
  note: string;
}

export function routeMeta(route: RouteKey): RouteMeta {
  return {
    portfolio: {
      label: "Portfolio",
      bg: "#eef2ff",
      fg: "#4338ca",
      note: "Gathered through e-portfolio work and professional discussion with your coach.",
    },
    project: {
      label: "Workplace project",
      bg: "#f0fdfa",
      fg: "#0f766e",
      note: "Evidenced through your work-based Data Science project and report.",
    },
    both: {
      label: "Portfolio + project",
      bg: "#fffbeb",
      fg: "#b45309",
      note: "Evidenced through both coach-supported portfolio work and your workplace project.",
    },
  }[route];
}

export interface TypeInfo {
  label: string;
  icon: string;
  bg: string;
  fg: string;
}

export function typeInfo(type: EvidenceType): TypeInfo {
  return {
    github: { label: "GitHub link", icon: "{ }", bg: "#e0e7ff", fg: "#4338ca" },
    reflection: {
      label: "Written reflection",
      icon: "“",
      bg: "#dcfce7",
      fg: "#15803d",
    },
    upload: { label: "File upload", icon: "⬆", bg: "#fef3c7", fg: "#b45309" },
  }[type];
}

export interface CategoryMeta {
  name: string;
  letter: string;
  fg: string;
  bg: string;
}

export function categoryMeta(cat: Category): CategoryMeta {
  return {
    Knowledge: { name: "Knowledge", letter: "K", fg: "#4f46e5", bg: "#eef2ff" },
    Skill: { name: "Skills", letter: "S", fg: "#0891b2", bg: "#ecfeff" },
    Behaviour: { name: "Behaviours", letter: "B", fg: "#9333ea", bg: "#faf5ff" },
  }[cat];
}

/** Shared pill style used for status/route badges. */
export function pill(bg: string, fg: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.3,
    background: bg,
    color: fg,
    whiteSpace: "nowrap",
  };
}

// ---- Dates -----------------------------------------------------------------

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Today as a display label, e.g. "17 Jul 2026". */
export function todayLabel(now: Date = new Date()): string {
  return `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

/** "12 Jun 2026" → "2026-06-12" (ISO 8601) for front-matter. */
export function isoDate(label: string): string {
  const map: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const parts = String(label).split(" ");
  if (parts.length < 3) return label;
  return `${parts[2]}-${map[parts[1]] || "01"}-${parts[0].padStart(2, "0")}`;
}

// ---- index.md generation ---------------------------------------------------

/** Generate the KSB folder's index.md exactly as the coverage script expects.
 *  This is the write payload a GitHub-backed data layer would commit. */
export function genMd(evidence: Evidence[], k: Ksb): string {
  return renderIndexMd(k, evFor(evidence, k.id), evidence);
}

/** Render a folder's index.md. `ev` are the items physically stored in this
 *  folder (its `evidence[]` list + body); `coverageEvidence` is the full set of
 *  evidence across the repo, used to compute cross-folder sub-point coverage and
 *  the derived KSB status. `genMd` passes the same array for both, matching the
 *  in-app preview; a GitHub-backed store passes only this folder's primary items
 *  as `ev` so an item mapped to several KSBs is stored once (in its primary
 *  folder) yet still counts toward every mapped KSB's coverage. */
export function renderIndexMd(
  k: Ksb,
  ev: Evidence[],
  coverageEvidence: Evidence[],
): string {
  const sk = ksbStatusKey(coverageEvidence, k.id);
  const smap: Record<KsbStatusKey, string> = {
    notstarted: "not-started",
    inprogress: "in-progress",
    submitted: "submitted",
    approved: "approved",
  };
  const q = (s: string) => JSON.stringify(s);
  const httpsRef = (url?: string) =>
    url ? "https://" + url.replace(/^https?:\/\//, "") : "";
  const L: string[] = [];
  L.push("---");
  L.push("ksb: " + k.id);
  L.push("type: " + k.cat);
  L.push("title: " + q(k.title));
  L.push("route: " + k.route);
  L.push("status: " + smap[sk]);
  if (k.points) {
    L.push("subpoints:");
    k.points.forEach((p) => {
      L.push("  - id: " + p.id);
      L.push("    covered: " + (evForPoint(coverageEvidence, p.id).length > 0));
    });
  }
  L.push("evidence:" + (ev.length ? "" : " []"));
  ev.forEach((e) => {
    L.push("  - id: " + e.id);
    L.push("    title: " + q(e.title));
    L.push("    type: " + e.type);
    if (e.type === "upload") L.push("    file: " + e.fileName);
    else if (e.type === "github") L.push("    ref: " + httpsRef(e.url));
    L.push("    maps: [" + e.ksbIds.join(", ") + "]");
    L.push("    status: " + e.status.toLowerCase());
    L.push("    date: " + isoDate(e.date));
    L.push("    reviewed_by: coach");
    L.push("    feedback: " + q(e.feedback || ""));
  });
  L.push("updated: " + isoDate(todayLabel()));
  L.push("---");
  L.push("");
  L.push("# " + k.id + " — " + k.short);
  L.push("");
  L.push("> " + k.title);
  L.push("");
  if (!ev.length) L.push("_No evidence yet._");
  ev.forEach((e) => {
    L.push("## " + e.title + "  (" + e.status + ")");
    if (e.type === "github") L.push("- Link: " + httpsRef(e.url));
    if (e.type === "upload") L.push("- File: ./" + e.fileName);
    L.push("- Maps: " + e.ksbIds.join(", "));
    if (e.note) {
      L.push("");
      L.push(e.note);
    }
    if (e.feedback) {
      L.push("");
      L.push("> Coach: " + e.feedback);
    }
    L.push("");
  });
  return L.join("\n");
}
