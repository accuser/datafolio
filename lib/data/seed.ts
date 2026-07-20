import type { Card, Evidence, UserProfile } from "../types";

// Derived the same way the prototype derives them from the signed-in learner.
export const SEED_USER: UserProfile = {
  name: "Lucy Bennett",
  repo: "portfolio-evidence",
  login: "lucy-ds",
  initials: "LB",
};

// Seed evidence — stands in for what a GitHub-backed data layer would read from
// evidence/*/index.md front-matter across the learner's private repo.
export const SEED_EVIDENCE: Evidence[] = [
  {
    id: "e1",
    ksbIds: ["S3", "K3.3"],
    type: "github",
    title: "Reproducible ETL pipeline (PR #42)",
    url: "github.com/lucy-ds/portfolio-evidence/pull/42",
    note: "",
    status: "Approved",
    date: "12 Jun 2026",
    feedback: "Excellent use of version control and peer code review.",
  },
  {
    id: "e2",
    ksbIds: ["S4", "K5.3"],
    type: "github",
    title: "Customer churn model with statistical validation",
    url: "github.com/lucy-ds/portfolio-evidence/blob/main/models/churn.ipynb",
    note: "",
    status: "Submitted",
    date: "2 Jul 2026",
    feedback: "",
  },
  {
    id: "e3",
    ksbIds: ["K2", "B5"],
    type: "reflection",
    title: "Reflection: GDPR and bias in the churn dataset",
    note: "Before modelling I audited the dataset for protected characteristics and documented how postcode acted as a proxy for demographics. I removed it and recorded the trade-off in accuracy, applying Privacy by Design throughout.",
    status: "Submitted",
    date: "5 Jul 2026",
    feedback: "",
  },
  {
    id: "e4",
    ksbIds: ["S6"],
    type: "upload",
    title: "Q2 stakeholder insights deck",
    fileName: "q2-insights-deck.pdf",
    note: "",
    status: "Approved",
    date: "20 May 2026",
    feedback:
      "Clear, compelling storytelling pitched well for a non-technical audience.",
  },
  {
    id: "e5",
    ksbIds: ["S1"],
    type: "reflection",
    title: "Framing retention as a Data Science problem",
    note: "",
    status: "Draft",
    date: "9 Jul 2026",
    feedback: "",
  },
  {
    id: "e6",
    ksbIds: ["B2"],
    type: "github",
    title: "Collaboration & code-review reflection",
    url: "github.com/lucy-ds/portfolio-evidence/blob/main/reflections/collaboration.md",
    note: "",
    status: "Changes",
    date: "28 Jun 2026",
    feedback:
      "Good start — add specific examples of feedback you received and how you acted on it.",
  },
];

// Seed revision cards — what a GitHub-backed card store would read from
// revision/*/cards.md. Small on purpose: starter cards are generated on demand
// (see lib/cards.ts), so a learner's real deck starts empty until they ask for
// one. These exist so mock mode shows both sources and both genres.
export const SEED_CARDS: Card[] = [
  {
    id: "c-K4.2",
    ksbIds: ["K4.2"],
    front:
      "Explain: Supervised, unsupervised and reinforcement learning, and the classes of problem each suits.",
    back: "",
    tags: ["ST0585", "K4"],
    source: "seed",
    created: "2 Jul 2026",
    updated: "2 Jul 2026",
  },
  {
    id: "c-learner-1",
    ksbIds: ["K4.2"],
    front: "Name three supervised algorithms and when you'd pick each.",
    back: "Logistic regression — small, linearly separable, need interpretability.\nRandom forest — mixed feature types, non-linear, little tuning budget.\nGradient boosting — tabular, accuracy matters more than training cost.",
    tags: ["ST0585", "K4"],
    source: "learner",
    created: "5 Jul 2026",
    updated: "9 Jul 2026",
  },
  {
    id: "c-B1",
    ksbIds: ["B1"],
    front:
      "Be ready to discuss: Initiative and resourcefulness when solving problems.",
    back: "The churn pipeline stalled on a schema change nobody had flagged — walk through spotting it in the failed run, patching the loader, and adding the contract test that would have caught it.",
    tags: ["ST0585", "B1"],
    source: "learner",
    created: "11 Jul 2026",
    updated: "11 Jul 2026",
  },
];
