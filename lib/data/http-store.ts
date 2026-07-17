import type { Evidence } from "../types";
import type { EvidenceStore } from "./store";

// Client-side EvidenceStore that talks to the backend proxy (/api/evidence).
// The server does the actual GitHub Contents/Git-Data work; the UI stays
// identical to mock mode.

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface SessionInfo {
  configured: boolean;
  user: { login: string; name: string; avatarUrl: string } | null;
  target?: { owner: string; repo: string };
  role?: "learner" | "coach" | "unknown";
}

export function createHttpStore(): EvidenceStore {
  return {
    async load() {
      const { evidence } = await api<{ evidence: Evidence[] }>("/api/evidence");
      return evidence;
    },
    async addEvidence(item) {
      const { evidence } = await api<{ evidence: Evidence[] }>("/api/evidence", {
        method: "POST",
        body: JSON.stringify({ item }),
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
  };
}

export function fetchSession(): Promise<SessionInfo> {
  return api<SessionInfo>("/api/session");
}
