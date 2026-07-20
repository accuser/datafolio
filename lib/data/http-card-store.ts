import type { Card } from "../types";
import type { CardStore } from "./card-store";

// Client-side CardStore that talks to the backend proxy (/api/cards). Mirrors
// http-store.ts — the server does the GitHub work, so the UI is identical in
// mock and GitHub modes.

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

export function createHttpCardStore(): CardStore {
  return {
    async load() {
      const { cards } = await api<{ cards: Card[] }>("/api/cards");
      return cards;
    },
    async addCards(cards) {
      const res = await api<{ cards: Card[] }>("/api/cards", {
        method: "POST",
        body: JSON.stringify({ cards }),
      });
      return res.cards;
    },
    async updateCard(id, patch) {
      const res = await api<{ cards: Card[] }>(
        `/api/cards/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify({ patch }) },
      );
      return res.cards;
    },
    async deleteCard(id) {
      const res = await api<{ cards: Card[] }>(
        `/api/cards/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      return res.cards;
    },
  };
}
