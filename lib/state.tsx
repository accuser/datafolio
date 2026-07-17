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
import { rootOf, todayLabel } from "./domain";
import { createMockStore, type EvidenceStore } from "./data/store";
import { createHttpStore, fetchSession } from "./data/http-store";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "./data/uploads";
import { SEED_EVIDENCE, SEED_USER } from "./data/seed";
import type {
  Evidence,
  EvidenceForm,
  EvidenceStatus,
  Role,
  UserProfile,
  View,
} from "./types";

export type StatusFilter =
  | "all"
  | "submitted"
  | "inprogress"
  | "approved"
  | "notstarted";
export type RouteFilter = "all" | "portfolio" | "project";

/** 'github' drives the app off the backend proxy (real repos); anything else
 *  uses the in-memory mock so the UX demo runs with no configuration. */
export const BACKEND_MODE =
  process.env.NEXT_PUBLIC_DATAFOLIO_BACKEND === "github" ? "github" : "mock";

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
  view: View;
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
  routeFilter: RouteFilter;
  selectedKsbId: string | null;
  form: EvidenceForm | null;
  reviewComments: Record<string, string>;
  openFolders: Record<string, boolean>;
  mdPreviewKid: string | null;
  evidence: Evidence[];
}

const initialState: AppState = {
  view: "signin",
  role: "learner",
  signedIn: false,
  loading: false,
  error: null,
  submitting: false,
  user: SEED_USER,
  filter: "all",
  routeFilter: "all",
  selectedKsbId: null,
  form: null,
  reviewComments: {},
  openFolders: {},
  mdPreviewKid: null,
  // Mock mode is seeded so the demo renders instantly; GitHub mode loads on sign-in.
  evidence: BACKEND_MODE === "github" ? [] : SEED_EVIDENCE,
};

type Action =
  | { type: "PATCH"; patch: Partial<AppState> }
  | { type: "SET_EVIDENCE"; evidence: Evidence[] }
  | { type: "SET_FORM_FIELD"; key: keyof EvidenceForm; value: unknown }
  | { type: "ADD_TAG"; id: string }
  | { type: "REMOVE_TAG"; id: string }
  | { type: "TOGGLE_FOLDER"; kid: string }
  | { type: "SET_REVIEW"; id: string; value: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "PATCH":
      return { ...state, ...action.patch };
    case "SET_EVIDENCE":
      return { ...state, evidence: action.evidence };
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
    case "TOGGLE_FOLDER":
      return {
        ...state,
        openFolders: {
          ...state.openFolders,
          [action.kid]: !state.openFolders[action.kid],
        },
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
  goDashboard(): void;
  openRepo(): void;
  openCoverage(): void;
  setRole(role: Role): void;
  openKsb(id: string): void;
  backToKsb(): void;
  openFolderView(kid: string): void;
  toggleFolder(kid: string): void;
  openAdd(): void;
  setFormField(key: keyof EvidenceForm, value: unknown): void;
  addTag(id: string): void;
  removeTag(id: string): void;
  setFile(file: File): void;
  save(status: EvidenceStatus): void;
  openEdit(id: string): void;
  resubmit(id: string): void;
  deleteEvidence(id: string): void;
  approve(id: string): void;
  requestChanges(id: string): void;
  setReview(id: string, value: string): void;
  setFilter(filter: StatusFilter): void;
  setRouteFilter(routeFilter: RouteFilter): void;
  openMd(kid: string): void;
  closeMd(): void;
  dismissError(): void;
}

interface AppContextValue {
  state: AppState;
  user: UserProfile;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

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

  const actions = useMemo<AppActions>(() => {
    const store = storeRef.current;
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
          patch({ signedIn: true, view: "dashboard" });
        }
      },
      goDashboard: () => patch({ view: "dashboard" }),
      openRepo: () => patch({ view: "repo" }),
      openCoverage: () => patch({ view: "coverage" }),
      setRole: (role) => patch({ role }),
      openKsb: (id) => patch({ selectedKsbId: id, view: "ksb" }),
      backToKsb: () => patch({ view: "ksb" }),
      openFolderView: (kid) =>
        patch({
          view: "repo",
          openFolders: { ...stateRef.current.openFolders, [kid]: true },
        }),
      toggleFolder: (kid) => dispatch({ type: "TOGGLE_FOLDER", kid }),
      openAdd: () =>
        patch({
          view: "add",
          form: {
            type: "github",
            title: "",
            url: "",
            note: "",
            fileName: "",
            ksbIds: stateRef.current.selectedKsbId
              ? [stateRef.current.selectedKsbId]
              : [],
          },
        }),
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
        reader.readAsDataURL(file);
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
          dispatch({ type: "SET_EVIDENCE", evidence: next });
          patch({ view: "ksb", form: null });
        }),

      // Open the add screen pre-filled to edit an existing item.
      openEdit: (id) => {
        const item = stateRef.current.evidence.find((e) => e.id === id);
        if (!item) return;
        patch({
          view: "add",
          selectedKsbId:
            stateRef.current.selectedKsbId ??
            (item.ksbIds.length ? rootOf(item.ksbIds[0]) : "K1"),
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
      },

      // One-click resubmit after a coach requested changes.
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

      // Coach actions patch the matching evidence item's status + feedback.
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
      setFilter: (filter) => patch({ filter }),
      setRouteFilter: (routeFilter) => patch({ routeFilter }),
      openMd: (kid) => patch({ mdPreviewKid: kid }),
      closeMd: () => patch({ mdPreviewKid: null }),
      dismissError: () => patch({ error: null }),
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
            view: "dashboard",
            loading: true,
            role: session.role === "coach" ? "coach" : "learner",
            user: {
              name,
              login: session.user.login,
              initials: initialsOf(name),
              repo: session.target?.repo || "portfolio-evidence",
            },
          },
        });
        const evidence = await storeRef.current.load();
        if (!cancelled) dispatch({ type: "SET_EVIDENCE", evidence });
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
