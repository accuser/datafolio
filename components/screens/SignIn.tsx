"use client";

import { useApp } from "@/lib/state";
import { GithubMark, Lock } from "../icons";
import { STANDARDS, STANDARD_IDS, validKsbIds } from "@/lib/standards";

export function SignIn() {
  // Pre-auth: we don't know the learner's standard yet. With a single programme
  // registered, name it; with several, stay neutral rather than claim one.
  const only =
    STANDARD_IDS.length === 1 ? STANDARDS[STANDARD_IDS[0]] : null;

  const { state, actions } = useApp();
  return (
    <div className="signin-grid signin">
      {/* Left panel — hero; hidden on phones so the form is front-and-centre. */}
      <div className="hide-sm on-dark signin__hero">
        <div className="signin__brand">
          <div className="signin__brand-mark">D</div>
          <span className="signin__brand-name">DataFolio</span>
        </div>

        <div className="signin__pitch">
          <div className="signin__standard">
            {only
              ? `Level ${only.level} ${only.title} · ${only.reference}`
              : "Apprenticeship portfolio evidence"}
          </div>
          <h1 className="signin__headline">Capture your portfolio evidence, KSB by KSB.</h1>
          <p className="signin__lede">
            Map GitHub artefacts, written reflections and files against every Knowledge,
            Skill and Behaviour — right down to the sub-points — and commit them straight
            to your private repo, ready for your reviewer and EPA.
          </p>
        </div>

        <div className="signin__stats">
          <div>
            <span className="signin__stat-value">
              {only ? only.ksbs.length : STANDARD_IDS.length}
            </span>
            {only ? `KSBs · ${validKsbIds(only).size} points` : `standards supported`}
          </div>
          <div>
            <span className="signin__stat-value">3</span>
            evidence types
          </div>
          <div>
            <span className="signin__stat-value">Private</span>
            your repo, your data
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="signin__form-panel">
        <div className="signin__form">
          <h2 className="signin__title">Sign in</h2>
          {/* A failed session check is not the same as being signed out. Say
              which happened, so a user who *is* signed in doesn't conclude their
              account stopped working and try to create another one. */}
          {state.sessionError && (
            <p role="alert" className="signin__notice">
              We couldn’t check whether you’re already signed in. If you were,
              reloading may be all that’s needed.
            </p>
          )}
          <p className="signin__blurb">
            Use your GitHub account. Your evidence is stored in{" "}
            <strong>your own private repository</strong> — we never hold a copy.
          </p>
          <button type="button" onClick={actions.signIn} className="signin__submit">
            <GithubMark size={20} />
            Continue with GitHub
          </button>
          <div className="signin__scopes">
            <Lock size={16} />
            <span>
              We request only the scopes needed to read and write your evidence repo. Revoke
              access any time in GitHub settings.
            </span>
          </div>
          {/* On white, unlike the muted tone used on the dark hero panel. */}
          <p className="signin__footnote">
            New to the programme? Fork the{" "}
            <a
              href="https://github.com/accuser/datafolio-template"
              target="_blank"
              rel="noreferrer"
            >
              template repo
            </a>{" "}
            first.
          </p>
        </div>
      </div>
    </div>
  );
}
