"use client";

import { useApp } from "@/lib/state";
import { Header } from "./Header";
import { MdPreview } from "./MdPreview";
import { SignIn } from "./screens/SignIn";
import { Dashboard } from "./screens/Dashboard";
import { KsbDetail } from "./screens/KsbDetail";
import { AddEvidence } from "./screens/AddEvidence";
import { Repository } from "./screens/Repository";
import { Coverage } from "./screens/Coverage";

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

export function DataFolioApp() {
  const { state } = useApp();

  if (!state.signedIn || state.view === "signin") {
    return <SignIn />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px" }}>
        <Header />
        <ErrorBanner />
        {state.view === "dashboard" && <Dashboard />}
        {state.view === "ksb" && <KsbDetail />}
        {state.view === "add" && <AddEvidence />}
        {state.view === "repo" && <Repository />}
        {state.view === "coverage" && <Coverage />}
      </div>
      <MdPreview />
    </div>
  );
}
