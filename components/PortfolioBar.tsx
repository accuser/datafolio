"use client";

import { useState } from "react";
import { BACKEND_MODE, useApp } from "@/lib/state";
import { Check, Lock } from "./icons";

/**
 * Which portfolio is open, on narrow screens.
 *
 * The header's portfolio chip carries `hide-sm`, so below 768px a reviewer saw
 * nothing but a "reviewer" badge — no indication of whose portfolio was open and
 * no way to change it. Approving the wrong learner's evidence from a phone was
 * a reachable outcome, and reviewing on the move is exactly what coaches do.
 *
 * This bar is the mobile counterpart to that chip: hidden at ≥768px where the
 * header already answers the question, and shown below it where nothing did.
 */
export function PortfolioBar() {
  const { state, user, actions } = useApp();
  const { portfolios, target, role, submitting } = state;
  const [open, setOpen] = useState(false);

  // Mock mode has no real portfolios to switch between.
  if (BACKEND_MODE !== "github") return null;

  const currentOwner = target?.owner ?? user.login;
  const currentRepo = target?.repo ?? user.repo;
  const canSwitch = portfolios.length > 1;

  return (
    <div className="portfolio-bar">
      <div className="portfolio-bar__current">
        <Lock size={13} color="currentColor" strokeWidth={2.2} />
        {/* Naming the role here is the point: "Reviewing lucy-ds" says whose
            work is about to be approved in a way a bare repo name does not. */}
        <span className="portfolio-bar__label">
          {role === "reviewer" ? "Reviewing" : "Portfolio"}
        </span>
        <span className="portfolio-bar__owner">{currentOwner}</span>
      </div>

      {canSwitch && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={submitting}
          aria-expanded={open}
          className="portfolio-bar__switch"
        >
          Switch
        </button>
      )}

      {open && canSwitch && (
        <ul className="portfolio-bar__list">
          {portfolios.map((p) => {
            const active = p.owner === currentOwner && p.repo === currentRepo;
            return (
              <li key={`${p.owner}/${p.repo}`}>
                <button
                  type="button"
                  aria-current={active || undefined}
                  onClick={() => {
                    setOpen(false);
                    actions.switchPortfolio(p.owner, p.repo);
                  }}
                  className="portfolio-bar__item"
                >
                  <span className="portfolio-bar__check">
                    {active ? <Check size={14} /> : null}
                  </span>
                  <span className="portfolio-bar__item-owner">{p.owner}</span>
                  <span className="portfolio-bar__item-role">
                    {p.role === "learner" ? "You" : "Reviewer"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
