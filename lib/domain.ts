import { dump } from "js-yaml";
import type {
  Evidence,
  EvidenceStatus,
  EvidenceType,
  KsbStatusKey,
} from "./types";
import type {
  Category,
  Ksb,
  MethodKey,
  Standard,
  SubPoint,
} from "./standards";

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

/**
 * Sub-points a learner can actually evidence.
 *
 * Coverage ratios must exclude sub-points assessed only by methods that collect
 * no evidence, or a KSB reads as incomplete forever: K3 has three sub-points but
 * only K3.3 is professional discussion, so "1/3" would imply two outstanding
 * when the learner is in fact done.
 */
export function collectingPoints(standard: Standard, k: Ksb): SubPoint[] {
  return (k.points ?? []).filter((p) =>
    p.methods.some((mk) => standard.methods[mk]?.collectsEvidence),
  );
}

/** Derived sub-point status. Same rule as `ksbStatusKey`, but matched exactly:
 *  a sub-point is only evidenced by items that name it, not by its siblings. */
export function pointStatusKey(evidence: Evidence[], pid: string): KsbStatusKey {
  const ev = evForPoint(evidence, pid);
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
    notstarted: { label: "Not started", bg: "#f4f4f5", fg: "#52525b" },
    inprogress: { label: "In progress", bg: "#fef3c7", fg: "#92400e" },
    submitted: { label: "Awaiting review", bg: "#dbeafe", fg: "#1e40af" },
    approved: { label: "Approved", bg: "#dcfce7", fg: "#166534" },
  }[key];
}

export function evMeta(status: EvidenceStatus): Meta {
  return {
    Draft: { label: "Draft", bg: "#f4f4f5", fg: "#52525b" },
    Submitted: { label: "Awaiting review", bg: "#dbeafe", fg: "#1e40af" },
    Approved: { label: "Approved", bg: "#dcfce7", fg: "#166534" },
    Changes: { label: "Changes requested", bg: "#ffedd5", fg: "#9a3412" },
  }[status];
}

export interface MethodMeta extends Meta {
  key: MethodKey;
  abbr: string;
  note: string;
  collectsEvidence: boolean;
}

/** Presentation metadata for one assessment method of a standard. */
export function methodMeta(standard: Standard, key: MethodKey): MethodMeta {
  const m = standard.methods[key];
  if (!m) {
    // A KSB referencing an undeclared method can't happen via the parser, but a
    // legacy `route` value read from an old index.md can reach here.
    return {
      key,
      label: key,
      abbr: key,
      note: "",
      collectsEvidence: false,
      bg: "#f4f4f5",
      fg: "#71717a",
    };
  }
  return {
    key: m.key,
    label: m.label,
    abbr: m.abbr,
    note: m.note,
    collectsEvidence: m.collectsEvidence,
    bg: m.colour.bg,
    fg: m.colour.fg,
  };
}

/** All method metadata for a KSB, in the standard's declared order. */
export function ksbMethods(standard: Standard, k: Ksb): MethodMeta[] {
  return k.methods.map((key) => methodMeta(standard, key));
}

/** Combined label for a KSB assessed by several methods, e.g. "PD + Report". */
export function methodsLabel(standard: Standard, k: Ksb): string {
  return ksbMethods(standard, k)
    .map((m) => m.abbr)
    .join(" + ");
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
    // Each fg is the darkest step that clears 4.5:1 on its own tinted bg — the
    // brighter 500-weights (#4f46e5 / #0891b2 / #9333ea) land at 3.5–4.0:1.
    Knowledge: { name: "Knowledge", letter: "K", fg: "#4338ca", bg: "#eef2ff" },
    Skill: { name: "Skills", letter: "S", fg: "#0e7490", bg: "#ecfeff" },
    Behaviour: { name: "Behaviours", letter: "B", fg: "#7e22ce", bg: "#faf5ff" },
  }[cat];
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
  const httpsRef = (url?: string) =>
    url ? "https://" + url.replace(/^https?:\/\//, "") : "";

  // ---- Front-matter (structured; serialised by js-yaml) --------------------
  // Building an object and letting `dump` handle quoting/escaping means ordinary
  // user text — titles/feedback/notes containing `---`, `:`, `#`, `>` etc. —
  // can never break the YAML. The reflection note lives here (as a block
  // scalar), not reconstructed from the Markdown body.
  const fm: Record<string, unknown> = {
    ksb: k.id,
    type: k.category,
    title: k.statement,
    // Replaces the old scalar `route`. Sub-points carry their own mapping, so
    // the per-point methods are written alongside `covered` below.
    methods: k.methods,
    status: smap[sk],
  };
  if (k.points) {
    fm.subpoints = k.points.map((p) => ({
      id: p.id,
      methods: p.methods,
      covered: evForPoint(coverageEvidence, p.id).length > 0,
    }));
  }
  fm.evidence = ev.map((e) => {
    const item: Record<string, unknown> = {
      id: e.id,
      title: e.title,
      type: e.type,
    };
    if (e.type === "upload") item.file = e.fileName ?? "";
    else if (e.type === "github") item.ref = httpsRef(e.url);
    item.maps = e.ksbIds;
    item.status = e.status.toLowerCase();
    item.date = isoDate(e.date);
    item.reviewed_by = "coach";
    if (e.type === "reflection" && e.note) item.note = e.note;
    item.feedback = e.feedback || "";
    return item;
  });
  fm.updated = isoDate(todayLabel());

  // `lineWidth: -1` keeps long titles/statements on one line (no folding).
  const frontMatter = dump(fm, { lineWidth: -1, noRefs: true });

  // ---- Body (presentation only — never parsed back) ------------------------
  const L: string[] = [];
  L.push("# " + k.id + " — " + k.short);
  L.push("");
  L.push("> " + k.statement);
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

  return "---\n" + frontMatter + "---\n\n" + L.join("\n");
}
