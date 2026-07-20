"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BACKEND_MODE, useApp } from "@/lib/state";
import { Check, GithubMark, Lock, LogOut } from "./icons";

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
      className={open ? "caret caret--open" : "caret"}
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

  const currentOwner = target?.owner ?? user.login;

  // Static chip: mock mode, or only one portfolio to show.
  if (BACKEND_MODE !== "github" || portfolios.length < 2) {
    return (
      <div className="hide-sm chip-static">
        <Lock size={13} color="currentColor" strokeWidth={2.2} />
        {user.repo} · private
      </div>
    );
  }

  return (
    <div className="hide-sm portfolio-menu" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={submitting}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch portfolio"
        className="chip-static portfolio-menu__trigger"
      >
        <Lock size={13} color="currentColor" strokeWidth={2.2} />
        <span>{currentOwner}</span>
        <Caret open={open} />
      </button>

      {open && (
        <div role="menu" className="portfolio-menu__list">
          <div className="eyebrow portfolio-menu__heading">Portfolios</div>
          {portfolios.map((p) => {
            const active = p.owner === currentOwner && p.repo === (target?.repo ?? user.repo);
            return (
              <button
                key={`${p.owner}/${p.repo}`}
                type="button"
                role="menuitem"
                aria-current={active || undefined}
                onClick={() => {
                  setOpen(false);
                  actions.switchPortfolio(p.owner, p.repo);
                }}
                className="portfolio-menu__item"
              >
                <span className="portfolio-menu__check">
                  {active ? <Check size={14} /> : null}
                </span>
                <span className="portfolio-menu__owner">{p.owner}</span>
                <span
                  className={
                    p.role === "learner"
                      ? "portfolio-menu__role portfolio-menu__role--you"
                      : "portfolio-menu__role"
                  }
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
    <header className="site-header">
      <Link href="/" aria-label="DataFolio home" className="brand">
        <span aria-hidden="true" className="brand__mark">
          D
        </span>
        <span className="brand__name">DataFolio</span>
      </Link>

      {/* Real links, so these can be opened in a new tab, previewed on hover and
          copied from the context menu — and announced as links. The active tint
          is driven off aria-current, so the styling can't disagree with what a
          screen reader is told. */}
      <nav aria-label="Main" className="site-nav">
        <Link href="/" className="nav-tab" aria-current={overviewActive ? "page" : undefined}>
          Overview
        </Link>
        <Link
          href="/repository"
          className="nav-tab"
          aria-current={repoActive ? "page" : undefined}
        >
          Repository
        </Link>
        <Link
          href="/coverage"
          className="nav-tab"
          aria-current={coverageActive ? "page" : undefined}
        >
          Coverage
        </Link>
      </nav>

      <div className="row__spacer" />

      <PortfolioChip />

      {/* The role toggle is a demo affordance for mock mode. In GitHub mode the
          role is derived from real repo access (owner = learner, collaborator =
          coach) and must not be user-switchable — a learner flipping to Coach
          would otherwise see review controls (the server rejects the action, but
          the UI shouldn't offer it). */}
      {BACKEND_MODE === "github" ? (
        <div className="role-badge">{role}</div>
      ) : (
        <div role="group" aria-label="Demo role" className="role-toggle">
          <button
            type="button"
            aria-pressed={role === "learner"}
            className="role-tab"
            onClick={() => actions.setRole("learner")}
          >
            Learner
          </button>
          <button
            type="button"
            aria-pressed={role === "coach"}
            className="role-tab"
            onClick={() => actions.setRole("coach")}
          >
            Coach
          </button>
        </div>
      )}

      <div className="identity">
        <div className="identity__avatar">{user.initials}</div>
        <div className="identity__text">
          <div className="identity__name">{user.name}</div>
          <div className="identity__login">@{user.login}</div>
        </div>
        <button
          type="button"
          onClick={actions.signOut}
          title="Sign out"
          aria-label="Sign out"
          className="identity__signout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}

// re-export so screens can reference GithubMark via a single import site if wanted
export { GithubMark };
