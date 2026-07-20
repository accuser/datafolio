"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BACKEND_MODE, useApp } from "@/lib/state";
import { Check, GithubMark, Lock, LogOut } from "./icons";

function navTab(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    border: "none",
    background: active ? "#eef2ff" : "transparent",
    // #71717a only clears 4.4:1 on the #f4f4f5-adjacent chrome; #52525b passes.
    color: active ? "#4f46e5" : "#52525b",
    borderRadius: 8,
    padding: "8px 13px",
    fontSize: "0.875rem",
    fontWeight: 600,
    fontFamily: "inherit",
    textDecoration: "none",
    cursor: "pointer",
  };
}

function roleTab(active: boolean): CSSProperties {
  return {
    border: "none",
    borderRadius: 7,
    padding: "7px 14px",
    fontSize: "0.8125rem",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: active ? "#18181b" : "#52525b",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,.08)" : "none",
  };
}

// A caret that points down, rotating up when the menu is open.
function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "none" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * The active-portfolio chip. In GitHub mode, when the user can reach more than
 * one portfolio (their own plus any they coach), it becomes a dropdown for
 * switching between them. Otherwise it's the static "repo · private" chip.
 */
function PortfolioChip() {
  const { state, user, actions } = useApp();
  const { portfolios, target, submitting } = state;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chipStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    background: "#f4f4f5",
    borderRadius: 8,
    fontSize: "0.8125rem",
    color: "#52525b",
    whiteSpace: "nowrap",
  };

  const currentOwner = target?.owner ?? user.login;

  // Static chip: mock mode, or only one portfolio to show.
  if (BACKEND_MODE !== "github" || portfolios.length < 2) {
    return (
      <div className="hide-sm" style={chipStyle}>
        <Lock size={13} color="currentColor" strokeWidth={2.2} />
        {user.repo} · private
      </div>
    );
  }

  return (
    <div className="hide-sm" ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={submitting}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch portfolio"
        style={{
          ...chipStyle,
          border: "none",
          fontFamily: "inherit",
          fontWeight: 600,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        <Lock size={13} color="currentColor" strokeWidth={2.2} />
        <span>{currentOwner}</span>
        <Caret open={open} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 240,
            background: "#fff",
            border: "1px solid #ececec",
            borderRadius: 10,
            boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
            padding: 6,
            zIndex: 60,
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#71717a",
              padding: "6px 8px 4px",
            }}
          >
            Portfolios
          </div>
          {portfolios.map((p) => {
            const active = p.owner === currentOwner && p.repo === (target?.repo ?? user.repo);
            return (
              <button
                key={`${p.owner}/${p.repo}`}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  actions.switchPortfolio(p.owner, p.repo);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: active ? "#eef2ff" : "transparent",
                  borderRadius: 7,
                  padding: "8px 8px",
                  fontFamily: "inherit",
                  fontSize: "0.8125rem",
                  color: "#18181b",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 16,
                    display: "flex",
                    justifyContent: "center",
                    color: "#4f46e5",
                    flexShrink: 0,
                  }}
                >
                  {active ? <Check size={14} /> : null}
                </span>
                <span style={{ flex: 1, fontWeight: 600 }}>{p.owner}</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: p.role === "learner" ? "#4f46e5" : "#71717a",
                    background: p.role === "learner" ? "#eef2ff" : "#f4f4f5",
                    borderRadius: 6,
                    padding: "2px 7px",
                    textTransform: "capitalize",
                  }}
                >
                  {p.role === "learner" ? "You" : "Coach"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { state, user, actions } = useApp();
  const { role } = state;
  const pathname = usePathname();
  const overviewActive = pathname === "/" || pathname.startsWith("/ksb");
  const repoActive = pathname.startsWith("/repository");
  const coverageActive = pathname.startsWith("/coverage");

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        rowGap: 10,
        flexWrap: "wrap",
        padding: "16px 0",
        borderBottom: "1px solid #ececec",
      }}
    >
      <Link
        href="/"
        aria-label="DataFolio home"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          cursor: "pointer",
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          color: "inherit",
          textDecoration: "none",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "#4f46e5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "0.875rem",
            color: "#fff",
          }}
        >
          D
        </span>
        <span style={{ fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "-0.01em" }}>
          DataFolio
        </span>
      </Link>

      {/* Real links, so these can be opened in a new tab, previewed on hover and
          copied from the context menu — and announced as links, with the active
          one marked by aria-current rather than by its tint alone. */}
      <nav aria-label="Main" style={{ display: "flex", gap: 2, marginLeft: 14 }}>
        <Link href="/" style={navTab(overviewActive)} aria-current={overviewActive ? "page" : undefined}>
          Overview
        </Link>
        <Link href="/repository" style={navTab(repoActive)} aria-current={repoActive ? "page" : undefined}>
          Repository
        </Link>
        <Link href="/coverage" style={navTab(coverageActive)} aria-current={coverageActive ? "page" : undefined}>
          Coverage
        </Link>
      </nav>

      <div style={{ flex: 1 }} />

      <PortfolioChip />

      {/* The role toggle is a demo affordance for mock mode. In GitHub mode the
          role is derived from real repo access (owner = learner, collaborator =
          coach) and must not be user-switchable — a learner flipping to Coach
          would otherwise see review controls (the server rejects the action, but
          the UI shouldn't offer it). */}
      {BACKEND_MODE === "github" ? (
        <div
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            background: "#f4f4f5",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#52525b",
            textTransform: "capitalize",
          }}
        >
          {role}
        </div>
      ) : (
        <div
          role="group"
          aria-label="Demo role"
          style={{
            display: "flex",
            background: "#f4f4f5",
            borderRadius: 9,
            padding: 3,
            fontSize: "0.8125rem",
            fontWeight: 500,
          }}
        >
          <button
            type="button"
            aria-pressed={role === "learner"}
            style={roleTab(role === "learner")}
            onClick={() => actions.setRole("learner")}
          >
            Learner
          </button>
          <button
            type="button"
            aria-pressed={role === "coach"}
            style={roleTab(role === "coach")}
            onClick={() => actions.setRole("coach")}
          >
            Coach
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 4 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            background: "#4f46e5",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.8125rem",
            fontWeight: 600,
          }}
        >
          {user.initials}
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: "0.75rem", color: "#71717a" }}>@{user.login}</div>
        </div>
        <button
          type="button"
          onClick={actions.signOut}
          title="Sign out"
          aria-label="Sign out"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            marginLeft: 2,
            borderRadius: 8,
            border: "1px solid #ececec",
            background: "#fff",
            color: "#71717a",
            cursor: "pointer",
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}

// re-export so screens can reference GithubMark via a single import site if wanted
export { GithubMark };
