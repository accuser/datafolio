"use client";

import type { CSSProperties, ReactNode } from "react";
import { useApp } from "@/lib/state";
import { Header } from "./Header";
import { MdPreview } from "./MdPreview";
import { SignIn } from "./screens/SignIn";

/** Shared shape for the dismissible page-level banners. */
const BANNER: CSSProperties = {
  position: "sticky",
  top: 12,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  borderRadius: 12,
  padding: "12px 14px",
  margin: "12px 0",
  fontSize: "0.875rem",
  lineHeight: 1.5,
  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};

/** 24×24 hit area for the banner dismiss controls (WCAG 2.2 target size). */
const DISMISS: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  background: "none",
  border: "none",
  fontSize: "1rem",
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  flexShrink: 0,
};

function ErrorBanner() {
  const { state, actions } = useApp();
  if (!state.error) return null;
  return (
    <div
      role="alert"
      style={{
        ...BANNER,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
      }}
    >
      <span style={{ flex: 1 }}>{state.error}</span>
      <button
        type="button"
        onClick={actions.dismissError}
        aria-label="Dismiss error"
        style={{ ...DISMISS, color: "#991b1b" }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Shown when the repo's datafolio.yml named a standard that couldn't be used.
 * The app silently falls back to the default standard, so without this the
 * learner would see the wrong KSB list with no explanation.
 */
function ManifestWarning() {
  const { state, actions } = useApp();
  if (!state.manifestWarning) return null;
  return (
    <div
      role="status"
      style={{
        ...BANNER,
        background: "#fffbeb",
        border: "1px solid #fde68a",
        color: "#854d0e",
      }}
    >
      <span style={{ flex: 1 }}>
        <strong style={{ fontWeight: 700 }}>Check your datafolio.yml —</strong>{" "}
        {state.manifestWarning}{" "}
        Showing the default standard until it&apos;s fixed.
      </span>
      <button
        type="button"
        onClick={actions.dismissManifestWarning}
        aria-label="Dismiss warning"
        style={{ ...DISMISS, color: "#854d0e" }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * App chrome + auth gate. When signed out it shows the sign-in screen (so no
 * route leaks a signed-out user into the app); otherwise it wraps the routed
 * page in the header/nav, banners and markdown preview modal.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useApp();

  if (!state.signedIn) {
    return <SignIn />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app-container">
        <Header />
        <ErrorBanner />
        <ManifestWarning />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <MdPreview />
    </div>
  );
}
