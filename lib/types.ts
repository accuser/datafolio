// Domain types for DataFolio. These mirror the repository contract
// (evidence/<KSB>/index.md front-matter) so the mock data layer can later be
// swapped for a GitHub-backed one without touching the UI.

export type Role = "learner" | "coach";

export type View = "signin" | "dashboard" | "ksb" | "add" | "repo" | "coverage";

export type Category = "Knowledge" | "Skill" | "Behaviour";

export type RouteKey = "portfolio" | "project" | "both";

export type EvidenceType = "github" | "reflection" | "upload";

/** Per-item status, as stored in front-matter `evidence[].status`. */
export type EvidenceStatus = "Draft" | "Submitted" | "Approved" | "Changes";

/** Derived KSB roll-up status (never stored twice — computed from evidence). */
export type KsbStatusKey = "notstarted" | "inprogress" | "submitted" | "approved";

export interface SubPoint {
  id: string;
  text: string;
}

export interface Ksb {
  id: string;
  cat: Category;
  route: RouteKey;
  /** The standard's full statement. */
  title: string;
  /** Short human-readable name for tables and headers. */
  short: string;
  /** Only K3, K4, K5 carry sub-points. */
  points?: SubPoint[];
}

export interface Evidence {
  id: string;
  /** KSB codes / sub-point ids this item evidences, e.g. ["S4", "K4.2"]. */
  ksbIds: string[];
  type: EvidenceType;
  title: string;
  /** github/reflection external ref. */
  url?: string;
  /** upload filename committed to the folder. */
  fileName?: string;
  /** reflection narrative. */
  note?: string;
  status: EvidenceStatus;
  /** Display date, e.g. "12 Jun 2026". */
  date: string;
  feedback: string;
}

/** The add/edit-evidence draft form. */
export interface EvidenceForm {
  type: EvidenceType;
  title: string;
  url: string;
  note: string;
  fileName: string;
  /** base64 bytes of the chosen upload file (upload type only). */
  fileContentBase64?: string;
  ksbIds: string[];
  /** Set when editing an existing item; absent when adding a new one. */
  editingId?: string;
}

export interface UserProfile {
  name: string;
  repo: string;
  login: string;
  initials: string;
}

/**
 * A portfolio repo the signed-in user can reach — either their own (`learner`)
 * or one they're a collaborator on (`coach`). Enumerated at sign-in from the
 * repos where the App is installed and the user has access, so a coach can
 * switch between the learners they mentor without hand-typing logins.
 */
export interface Portfolio {
  owner: string;
  repo: string;
  role: Role;
}
