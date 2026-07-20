import type { Evidence, UserProfile } from "../types";

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
