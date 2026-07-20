"use client";

import type { ReactNode } from "react";
import { BACKEND_MODE, useApp } from "@/lib/state";
import { Header } from "./Header";
import { MdPreview } from "./MdPreview";
import { PortfolioBar } from "./PortfolioBar";
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
 * Shown when the portfolio couldn't be loaded.
 *
 * Deliberately replaces the page rather than annotating it. The screens render
 * an empty portfolio from empty state — "0 of 19 KSBs evidenced", every KSB
 * "Not started" — which a learner cannot tell apart from their evidence having
 * been wiped. Nothing about the portfolio may be drawn from a load that failed.
 */
function LoadFailed() {
  const { state, actions } = useApp();
  return (
    <div role="alert" className="load-failed">
      <h1 className="load-failed__title">Couldn’t load your portfolio</h1>
      <p className="load-failed__body">
        Your evidence is safe in your repository — this is a problem reading it,
        not a problem with your portfolio.
      </p>
      <p className="load-failed__detail">{state.loadError}</p>
      <button type="button" onClick={actions.retryLoad} className="btn btn--primary">
        Try again
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

  // Until the session check settles we don't know whether this user is signed
  // in, and guessing "signed out" painted the sign-in hero on every refresh and
  // deep link — prompting people to sign in when they already were.
  if (BACKEND_MODE === "github" && !state.sessionChecked) {
    return (
      <div className="session-check" role="status" aria-live="polite">
        <span className="session-check__spinner" aria-hidden="true" />
        Checking your session…
      </div>
    );
  }

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
        <PortfolioBar />
        <ErrorBanner />
        <ManifestWarning />
        <main id="main" tabIndex={-1}>
          {state.loadError ? <LoadFailed /> : children}
        </main>
      </div>
      <MdPreview />
    </div>
  );
}
