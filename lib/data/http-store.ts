import type { Evidence, Portfolio } from "../types";
import type { EvidenceStore } from "./store";
import { fetchJson as api } from "./fetch-json";

// Client-side EvidenceStore that talks to the backend proxy (/api/evidence).
// The server does the actual GitHub Contents/Git-Data work; the UI stays
// identical to mock mode.

export interface SessionInfo {
  configured: boolean;
  user: { login: string; name: string; avatarUrl: string } | null;
  target?: { owner: string; repo: string };
  role?: "learner" | "reviewer" | "unknown";
  portfolios?: Portfolio[];
}

export function createHttpStore(): EvidenceStore {
  return {
    async load() {
      const { evidence, standardId, manifestWarning } = await api<{
        evidence: Evidence[];
        standardId: string;
        manifestWarning?: string;
      }>("/api/evidence");
      return { evidence, standardId, ...(manifestWarning ? { manifestWarning } : {}) };
    },
    async addEvidence(item, opts) {
      const { evidence } = await api<{ evidence: Evidence[] }>("/api/evidence", {
        method: "POST",
        body: JSON.stringify({ item, fileContentBase64: opts?.fileContentBase64 }),
      });
      return evidence;
    },
    async updateEvidence(id, patch) {
      const { evidence } = await api<{ evidence: Evidence[] }>(
        `/api/evidence/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify({ patch }) },
      );
      return evidence;
    },
    async deleteEvidence(id) {
      const { evidence } = await api<{ evidence: Evidence[] }>(
        `/api/evidence/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      return evidence;
    },
  };
}

export function fetchSession(): Promise<SessionInfo> {
  return api<SessionInfo>("/api/session");
}

/** Switch the active portfolio server-side. Caller reloads to re-hydrate. */
export function selectPortfolio(owner: string, repo: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>("/api/portfolios/select", {
    method: "POST",
    body: JSON.stringify({ owner, repo }),
  });
}
