"use client";

import type { CSSProperties } from "react";
import { useApp } from "@/lib/state";
import { KSBS } from "@/lib/ksbs";
import { evFor, ksbStatusKey, statusMeta } from "@/lib/domain";
import { InlineCode, Pill, mono } from "../ui";
import { HoverDiv } from "../Hover";
import { FileIcon, FolderIcon, GithubMark } from "../icons";

const FILE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 18px",
  fontSize: 13,
  color: "#52525b",
  fontFamily: mono,
};

export function Repository() {
  const { state, user, actions } = useApp();
  const { evidence, openFolders } = state;

  const withEv = KSBS.filter((k) => evFor(evidence, k.id).length);

  return (
    <div style={{ padding: "28px 0 64px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 4px" }}>
        Repository
      </h1>
      <p style={{ fontSize: 14, color: "#71717a", margin: "0 0 22px" }}>
        Every evidence item is committed to a folder for its KSB. Uploaded files sit alongside an{" "}
        <InlineCode>index.md</InlineCode> that logs each entry.
      </p>

      <div style={{ border: "1px solid #ececec", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            background: "#fafafa",
            borderBottom: "1px solid #ececec",
            fontFamily: mono,
            fontSize: 12.5,
            color: "#52525b",
          }}
        >
          <GithubMark size={14} color="currentColor" />
          {user.login}/{user.repo}
        </div>

        <div style={{ padding: "6px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 18px",
              fontSize: 13.5,
              color: "#3f3f46",
            }}
          >
            <FileIcon size={15} />
            README.md <span style={{ color: "#a1a1aa" }}>— portfolio overview &amp; KSB index</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              color: "#18181b",
            }}
          >
            <FolderIcon size={16} />
            evidence/
          </div>

          {withEv.map((k) => {
            const items = evFor(evidence, k.id);
            const m = statusMeta(ksbStatusKey(evidence, k.id));
            const open = !!openFolders[k.id];
            const uploads = items.filter((e) => e.type === "upload");
            const fileCount = 1 + uploads.length;
            return (
              <div key={k.id}>
                <HoverDiv
                  onClick={() => actions.toggleFolder(k.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 18px 9px 40px",
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                  hoverStyle={{ background: "#fafafa" }}
                >
                  <svg
                    width={12}
                    height={12}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#a1a1aa"
                    strokeWidth={2.4}
                    style={{
                      transform: open ? "rotate(90deg)" : "none",
                      transition: "transform .12s",
                      flexShrink: 0,
                    }}
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                  <FolderIcon size={16} />
                  <span style={{ fontWeight: 600, color: "#18181b" }}>evidence/{k.id}/</span>
                  <Pill bg={m.bg} fg={m.fg}>
                    {m.label}
                  </Pill>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                    {fileCount} file{fileCount === 1 ? "" : "s"}
                  </span>
                </HoverDiv>

                {open && (
                  <div style={{ borderLeft: "1px solid #ececec", marginLeft: 47 }}>
                    <HoverDiv
                      onClick={() => actions.openMd(k.id)}
                      style={{ ...FILE_ROW, cursor: "pointer" }}
                      hoverStyle={{ background: "#fafafa" }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#0f766e",
                          background: "#f0fdfa",
                          borderRadius: 4,
                          padding: "2px 4px",
                        }}
                      >
                        M↓
                      </span>
                      index.md
                      <span style={{ fontFamily: "var(--font-inter)", color: "#a1a1aa", fontSize: 12 }}>
                        — {items.length} entr{items.length === 1 ? "y" : "ies"}
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: "var(--font-inter)", color: "#4f46e5", fontSize: 12 }}>
                        view →
                      </span>
                    </HoverDiv>

                    {uploads.map((u) => (
                      <div key={u.id} style={FILE_ROW}>
                        <span
                          style={{
                            fontSize: 11,
                            color: "#b45309",
                            background: "#fffbeb",
                            borderRadius: 4,
                            padding: "2px 5px",
                          }}
                        >
                          ▤
                        </span>
                        {u.fileName}
                      </div>
                    ))}

                    <div style={{ padding: "8px 18px 12px" }}>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          actions.openKsb(k.id);
                        }}
                        style={{ fontSize: 12.5 }}
                      >
                        Open evidence/{k.id} in DataFolio →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {withEv.length === 0 && (
            <div style={{ padding: "20px 40px", fontSize: 13, color: "#a1a1aa" }}>
              No evidence committed yet — add your first item from any KSB.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
