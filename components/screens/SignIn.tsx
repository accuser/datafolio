"use client";

import { useApp } from "@/lib/state";
import { GithubMark, Lock } from "../icons";
import { STANDARDS, STANDARD_IDS, validKsbIds } from "@/lib/standards";

export function SignIn() {
  // Pre-auth: we don't know the learner's standard yet. With a single programme
  // registered, name it; with several, stay neutral rather than claim one.
  const only =
    STANDARD_IDS.length === 1 ? STANDARDS[STANDARD_IDS[0]] : null;

  const { actions } = useApp();
  return (
    <div className="signin-grid" style={{ minHeight: "100vh", display: "grid" }}>
      {/* Left panel — hero; hidden on phones so the form is front-and-centre. */}
      <div
        className="hide-sm"
        style={{
          padding: "56px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#18181b",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "#4f46e5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            D
          </div>
          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>
            DataFolio
          </span>
        </div>

        <div style={{ maxWidth: 460 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#a5b4fc",
              marginBottom: 18,
            }}
          >
            {only ? `Level ${only.level} ${only.title} · ${only.reference}` : "Apprenticeship portfolio evidence"}
          </div>
          <h1
            style={{
              fontSize: 40,
              lineHeight: 1.1,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "0 0 20px",
              textWrap: "balance",
            }}
          >
            Capture your portfolio evidence, KSB by KSB.
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: "#d4d4d8",
              margin: 0,
              textWrap: "pretty",
            }}
          >
            Map GitHub artefacts, written reflections and files against every Knowledge,
            Skill and Behaviour — right down to the sub-points — and commit them straight
            to your private repo, ready for your coach and EPA.
          </p>
        </div>

        <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#a1a1aa" }}>
          <div>
            <span style={{ display: "block", fontSize: 22, fontWeight: 700, color: "#fafafa" }}>
              {only ? only.ksbs.length : STANDARD_IDS.length}
            </span>
            {only
              ? `KSBs · ${validKsbIds(only).size} points`
              : `standards supported`}
          </div>
          <div>
            <span style={{ display: "block", fontSize: 22, fontWeight: 700, color: "#fafafa" }}>
              3
            </span>
            evidence types
          </div>
          <div>
            <span style={{ display: "block", fontSize: 22, fontWeight: 700, color: "#fafafa" }}>
              Private
            </span>
            your repo, your data
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 8px" }}>
            Sign in
          </h2>
          <p style={{ fontSize: 15, color: "#71717a", margin: "0 0 28px", lineHeight: 1.5 }}>
            Use your GitHub account. Your evidence is stored in{" "}
            <strong style={{ color: "#3f3f46" }}>your own private repository</strong> — we
            never hold a copy.
          </p>
          <button
            onClick={actions.signIn}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "#18181b",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "14px 18px",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <GithubMark size={20} />
            Continue with GitHub
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 20,
              padding: "12px 14px",
              background: "#f4f4f5",
              borderRadius: 10,
              fontSize: 13,
              color: "#52525b",
              lineHeight: 1.5,
            }}
          >
            <Lock size={16} />
            <span>
              We request only the scopes needed to read and write your evidence repo. Revoke
              access any time in GitHub settings.
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#a1a1aa", margin: "24px 0 0", textAlign: "center" }}>
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
