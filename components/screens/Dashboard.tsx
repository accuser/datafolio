"use client";

import type { CSSProperties } from "react";
import { useApp, type RouteFilter, type StatusFilter } from "@/lib/state";
import {
  categoryMeta,
  evFor,
  ksbStatusKey,
  ksbMethods,
  statusMeta,
} from "@/lib/domain";
import type { Category } from "@/lib/types";
import { Pill } from "../ui";
import { ChevronRight, CheckBadge } from "../icons";
import { HoverDiv } from "../Hover";

const CARD: CSSProperties = {
  background: "#fff",
  border: "1px solid #ececec",
  borderRadius: 16,
};

function dot(bg: string): CSSProperties {
  return { width: 9, height: 9, borderRadius: 9999, background: bg, display: "inline-block" };
}

function statusChip(active: boolean): CSSProperties {
  return {
    cursor: "pointer",
    border: "1px solid " + (active ? "#4f46e5" : "#e4e4e7"),
    background: active ? "#4f46e5" : "#fff",
    color: active ? "#fff" : "#52525b",
    borderRadius: 9999,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "inherit",
  };
}

function routeChip(active: boolean): CSSProperties {
  return {
    cursor: "pointer",
    border: "1px solid " + (active ? "#3730a3" : "#e4e4e7"),
    background: active ? "#eef2ff" : "#fff",
    color: active ? "#3730a3" : "#71717a",
    borderRadius: 9999,
    padding: "7px 13px",
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: "inherit",
  };
}

export function Dashboard() {
  const { state, user, actions } = useApp();
  const { evidence, filter, routeFilter, role, standard } = state;
  const isCoach = role === "coach";
  const KSBS = standard.ksbs;

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

  const bar = (n: number, bg: string): CSSProperties => ({
    width: (n / total) * 100 + "%",
    background: bg,
    height: "100%",
  });

  const legend = [
    { label: "Approved", count: approved, color: "#22c55e" },
    { label: "Awaiting review", count: submitted, color: "#3b82f6" },
    { label: "In progress", count: inprogress, color: "#f59e0b" },
    { label: "Not started", count: notstarted, color: "#d4d4d8" },
  ];

  return (
    <div style={{ padding: "32px 0 64px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", letterSpacing: "0.03em" }}>
          {isCoach ? "Coach view" : "Your portfolio"}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "4px 0 0" }}>
          {isCoach ? "Review evidence" : `Welcome back, ${user.name.split(" ")[0]}`}
        </h1>
      </div>

      {isCoach && awaitingReview > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "#dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CheckBadge size={17} color="#1d4ed8" />
          </div>
          <div style={{ fontSize: 14, color: "#1e3a8a" }}>
            <strong>{awaitingReview} evidence item(s)</strong> awaiting your review across the
            portfolio.
          </div>
        </div>
      )}

      {/* Overall progress */}
      <div style={{ ...CARD, padding: "24px 26px", marginBottom: 26 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>Overall progress</div>
          <div style={{ fontSize: 13, color: "#71717a" }}>
            <strong style={{ color: "#18181b" }}>{approved}</strong>
            {` of ${total} KSBs evidenced & approved`}
          </div>
        </div>
        <div
          style={{
            height: 12,
            background: "#f4f4f5",
            borderRadius: 9999,
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div style={bar(approved, "#22c55e")} />
          <div style={bar(submitted, "#3b82f6")} />
          <div style={bar(inprogress, "#f59e0b")} />
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap" }}>
          {legend.map((l) => (
            <div
              key={l.label}
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#52525b" }}
            >
              <span style={dot(l.color)} />
              {l.label} <strong style={{ color: "#18181b" }}>{l.count}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Route split */}
      <div
        className="grid-2"
        style={{
          display: "grid",
          gap: 14,
          marginBottom: 28,
        }}
      >
        {Object.values(standard.methods).map((mm) => (
          <div key={mm.key} style={{ ...CARD, borderRadius: 14, padding: "16px 18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13.5,
                fontWeight: 600,
                color: mm.colour.fg,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 9999,
                  background: mm.colour.fg,
                }}
              />
              {mm.label}
            </div>
            <div style={{ fontSize: 13, color: "#71717a", marginTop: 5, lineHeight: 1.5 }}>
              {mm.note}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {statusFilters.map((f) => (
          <button key={f.key} style={statusChip(filter === f.key)} onClick={() => actions.setFilter(f.key)}>
            {f.label} <span style={{ opacity: 0.6 }}>{f.count}</span>
          </button>
        ))}
        <span style={{ width: 1, height: 22, background: "#e4e4e7", margin: "0 4px" }} />
        {routeFilters.map((r) => (
          <button
            key={r.key}
            style={routeChip(routeFilter === r.key)}
            onClick={() => actions.setRouteFilter(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KSB groups */}
      {groups.map((g) => (
        <div key={g.meta.name} style={{ marginBottom: 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 26,
                height: 26,
                borderRadius: 8,
                background: g.meta.bg,
                color: g.meta.fg,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {g.meta.letter}
            </span>
            <h2 style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>
              {g.meta.name}
            </h2>
            <span style={{ fontSize: 13, color: "#a1a1aa" }}>{g.all.length} KSBs</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.items.map((k) => {
              const sk = ksbStatusKey(evidence, k.id);
              const m = statusMeta(sk);
              const methods = ksbMethods(standard, k);
              const n = evFor(evidence, k.id).length;
              return (
                <HoverDiv
                  key={k.id}
                  onClick={() => actions.openKsb(k.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    background: "#fff",
                    border: "1px solid #ececec",
                    borderRadius: 12,
                    padding: "15px 18px",
                    cursor: "pointer",
                  }}
                  ariaLabel={`Open ${k.id}: ${k.short}`}
                  hoverStyle={{
                    border: "1px solid #c7d2fe",
                    boxShadow: "0 2px 10px rgba(79,70,229,.07)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#4f46e5",
                      background: "#eef2ff",
                      borderRadius: 7,
                      padding: "5px 9px",
                      minWidth: 38,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {k.id}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.45, color: "#3f3f46" }}>{k.statement}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                      {methods.map((m) => (
                        <Pill key={m.key} bg={m.bg} fg={m.fg}>
                          {m.label}
                        </Pill>
                      ))}
                      {k.points && (
                        <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                          {k.points.length} sub-points
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 12.5, color: "#a1a1aa", whiteSpace: "nowrap" }}>
                    {n === 0 ? "No evidence" : `${n} ${n === 1 ? "item" : "items"}`}
                  </span>
                  <Pill bg={m.bg} fg={m.fg}>
                    {m.label}
                  </Pill>
                  <ChevronRight />
                </HoverDiv>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
