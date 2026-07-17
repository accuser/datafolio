"use client";

import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { BACKEND_MODE, useApp } from "@/lib/state";
import { GithubMark, Lock, LogOut } from "./icons";

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
        <button style={navTab(repoActive)} onClick={actions.openRepo}>
          Repository
        </button>
        <button style={navTab(coverageActive)} onClick={actions.openCoverage}>
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
            fontSize: 13,
            fontWeight: 600,
            color: "#52525b",
            textTransform: "capitalize",
          }}
        >
          {role}
        </div>
      ) : (
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
        <button
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
