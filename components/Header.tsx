"use client";

import type { CSSProperties } from "react";
import { useApp } from "@/lib/state";
import { GithubMark, Lock } from "./icons";

function navTab(active: boolean): CSSProperties {
  return {
    border: "none",
    background: active ? "#eef2ff" : "transparent",
    color: active ? "#4f46e5" : "#71717a",
    borderRadius: 8,
    padding: "7px 13px",
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  };
}

function roleTab(active: boolean): CSSProperties {
  return {
    border: "none",
    borderRadius: 7,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: active ? "#18181b" : "#71717a",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,.08)" : "none",
  };
}

export function Header() {
  const { state, user, actions } = useApp();
  const { view, role } = state;
  const overviewActive = view === "dashboard" || view === "ksb" || view === "add";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 0",
        borderBottom: "1px solid #ececec",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}
        onClick={actions.goDashboard}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "#4f46e5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            color: "#fff",
          }}
        >
          D
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>
          DataFolio
        </span>
      </div>

      <nav style={{ display: "flex", gap: 2, marginLeft: 14 }}>
        <button style={navTab(overviewActive)} onClick={actions.goDashboard}>
          Overview
        </button>
        <button style={navTab(view === "repo")} onClick={actions.openRepo}>
          Repository
        </button>
        <button style={navTab(view === "coverage")} onClick={actions.openCoverage}>
          Coverage
        </button>
      </nav>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          background: "#f4f4f5",
          borderRadius: 8,
          fontSize: 12.5,
          color: "#52525b",
          whiteSpace: "nowrap",
        }}
      >
        <Lock size={13} color="currentColor" strokeWidth={2.2} />
        {user.repo} · private
      </div>

      <div
        style={{
          display: "flex",
          background: "#f4f4f5",
          borderRadius: 9,
          padding: 3,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <button style={roleTab(role === "learner")} onClick={() => actions.setRole("learner")}>
          Learner
        </button>
        <button style={roleTab(role === "coach")} onClick={() => actions.setRole("coach")}>
          Coach
        </button>
      </div>

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
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {user.initials}
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 11.5, color: "#a1a1aa" }}>@{user.login}</div>
        </div>
      </div>
    </header>
  );
}

// re-export so screens can reference GithubMark via a single import site if wanted
export { GithubMark };
