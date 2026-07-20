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
    <div role="alert" className="banner banner--error">
      <span className="banner__text">{state.error}</span>
      <button
        type="button"
        onClick={actions.dismissError}
        aria-label="Dismiss error"
        className="icon-btn"
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
    <div role="status" className="banner banner--warn">
      <span className="banner__text">
        <strong>Check your datafolio.yml —</strong>{" "}
        {state.manifestWarning}{" "}
        Showing the default standard until it&apos;s fixed.
      </span>
      <button
        type="button"
        onClick={actions.dismissManifestWarning}
        aria-label="Dismiss warning"
        className="icon-btn"
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
    <div className="app-root">
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
