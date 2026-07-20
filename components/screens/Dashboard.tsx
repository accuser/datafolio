"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useApp, type RouteFilter, type StatusFilter } from "@/lib/state";
import {
  categoryMeta,
  evFor,
  evForPoint,
  ksbStatusKey,
  ksbMethods,
  methodMeta,
  pointStatusKey,
  statusMeta,
} from "@/lib/domain";
import type { Category } from "@/lib/types";
import { LoadingState, Pill } from "../ui";
import { ChevronRight, CheckBadge } from "../icons";

export function Dashboard() {
  const { state, user, actions } = useApp();
  const { cards, evidence, filter, routeFilter, role, standard, loading } = state;
  const isReviewer = role === "reviewer";
  // Export is a whole-portfolio action, so it lives here rather than on any one
  // KSB. Learner-only, and hidden until there is actually a deck to export.
  const showExport = !isReviewer && cards.length > 0;
  const KSBS = standard.ksbs;
  // Which KSBs have their sub-points expanded. Sub-points are assessed
  // individually and don't inherit the parent's methods, so a collapsed row's
  // badges alone can misrepresent what the learner actually has to evidence.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const keys = KSBS.map((k) => ksbStatusKey(evidence, k.id));
  const total = KSBS.length;
  const count = (t: string) => keys.filter((x) => x === t).length;
  const approved = count("approved");
  const submitted = count("submitted");
  const inprogress = count("inprogress");
  const notstarted = count("notstarted");
  const awaitingReview = evidence.filter((e) => e.status === "Submitted").length;

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    { key: "submitted", label: "Awaiting review", count: submitted },
    { key: "inprogress", label: "In progress", count: inprogress },
    { key: "approved", label: "Approved", count: approved },
    { key: "notstarted", label: "Not started", count: notstarted },
  ];
  // One chip per assessment method the standard declares, so a standard with a
  // different set of methods gets the right filters with no code change.
  const routeFilters: { key: RouteFilter; label: string }[] = [
    { key: "all", label: "All methods" },
    ...Object.values(standard.methods).map((m) => ({
      key: m.key,
      label: m.label,
    })),
  ];

  const matchRoute = (methods: string[]) =>
    routeFilter === "all" || methods.includes(routeFilter);

  const filtering = filter !== "all" || routeFilter !== "all";
  const cats: Category[] = ["Knowledge", "Skill", "Behaviour"];
  const groups = cats
    .map((cat) => {
      const meta = categoryMeta(cat);
      const all = KSBS.filter((k) => k.category === cat);
      let items = all.filter((k) => matchRoute(k.methods));
      if (filter !== "all") items = items.filter((k) => ksbStatusKey(evidence, k.id) === filter);
      return { meta, all, items };
    })
    .filter((g) => g.items.length > 0);

  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  // Segment widths are data, so they stay inline; the colours are tokens.
  const bar = (n: number, token: string): CSSProperties => ({
    width: (n / total) * 100 + "%",
    background: `var(${token})`,
    height: "100%",
  });

  const legend = [
    { label: "Approved", count: approved, token: "--seg-approved" },
    { label: "Awaiting review", count: submitted, token: "--seg-submitted" },
    { label: "In progress", count: inprogress, token: "--seg-inprogress" },
    { label: "Not started", count: notstarted, token: "--seg-notstarted" },
  ];

  if (loading) return <LoadingState label="Loading your portfolio…" />;

  return (
    <div className="screen screen--dashboard">
      <div className="page-head">
        <div className="page-head__eyebrow">
          {isReviewer ? "Reviewer view" : "Your portfolio"}
        </div>
        <h1 className="page-head__title">
          {isReviewer ? "Review evidence" : `Welcome back, ${user.name.split(" ")[0]}`}
        </h1>
      </div>

      {isReviewer && awaitingReview > 0 && (
        <div className="review-callout">
          <div className="review-callout__icon">
            <CheckBadge size={17} color="var(--info-icon)" />
          </div>
          <div className="review-callout__text">
            <strong>{awaitingReview} evidence item(s)</strong> awaiting your review across the
            portfolio.
          </div>
        </div>
      )}

      {showExport && (
        <div className="revision-callout">
          <div className="revision-callout__text">
            <strong>
              {cards.length} revision card{cards.length === 1 ? "" : "s"}
            </strong>{" "}
            across your portfolio. Export them as one Anki deck — in Anki, choose
            File → Import and pick the downloaded file.
          </div>
          <button
            type="button"
            onClick={actions.exportDeck}
            className="btn btn--sm btn--neutral revision-callout__btn"
          >
            Export revision deck
          </button>
        </div>
      )}

      {/* Overall progress */}
      <div className="card card--xl progress-card">
        <div className="progress-card__head">
          <div className="progress-card__title">Overall progress</div>
          <div className="progress-card__count">
            <strong>{approved}</strong>
            {` of ${total} KSBs evidenced & approved`}
          </div>
        </div>
        <div className="progress-bar">
          <div style={bar(approved, "--seg-approved")} />
          <div style={bar(submitted, "--seg-submitted")} />
          <div style={bar(inprogress, "--seg-inprogress")} />
        </div>
        <div className="progress-legend">
          {legend.map((l) => (
            <div key={l.label} className="progress-legend__item">
              <span
                className="progress-legend__dot"
                style={{ background: `var(${l.token})` }}
              />
              {l.label} <strong>{l.count}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Route split */}
      <div className="grid-2 method-cards">
        {Object.values(standard.methods).map((mm) => (
          <div key={mm.key} className="card method-card">
            {/* Method colours come from the standard's own config, so they're
                injected as a custom property rather than hard-coded here. */}
            <div
              className="method-card__title"
              style={{ "--method-fg": mm.colour.fg } as CSSProperties}
            >
              <span className="method-card__dot" />
              {mm.label}
            </div>
            <div className="method-card__note">{mm.note}</div>
          </div>
        ))}
      </div>

      {/* Filters. Two named groups, not one flat row: the status set and the
          method set both start with an "All" chip, and without a boundary a
          screen reader user can't tell "All" from "All methods" out of context. */}
      <div className="filter-bar">
        <div role="group" aria-label="Filter by status" className="filter-bar__set">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              className="chip"
              onClick={() => actions.setFilter(f.key)}
            >
              {f.label} <span className="chip__count">{f.count}</span>
            </button>
          ))}
        </div>
        <span aria-hidden="true" className="filter-bar__divider" />
        <div role="group" aria-label="Filter by assessment method" className="filter-bar__set">
          {routeFilters.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={routeFilter === r.key}
              className="chip chip--method"
              onClick={() => actions.setRouteFilter(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtering swaps the list out with no visual transition, so announce the
          new result count for anyone not watching the page. */}
      <p aria-live="polite" className="sr-only">
        {filtering
          ? `${shown} of ${total} KSBs match the current filters.`
          : `Showing all ${total} KSBs.`}
      </p>

      {/* Every group can filter down to nothing; without this the page would end
          at the chips with no explanation and read as broken. */}
      {!loading && groups.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__title">No KSBs match these filters</div>
          <div className="empty-state__body">
            Nothing is both{" "}
            <strong>{statusFilters.find((f) => f.key === filter)?.label.toLowerCase()}</strong>{" "}
            and assessed by{" "}
            <strong>{routeFilters.find((r) => r.key === routeFilter)?.label.toLowerCase()}</strong>
            .
          </div>
          <button
            type="button"
            className="btn btn--primary btn--compact"
            onClick={() => {
              actions.setFilter("all");
              actions.setRouteFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.meta.name} className="ksb-group">
          <div className="ksb-group__head">
            <span className={`ksb-group__letter cat--${g.meta.tone}`}>
              {g.meta.letter}
            </span>
            <h2 className="ksb-group__name">{g.meta.name}</h2>
            {/* Under a filter the group shows a subset, so count what's on
                screen — "8 KSBs" above a single row reads as a bug. */}
            <span className="ksb-group__count">
              {filtering
                ? `${g.items.length} of ${g.all.length} KSBs`
                : `${g.all.length} KSBs`}
            </span>
          </div>

          <div className="ksb-list">
            {g.items.map((k) => {
              const sk = ksbStatusKey(evidence, k.id);
              const m = statusMeta(sk);
              const methods = ksbMethods(standard, k);
              const n = evFor(evidence, k.id).length;
              return (
                <div key={k.id}>
                  <Link
                    href={`/ksb/${k.id}`}
                    aria-label={`Open ${k.id}: ${k.short}`}
                    className="row row--lift row--lift-shadow ksb-row"
                  >
                    <span className="ksb-row__code">{k.id}</span>
                    <div className="ksb-row__body">
                      <div className="ksb-row__statement">{k.statement}</div>
                      <div className="ksb-row__meta">
                        {methods.map((m) => (
                          <Pill key={m.key} bg={m.bg} fg={m.fg}>
                            {m.label}
                          </Pill>
                        ))}
                        {k.points && (
                          <span className="ksb-row__subcount">
                            {k.points.length} sub-points
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="ksb-row__count">
                      {n === 0 ? "No evidence" : `${n} ${n === 1 ? "item" : "items"}`}
                    </span>
                    <Pill tone={m.tone}>
                      {m.label}
                    </Pill>
                    <ChevronRight />
                  </Link>
                  {k.points && (
                    <button
                      type="button"
                      aria-expanded={!!expanded[k.id]}
                      aria-controls={`subpoints-${k.id}`}
                      onClick={() => setExpanded((x) => ({ ...x, [k.id]: !x[k.id] }))}
                      className="subpoint-toggle"
                    >
                      <span aria-hidden className="subpoint-toggle__caret">
                        ›
                      </span>
                      {expanded[k.id] ? "Hide" : "Show"} {k.points.length} sub-points
                    </button>
                  )}
                  {k.points && expanded[k.id] && (
                    <div id={`subpoints-${k.id}`} className="subpoint-list">
                      {k.points.map((p) => {
                        const pMethods = p.methods.map((mk) => methodMeta(standard, mk));
                        const collects = pMethods.some((mm) => mm.collectsEvidence);
                        const pn = evForPoint(evidence, p.id).length;
                        const psm = statusMeta(pointStatusKey(evidence, p.id));
                        return (
                          <div key={p.id} className="subpoint-item">
                            <span className="subpoint-item__code">{p.id}</span>
                            <span className="subpoint-item__text">{p.text}</span>
                            {pMethods.map((mm) => (
                              <Pill key={mm.key} bg={mm.bg} fg={mm.fg}>
                                {mm.abbr}
                              </Pill>
                            ))}
                            {/* A sub-point assessed only by examination is never the
                                learner's to evidence — don't show it as "Not started". */}
                            {collects ? (
                              <>
                                <span className="subpoint-item__count">
                                  {pn === 0 ? "—" : `${pn} ${pn === 1 ? "item" : "items"}`}
                                </span>
                                <Pill tone={psm.tone}>
                                  {psm.label}
                                </Pill>
                              </>
                            ) : (
                              <span className="subpoint-item__none">No evidence needed</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
