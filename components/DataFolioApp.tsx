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

export function DataFolioApp() {
  const { state } = useApp();

  if (!state.signedIn || state.view === "signin") {
    return <SignIn />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px" }}>
        <Header />
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
