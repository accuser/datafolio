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
import { todayLabel } from "./domain";
import { createMockStore, type EvidenceStore } from "./data/store";
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

interface AppState {
  view: View;
  role: Role;
  signedIn: boolean;
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
  filter: "all",
  routeFilter: "all",
  selectedKsbId: null,
  form: null,
  reviewComments: {},
  openFolders: {},
  mdPreviewKid: null,
  evidence: SEED_EVIDENCE,
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
  setFileName(name: string): void;
  save(status: EvidenceStatus): void;
  approve(id: string): void;
  requestChanges(id: string): void;
  setReview(id: string, value: string): void;
  setFilter(filter: StatusFilter): void;
  setRouteFilter(routeFilter: RouteFilter): void;
  openMd(kid: string): void;
  closeMd(): void;
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

  // The data-layer seam — swap createMockStore for a GitHub-backed store later.
  const storeRef = useRef<EvidenceStore>(createMockStore(SEED_EVIDENCE));

  const actions = useMemo<AppActions>(() => {
    const store = storeRef.current;
    const patch = (p: Partial<AppState>) =>
      dispatch({ type: "PATCH", patch: p });

    return {
      signIn: () => patch({ signedIn: true, view: "dashboard" }),
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
      setFileName: (name) =>
        dispatch({ type: "SET_FORM_FIELD", key: "fileName", value: name }),

      // Adding evidence is a single commit to the KSB folder. Submit → Submitted,
      // Save draft → Draft. Both prepend the item and return to the KSB detail.
      save: async (status) => {
        const f = stateRef.current.form;
        if (!f || !f.title.trim()) return;
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
        const next = await store.addEvidence(item);
        dispatch({ type: "SET_EVIDENCE", evidence: next });
        patch({ view: "ksb", form: null });
      },

      // Coach actions patch the matching evidence item's status + feedback.
      approve: async (id) => {
        const s = stateRef.current;
        const existing = s.evidence.find((e) => e.id === id);
        const next = await store.updateEvidence(id, {
          status: "Approved",
          feedback: s.reviewComments[id] || existing?.feedback || "",
        });
        dispatch({ type: "SET_EVIDENCE", evidence: next });
      },
      requestChanges: async (id) => {
        const s = stateRef.current;
        const next = await store.updateEvidence(id, {
          status: "Changes",
          feedback: s.reviewComments[id] || "Please revise and resubmit.",
        });
        dispatch({ type: "SET_EVIDENCE", evidence: next });
      },
      setReview: (id, value) => dispatch({ type: "SET_REVIEW", id, value }),
      setFilter: (filter) => patch({ filter }),
      setRouteFilter: (routeFilter) => patch({ routeFilter }),
      openMd: (kid) => patch({ mdPreviewKid: kid }),
      closeMd: () => patch({ mdPreviewKid: null }),
    };
    // Handlers are intentionally stable; latest state is read via stateRef.
  }, []);

  const value = useMemo(
    () => ({ state, user: SEED_USER, actions }),
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
