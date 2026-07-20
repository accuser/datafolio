import type { EvidenceForm } from "../types";

// A single in-progress evidence form, kept in sessionStorage.
//
// Form state was memory-only, so a written reflection — the one evidence type
// where the work *is* the typing — was lost to a refresh, the browser back
// button, or a portfolio switch (which does a hard window.location.assign and so
// can't be caught by an in-app confirm at all). sessionStorage rather than
// localStorage: a draft belongs to the tab the user was typing in, and shouldn't
// resurface days later in an unrelated session.

const KEY = "datafolio:draft";

/**
 * Which form a draft belongs to, so a stale draft can't be restored into a
 * different item's edit screen.
 */
export function draftKey(ksbId: string, editId?: string): string {
  return editId ? `edit:${editId}` : `add:${ksbId}`;
}

interface StoredDraft {
  key: string;
  form: EvidenceForm;
}

/** Persist the open form. Storage failures are non-fatal — this is a safety net. */
export function saveDraft(key: string, form: EvidenceForm): void {
  try {
    // The file's bytes are deliberately not stored: a base64 upload can run to
    // megabytes and would blow the ~5MB sessionStorage quota, taking the text
    // with it. The user re-picks the file; the writing is what's irreplaceable.
    const rest = { ...form };
    delete rest.fileContentBase64;
    sessionStorage.setItem(KEY, JSON.stringify({ key, form: rest }));
  } catch {
    // Quota exceeded, or storage disabled (private browsing). Nothing to do.
  }
}

/** The stored draft for `key`, or null if there isn't one. */
export function loadDraft(key: string): EvidenceForm | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDraft;
    return stored?.key === key && stored.form ? stored.form : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // As above — losing a draft we were about to discard anyway is harmless.
  }
}
