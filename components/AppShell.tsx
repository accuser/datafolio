"use client";

import type { ReactNode } from "react";
import { useApp } from "@/lib/state";
import { Header } from "./Header";
import { MdPreview } from "./MdPreview";
import { SignIn } from "./screens/SignIn";

function ErrorBanner() {
  const { state, actions } = useApp();
  if (!state.error) return null;
  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 12,
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        color: "#991b1b",
        borderRadius: 12,
        padding: "12px 14px",
        margin: "12px 0",
        fontSize: 13.5,
        lineHeight: 1.5,
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{ flex: 1 }}>{state.error}</span>
      <button
        onClick={actions.dismissError}
        aria-label="Dismiss error"
        style={{
          background: "none",
          border: "none",
          color: "#991b1b",
          fontSize: 16,
          lineHeight: 1,
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * App chrome + auth gate. When signed out it shows the sign-in screen (so no
 * route leaks a signed-out user into the app); otherwise it wraps the routed
 * page in the header/nav, error banner and markdown preview modal.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useApp();

  if (!state.signedIn) {
    return <SignIn />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <div className="app-container">
        <Header />
        <ErrorBanner />
        <main>{children}</main>
      </div>
      <MdPreview />
    </div>
  );
}
