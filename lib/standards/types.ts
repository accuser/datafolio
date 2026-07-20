// Types for an occupational standard loaded from `standards/*.yaml`.
//
// These replace the hardcoded ST0585 KSB list that used to live in lib/ksbs.ts.
// A standard is inert reference data: statements, sub-points, and the mapping of
// each to the EPA assessment methods that assess it.

export type Category = "Knowledge" | "Skill" | "Behaviour";

/** Key into `Standard.methods`, e.g. "professional_discussion". */
export type MethodKey = string;

export interface Colour {
  bg: string;
  fg: string;
}

/**
 * An EPA assessment method, as named by the standard's assessment plan.
 *
 * `collectsEvidence` is DataFolio's own switch, not part of the standard: it
 * marks whether learners gather portfolio evidence against KSBs assessed this
 * way. Knowledge-test KSBs are still modelled in full so the mapping stays
 * faithful, but are surfaced read-only until the method is turned on.
 *
 * `supportsCards` is a sibling switch, deliberately orthogonal: "is this KSB
 * worth making revision cards for?" is a different question from "does it
 * expect portfolio artefacts?", and the two only happen to overlap. The
 * knowledge test collects no evidence but is the method cards matter most for.
 */
export interface AssessmentMethod {
  key: MethodKey;
  label: string;
  abbr: string;
  note: string;
  collectsEvidence: boolean;
  supportsCards: boolean;
  colour: Colour;
}

export interface SubPoint {
  id: string;
  text: string;
  /** Sub-points carry their own mapping — they do not inherit the parent's. */
  methods: MethodKey[];
}

export interface Ksb {
  id: string;
  category: Category;
  /** DataFolio's short label for tables and headers. Not part of the standard. */
  short: string;
  /** The standard's statement, verbatim. */
  statement: string;
  methods: MethodKey[];
  points?: SubPoint[];
}

export interface Standard {
  id: string;
  /** e.g. "ST0585/AP01". */
  reference: string;
  title: string;
  level: number;
  /** ISO date the assessment plan was published. */
  published: string;
  methods: Record<MethodKey, AssessmentMethod>;
  ksbs: Ksb[];
}
