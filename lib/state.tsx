"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { rootOf, todayLabel } from "./domain";
import { createMockStore, type EvidenceStore } from "./data/store";
import { createMockCardStore, type CardStore } from "./data/card-store";
import { generateStarterCards } from "./cards";
import { ankiFileName, toAnkiTsv } from "./anki";
import { createHttpStore, fetchSession, selectPortfolio } from "./data/http-store";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "./data/uploads";
import { SEED_CARDS, SEED_EVIDENCE, SEED_USER } from "./data/seed";
import { DEFAULT_STANDARD_ID, getStandard, ksbIndex, type Standard } from "./standards";
import type {
  Card,
  Evidence,
  EvidenceForm,
  EvidenceStatus,
  Portfolio,
  Role,
  UserProfile,
} from "./types";

export type StatusFilter =
  | "all"
  | "submitted"
  | "inprogress"
  | "approved"
  | "notstarted";
/** "all", or an assessment-method key from the active standard. */
export type RouteFilter = string;

/** 'github' drives the app off the backend proxy (real repos); anything else
 *  uses the in-memory mock so the UX demo runs with no configuration. */
export const BACKEND_MODE =
  process.env.NEXT_PUBLIC_DATAFOLIO_BACKEND === "github" ? "github" : "mock";

/**
 * Revision cards are only offered where they can actually be persisted.
 *
 * There is no GitHub-backed CardStore yet — `revision/<KSB>/cards.md` read/write
 * is a later step — so in GitHub mode the only available implementation is the
 * in-memory mock. Rendering the capture UI on top of that would invite a learner
 * to write cards that vanish on reload, which is worse than not offering them.
 * Delete this flag once the GitHub card store lands.
 */
export const CARDS_ENABLED = BACKEND_MODE !== "github";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface AppState {
  role: Role;
  signedIn: boolean;
  /** True while evidence is being (re)loaded from the backend. */
  loading: boolean;
  /** Last user-facing error (failed commit, oversized upload, …); null if none. */
  error: string | null;
  /** True while a mutation (add / review / edit / delete) is in flight. */
  submitting: boolean;
  user: UserProfile;
  filter: StatusFilter;
  /** "all", or a method key — which assessment method to narrow the KSB list to. */
  routeFilter: RouteFilter;
  /** The occupational standard this portfolio follows. */
  standard: Standard;
  /** Set when the repo's datafolio.yml named a standard that could not be used. */
  manifestWarning: string | null;
  form: EvidenceForm | null;
  reviewComments: Record<string, string>;
  openFolders: Record<string, boolean>;
  mdPreviewKid: string | null;
  evidence: Evidence[];
  /** Revision cards across the portfolio. Empty unless CARDS_ENABLED. */
  cards: Card[];
  /** Card id currently open in the inline editor; null when none is. */
  editingCardId: string | null;
  /** KSB whose "new card" composer is open; null when none is. */
  composingFor: string | null;
  /** Portfolios the signed-in user can switch between (own + reviewed). */
  portfolios: Portfolio[];
  /** The portfolio currently in view (owner = whose repo, not necessarily me). */
  target: { owner: string; repo: string } | null;
}

const initialState: AppState = {
  role: "learner",
  signedIn: false,
  loading: false,
  error: null,
  submitting: false,
  user: SEED_USER,
  filter: "all",
  routeFilter: "all",
  standard: getStandard(DEFAULT_STANDARD_ID),
  manifestWarning: null,
  form: null,
  reviewComments: {},
  openFolders: {},
  mdPreviewKid: null,
  // Mock mode is seeded so the demo renders instantly; GitHub mode loads on sign-in.
  evidence: BACKEND_MODE === "github" ? [] : SEED_EVIDENCE,
  cards: CARDS_ENABLED ? SEED_CARDS : [],
  editingCardId: null,
  composingFor: null,
  portfolios: [],
  target: null,
};

type Action =
  | { type: "PATCH"; patch: Partial<AppState> }
  | { type: "SET_EVIDENCE"; evidence: Evidence[] }
  | { type: "SET_CARDS"; cards: Card[] }
  | { type: "SET_FORM_FIELD"; key: keyof EvidenceForm; value: unknown }
  | { type: "ADD_TAG"; id: string }
  | { type: "REMOVE_TAG"; id: string }
  | { type: "SET_FOLDER"; kid: string; open: boolean }
  | { type: "SET_REVIEW"; id: string; value: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "PATCH":
      return { ...state, ...action.patch };
    case "SET_EVIDENCE":
      return { ...state, evidence: action.evidence };
    case "SET_CARDS":
      return { ...state, cards: action.cards };
    case "SET_FORM_FIELD":
      return state.form
        ? { ...state, form: { ...state.form, [action.key]: action.value } }
        : state;
    case "ADD_TAG":
      return state.form && !state.form.ksbIds.includes(action.id)
        ? {
            ...state,
            form: { ...state.form, ksbIds: [...state.form.ksbIds, action.id] },
          }
        : state;
    case "REMOVE_TAG":
      return state.form
        ? {
            ...state,
            form: {
              ...state.form,
              ksbIds: state.form.ksbIds.filter((x) => x !== action.id),
            },
          }
        : state;
    case "SET_FOLDER":
      return {
        ...state,
        openFolders: { ...state.openFolders, [action.kid]: action.open },
      };
    case "SET_REVIEW":
      return {
        ...state,
        reviewComments: { ...state.reviewComments, [action.id]: action.value },
      };
    default:
      return state;
  }
}

export interface AppActions {
  signIn(): void;
  signOut(): void;
  /** Switch to another portfolio (own or reviewed), then reload. */
  switchPortfolio(owner: string, repo: string): void;
  setRole(role: Role): void;
  /** Expand or collapse a repository folder. Takes an explicit value because the
   *  rendered state can come from `?open=` rather than from this map. */
  setFolderOpen(kid: string, open: boolean): void;
  /** Initialise the add/edit form from the route (called by the add screen). */
  startForm(ksbId: string, editId?: string): void;
  setFormField(key: keyof EvidenceForm, value: unknown): void;
  addTag(id: string): void;
  removeTag(id: string): void;
  setFile(file: File): void;
  /** Clear the staged upload, returning the picker to its empty state. */
  clearFile(): void;
  save(status: EvidenceStatus): void;
  resubmit(id: string): void;
  deleteEvidence(id: string): void;
  approve(id: string): void;
  requestChanges(id: string): void;
  setReview(id: string, value: string): void;
  /** Generate starter cards for a KSB from the standard's own text. */
  generateCards(ksbId: string): void;
  /** Commit a hand-written card against a KSB or sub-point. */
  addCard(target: string, front: string, back: string): void;
  updateCard(id: string, front: string, back: string): void;
  deleteCard(id: string): void;
  /** Open/close the inline editor for one card (null closes it). */
  editCard(id: string | null): void;
  /** Open/close the new-card composer for a KSB (null closes it). */
  composeCard(ksbId: string | null): void;
  /** Download every revision card as one Anki-importable TSV. */
  exportDeck(): void;
  setFilter(filter: StatusFilter): void;
  setRouteFilter(routeFilter: RouteFilter): void;
  openMd(kid: string): void;
  closeMd(): void;
  dismissError(): void;
  dismissManifestWarning(): void;
}

interface AppContextValue {
  state: AppState;
  user: UserProfile;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();

  // Router snapshot so the stable action handlers can navigate without being
  // re-created; navigation is URL-driven now that views are real routes.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Always-current snapshot so the memoized (stable) action handlers can read
  // the latest state without re-creating themselves on every render. Handlers
  // only ever run after commit, so an effect-synced ref is always up to date.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Synchronous in-flight guard: set/cleared inside the same tick so a rapid
  // double-click can't fire a second commit before React re-renders. The
  // `submitting` state flag mirrors it for the UI (disabled buttons/spinners).
  const submittingRef = useRef(false);

  // The data-layer seam: GitHub-backed HTTP store, or the in-memory mock.
  const storeRef = useRef<EvidenceStore>(
    BACKEND_MODE === "github"
      ? createHttpStore()
      : createMockStore(SEED_EVIDENCE),
  );

  // Cards ride their own seam (see lib/data/card-store.ts). Only the mock
  // implementation exists today, which is what CARDS_ENABLED gates on.
  const cardStoreRef = useRef<CardStore>(createMockCardStore(SEED_CARDS));

  const actions = useMemo<AppActions>(() => {
    const store = storeRef.current;
    const cardStore = cardStoreRef.current;
    const patch = (p: Partial<AppState>) =>
      dispatch({ type: "PATCH", patch: p });

    // Run a mutation with pending state + error handling and no double-submit.
    // On failure the error is surfaced and the caller's view/form is left
    // untouched so the user can retry.
    const runExclusive = async (fn: () => Promise<void>) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      patch({ submitting: true, error: null });
      try {
        await fn();
      } catch (e) {
        patch({
          error:
            (e as Error)?.message ||
            "Something went wrong. Please try again.",
        });
      } finally {
        submittingRef.current = false;
        patch({ submitting: false });
      }
    };

    return {
      signIn: () => {
        if (BACKEND_MODE === "github") {
          // Real GitHub App user OAuth handshake.
          window.location.assign("/api/auth/login");
        } else {
          patch({ signedIn: true });
          routerRef.current.push("/");
        }
      },
      signOut: async () => {
        // Destroy the server session, then drop back to the sign-in screen. In
        // GitHub mode a full reload re-runs the session check (now signed out).
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Even if the request fails, still clear the local signed-in state.
        }
        if (BACKEND_MODE === "github") {
          window.location.assign("/");
        } else {
          patch({ signedIn: false, role: "learner", error: null, form: null });
          routerRef.current.push("/");
        }
      },
      // Point the session at another portfolio, then hard-reload so role,
      // target and evidence all re-hydrate from the server as one consistent
      // set (mirrors the sign-out reload). No-op in mock mode.
      switchPortfolio: (owner, repo) => {
        if (BACKEND_MODE !== "github") return;
        const cur = stateRef.current.target;
        if (cur && cur.owner === owner && cur.repo === repo) return;
        runExclusive(async () => {
          await selectPortfolio(owner, repo);
          window.location.assign("/");
        });
      },
      setRole: (role) => patch({ role }),
      setFolderOpen: (kid, open) => dispatch({ type: "SET_FOLDER", kid, open }),
      // Build the add/edit form for the current route; the add screen calls this
      // on mount so the form survives a refresh / deep link.
      startForm: (ksbId, editId) => {
        if (editId) {
          const item = stateRef.current.evidence.find((e) => e.id === editId);
          if (!item) return; // evidence not loaded yet — caller retries on load
          patch({
            form: {
              type: item.type,
              title: item.title,
              url: item.url ?? "",
              note: item.note ?? "",
              fileName: item.fileName ?? "",
              ksbIds: [...item.ksbIds],
              editingId: item.id,
            },
          });
        } else {
          patch({
            form: {
              type: "github",
              title: "",
              url: "",
              note: "",
              fileName: "",
              ksbIds: ksbId ? [ksbId] : [],
            },
          });
        }
      },
      setFormField: (key, value) =>
        dispatch({ type: "SET_FORM_FIELD", key, value }),
      addTag: (id) => dispatch({ type: "ADD_TAG", id }),
      removeTag: (id) => dispatch({ type: "REMOVE_TAG", id }),
      setFile: (file) => {
        // Reject oversized files before reading them (the server enforces the
        // same cap; this is just early feedback).
        if (file.size > MAX_UPLOAD_BYTES) {
          patch({ error: `“${file.name}” is too large (max ${MAX_UPLOAD_MB} MB).` });
          return;
        }
        // Read the chosen file's bytes as base64 so an upload can be committed.
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          const base64 = result.includes(",")
            ? result.slice(result.indexOf(",") + 1)
            : "";
          dispatch({ type: "SET_FORM_FIELD", key: "fileName", value: file.name });
          dispatch({ type: "SET_FORM_FIELD", key: "fileContentBase64", value: base64 });
        };
        // Without this a failed read is silent: the form keeps the old file name
        // (or none) and the user only finds out after committing.
        reader.onerror = () => {
          patch({
            error: `Couldn’t read “${file.name}”. Please choose the file again.`,
          });
        };
        reader.readAsDataURL(file);
      },
      // Drop the chosen file so the picker returns to its empty state.
      clearFile: () => {
        dispatch({ type: "SET_FORM_FIELD", key: "fileName", value: "" });
        dispatch({ type: "SET_FORM_FIELD", key: "fileContentBase64", value: undefined });
      },

      // Adding evidence is a single commit to the KSB folder. Submit → Submitted,
      // Save draft → Draft. Both prepend the item and return to the KSB detail.
      save: (status) =>
        runExclusive(async () => {
          const f = stateRef.current.form;
          if (!f || !f.title.trim()) return;
          let next: Evidence[];
          if (f.editingId) {
            // Editing / resubmitting an existing item: patch the editable fields
            // (type and any uploaded file stay as they were).
            const editPatch: Partial<Evidence> = {
              title: f.title.trim(),
              ksbIds: [...f.ksbIds],
              status,
            };
            if (f.type === "github") editPatch.url = f.url;
            if (f.type === "reflection") editPatch.note = f.note;
            next = await store.updateEvidence(f.editingId, editPatch);
          } else {
            const item: Evidence = {
              id: "e" + Date.now(),
              ksbIds: [...f.ksbIds],
              type: f.type,
              title: f.title.trim(),
              url: f.url,
              note: f.note,
              fileName: f.fileName,
              status,
              date: todayLabel(),
              feedback: "",
            };
            next = await store.addEvidence(item, {
              fileContentBase64: f.type === "upload" ? f.fileContentBase64 : undefined,
            });
          }
          const targetKsb = f.ksbIds.length ? rootOf(f.ksbIds[0]) : "K1";
          dispatch({ type: "SET_EVIDENCE", evidence: next });
          patch({ form: null });
          routerRef.current.push(`/ksb/${targetKsb}`);
        }),

      // One-click resubmit after a reviewer requested changes.
      resubmit: (id) =>
        runExclusive(async () => {
          const next = await store.updateEvidence(id, { status: "Submitted" });
          dispatch({ type: "SET_EVIDENCE", evidence: next });
        }),

      deleteEvidence: (id) =>
        runExclusive(async () => {
          const next = await store.deleteEvidence(id);
          dispatch({ type: "SET_EVIDENCE", evidence: next });
        }),

      // Reviewer actions patch the matching evidence item's status + feedback.
      approve: (id) =>
        runExclusive(async () => {
          const s = stateRef.current;
          const existing = s.evidence.find((e) => e.id === id);
          const next = await store.updateEvidence(id, {
            status: "Approved",
            feedback: s.reviewComments[id] || existing?.feedback || "",
          });
          dispatch({ type: "SET_EVIDENCE", evidence: next });
        }),
      requestChanges: (id) =>
        runExclusive(async () => {
          const s = stateRef.current;
          const next = await store.updateEvidence(id, {
            status: "Changes",
            feedback: s.reviewComments[id] || "Please revise and resubmit.",
          });
          dispatch({ type: "SET_EVIDENCE", evidence: next });
        }),
      setReview: (id, value) => dispatch({ type: "SET_REVIEW", id, value }),

      // Seeded ids are derived from what each card revises, so addCards drops
      // the ones already held — pressing this twice is a no-op, not a duplicate
      // deck. That is what lets seeding be a button rather than an auto-fill.
      generateCards: (ksbId) =>
        runExclusive(async () => {
          const s = stateRef.current;
          const ksb = ksbIndex(s.standard)[ksbId];
          if (!ksb) return;
          const next = await cardStore.addCards(
            generateStarterCards(s.standard, ksb, todayLabel()),
          );
          dispatch({ type: "SET_CARDS", cards: next });
        }),

      addCard: (target, front, back) =>
        runExclusive(async () => {
          const today = todayLabel();
          const next = await cardStore.addCards([
            {
              id: "c" + Date.now(),
              ksbIds: [target],
              front: front.trim(),
              back: back.trim(),
              tags: [stateRef.current.standard.id.toUpperCase(), rootOf(target)],
              source: "learner",
              created: today,
              updated: today,
            },
          ]);
          dispatch({ type: "SET_CARDS", cards: next });
          patch({ composingFor: null });
        }),

      updateCard: (id, front, back) =>
        runExclusive(async () => {
          const next = await cardStore.updateCard(id, {
            front: front.trim(),
            back: back.trim(),
            updated: todayLabel(),
          });
          dispatch({ type: "SET_CARDS", cards: next });
          patch({ editingCardId: null });
        }),

      deleteCard: (id) =>
        runExclusive(async () => {
          const next = await cardStore.deleteCard(id);
          dispatch({ type: "SET_CARDS", cards: next });
        }),

      editCard: (id) => patch({ editingCardId: id, composingFor: null }),
      composeCard: (ksbId) => patch({ composingFor: ksbId, editingCardId: null }),

      // Purely local: the deck is built from state already in the browser and
      // handed to the user as a download. Nothing is uploaded, and no server
      // round-trip is needed, which is what keeps this working on the edge.
      exportDeck: () => {
        const s = stateRef.current;
        const blob = new Blob([toAnkiTsv(s.standard, s.cards)], {
          // Anki sniffs the extension, not the type, but text/plain keeps the
          // browser from offering to "open" it in a viewer.
          type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = ankiFileName(s.standard);
        a.click();
        URL.revokeObjectURL(url);
      },
      setFilter: (filter) => patch({ filter }),
      setRouteFilter: (routeFilter) => patch({ routeFilter }),
      openMd: (kid) => patch({ mdPreviewKid: kid }),
      closeMd: () => patch({ mdPreviewKid: null }),
      dismissError: () => patch({ error: null }),
      dismissManifestWarning: () => patch({ manifestWarning: null }),
    };
    // Handlers are intentionally stable; latest state is read via stateRef.
  }, []);

  // GitHub mode: restore the session on mount and hydrate evidence from the repo.
  useEffect(() => {
    if (BACKEND_MODE !== "github") return;
    let cancelled = false;
    (async () => {
      try {
        const session = await fetchSession();
        if (cancelled || !session.user) return;
        const name = session.user.name || session.user.login;
        dispatch({
          type: "PATCH",
          patch: {
            signedIn: true,
            loading: true,
            role: session.role === "reviewer" ? "reviewer" : "learner",
            user: {
              name,
              login: session.user.login,
              initials: initialsOf(name),
              repo: session.target?.repo || "portfolio-evidence",
            },
            portfolios: session.portfolios ?? [],
            target: session.target ?? null,
          },
        });
        const { evidence, standardId, manifestWarning } =
          await storeRef.current.load();
        if (!cancelled) {
          dispatch({ type: "SET_EVIDENCE", evidence });
          dispatch({
            type: "PATCH",
            patch: {
              standard: getStandard(standardId),
              manifestWarning: manifestWarning ?? null,
            },
          });
        }
      } catch {
        // Session/load failed — stay on the sign-in screen.
      } finally {
        if (!cancelled) dispatch({ type: "PATCH", patch: { loading: false } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ state, user: state.user, actions }),
    [state, actions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export type { AppState };
