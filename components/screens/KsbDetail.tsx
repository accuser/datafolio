"use client";

import { useState, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import { useApp } from "@/lib/state";
import { collectsEvidence, ksbIndex } from "@/lib/standards";
import {
  collectingPoints,
  evFor,
  evForPoint,
  evMeta,
  ksbStatusKey,
  ksbMethods,
  statusMeta,
  typeInfo,
} from "@/lib/domain";
import type { Evidence } from "@/lib/types";
import { Pill, mono } from "../ui";
import { HoverDiv } from "../Hover";
import { ChevronLeft, Check, FileIcon, FolderIcon, LinkIcon, Plus } from "../icons";

const CARD: CSSProperties = {
  background: "#fff",
  border: "1px solid #ececec",
};

function EvidenceCard({ e, ksbId }: { e: Evidence; ksbId: string }) {
  const { state, actions } = useApp();
  const isCoach = state.role === "coach";
  const isLearner = state.role === "learner";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const em = evMeta(e.status);
  const ti = typeInfo(e.type);
  const showReview = isCoach && e.status === "Submitted";
  const httpsHref = e.url ? "https://" + e.url.replace(/^https?:\/\//, "") : "#";

  return (
    <div style={{ ...CARD, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: ti.bg,
            color: ti.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {ti.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 3,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{e.title}</span>
            <Pill bg={em.bg} fg={em.fg}>
              {em.label}
            </Pill>
          </div>
          <div style={{ fontSize: 12.5, color: "#a1a1aa", fontFamily: mono }}>
            {ti.label} · {e.date}
          </div>

          {e.type === "github" && (
            <a
              href={httpsHref}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                marginTop: 9,
                wordBreak: "break-all",
              }}
            >
              <LinkIcon size={14} />
              {e.url}
            </a>
          )}

          {e.type === "upload" && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                marginTop: 9,
                background: "#f4f4f5",
                borderRadius: 8,
                padding: "7px 11px",
                color: "#3f3f46",
                fontFamily: mono,
              }}
            >
              <FileIcon size={14} color="#3f3f46" />
              {e.fileName}
            </div>
          )}

          {e.type === "reflection" && e.note && (
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "#52525b",
                margin: "10px 0 0",
                whiteSpace: "pre-wrap",
              }}
            >
              {e.note}
            </p>
          )}

          {e.feedback && (
            <div
              style={{
                marginTop: 12,
                padding: "11px 13px",
                borderRadius: 10,
                background: e.status === "Changes" ? "#fff7ed" : "#f0fdf4",
                color: e.status === "Changes" ? "#9a3412" : "#166534",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                  opacity: 0.75,
                }}
              >
                Coach feedback
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{e.feedback}</div>
            </div>
          )}

          {showReview && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #ececec" }}>
              <textarea
                placeholder="Add feedback for the learner (optional)…"
                aria-label={`Feedback for ${e.title}`}
                rows={2}
                value={state.reviewComments[e.id] || ""}
                onChange={(ev) => actions.setReview(e.id, ev.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #e4e4e7",
                  borderRadius: 9,
                  padding: "10px 12px",
                  fontSize: 13.5,
                  fontFamily: "inherit",
                  resize: "vertical",
                  color: "#18181b",
                }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  onClick={() => actions.approve(e.id)}
                  disabled={state.submitting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#16a34a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 15px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: state.submitting ? "default" : "pointer",
                    opacity: state.submitting ? 0.6 : 1,
                  }}
                >
                  <Check size={15} />
                  {state.submitting ? "Working…" : "Approve"}
                </button>
                <button
                  onClick={() => actions.requestChanges(e.id)}
                  disabled={state.submitting}
                  style={{
                    background: "#fff",
                    color: "#b45309",
                    border: "1px solid #fcd34d",
                    borderRadius: 8,
                    padding: "9px 15px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: state.submitting ? "default" : "pointer",
                    opacity: state.submitting ? 0.6 : 1,
                  }}
                >
                  Request changes
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {e.ksbIds.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "#6366f1",
                  background: "#eef2ff",
                  borderRadius: 6,
                  padding: "3px 8px",
                  fontFamily: mono,
                }}
              >
                {t}
              </span>
            ))}
          </div>

          {isLearner && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px dashed #ececec",
              }}
            >
              {e.status === "Changes" && (
                <button
                  onClick={() => actions.resubmit(e.id)}
                  disabled={state.submitting}
                  style={cardActionStyle("#4f46e5", "#fff", state.submitting)}
                >
                  Resubmit
                </button>
              )}
              {!confirmDelete && (
                <button
                  onClick={() => actions.openEdit(ksbId, e.id)}
                  disabled={state.submitting}
                  style={cardActionStyle("#fff", "#3f3f46", state.submitting, "#e4e4e7")}
                >
                  Edit
                </button>
              )}
              {confirmDelete ? (
                <>
                  <span style={{ alignSelf: "center", fontSize: 13, color: "#71717a" }}>
                    Delete this item?
                  </span>
                  <button
                    onClick={() => actions.deleteEvidence(e.id)}
                    disabled={state.submitting}
                    style={cardActionStyle("#dc2626", "#fff", state.submitting)}
                  >
                    {state.submitting ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={state.submitting}
                    style={cardActionStyle("#fff", "#3f3f46", state.submitting, "#e4e4e7")}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={state.submitting}
                  style={cardActionStyle("#fff", "#b91c1c", state.submitting, "#fecaca")}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Small button used for the learner's per-item Edit / Resubmit / Delete row. */
function cardActionStyle(
  bg: string,
  fg: string,
  disabled: boolean,
  border?: string,
): CSSProperties {
  return {
    background: bg,
    color: fg,
    border: border ? `1px solid ${border}` : "none",
    borderRadius: 8,
    padding: "7px 13px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

export function KsbDetail({ ksbId }: { ksbId: string }) {
  const { state, actions } = useApp();
  const { evidence, role, standard } = state;
  // An id that isn't in this portfolio's standard is a 404, not K1. Falling back
  // to the first KSB would silently mask a bad link or a mis-mapped standard.
  const sel = ksbIndex(standard)[ksbId];
  const isLearner = role === "learner";

  // Wait for the standard to arrive before deciding: on first paint state holds
  // the default standard, so a valid code from another standard would 404.
  if (!sel) {
    if (state.loading) return null;
    notFound();
  }

  const sk = ksbStatusKey(evidence, sel.id);
  const m = statusMeta(sk);
  const methods = ksbMethods(standard, sel);
  // A KSB assessed only by methods that collect no evidence (the knowledge test)
  // has nothing for the learner to submit, so don't offer to add any.
  const collectsHere = collectsEvidence(standard, sel);
  const pts = sel.points || [];
  const neededPts = collectingPoints(standard, sel);
  const coveredN = neededPts.filter((p) => evForPoint(evidence, p.id).length).length;
  const ev = evFor(evidence, sel.id);

  return (
    <div style={{ padding: "26px 0 64px" }}>
      <button
        onClick={actions.goDashboard}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "#71717a",
          fontSize: 13.5,
          fontFamily: "inherit",
          cursor: "pointer",
          padding: 0,
          marginBottom: 22,
        }}
      >
        <ChevronLeft size={15} />
        All KSBs
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 18 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#4f46e5",
            background: "#eef2ff",
            borderRadius: 10,
            padding: "9px 13px",
            flexShrink: 0,
          }}
        >
          {sel.id}
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "#a1a1aa",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {sel.category}
            </span>
            {methods.map((mm) => (
              <Pill key={mm.key} bg={mm.bg} fg={mm.fg}>
                {mm.label}
              </Pill>
            ))}
            <Pill bg={m.bg} fg={m.fg}>
              {m.label}
            </Pill>
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              margin: 0,
              textWrap: "pretty",
            }}
          >
            {sel.statement}
          </h1>
        </div>
      </div>

      {/* route + folder strip */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div
          style={{
            flex: 1,
            minWidth: 260,
            ...CARD,
            borderRadius: 12,
            padding: "13px 16px",
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              color: "#a1a1aa",
              marginBottom: 4,
            }}
          >
            How it&apos;s gathered
          </div>
          <div style={{ fontSize: 13.5, color: "#3f3f46", lineHeight: 1.5 }}>{methods.map((mm) => mm.note).join(" ")}</div>
        </div>
        <HoverDiv
          onClick={() => actions.openFolderView(sel.id)}
          ariaLabel={`Open the evidence/${sel.id} folder in the repository`}
          style={{
            minWidth: 260,
            ...CARD,
            borderRadius: 12,
            padding: "13px 16px",
            cursor: "pointer",
          }}
          hoverStyle={{ border: "1px solid #c7d2fe" }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              color: "#a1a1aa",
              marginBottom: 5,
            }}
          >
            Repository folder
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: mono,
              fontSize: 13,
              color: "#4f46e5",
            }}
          >
            <FolderIcon size={15} />
            evidence/{sel.id}/
          </div>
        </HoverDiv>
      </div>

      {/* sub-points */}
      {pts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>
            Sub-points{" "}
            <span style={{ color: "#a1a1aa", fontWeight: 500 }}>
              {neededPts.length
                ? ` — ${coveredN}/${neededPts.length} covered`
                : " — none require portfolio evidence"}
            </span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pts.map((p) => {
              const n = evForPoint(evidence, p.id).length;
              const cov = n > 0;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    ...CARD,
                    borderRadius: 11,
                    padding: "12px 15px",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 9999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                      background: cov ? "#dcfce7" : "#f4f4f5",
                      color: cov ? "#166534" : "#d4d4d8",
                      border: cov ? "none" : "1.5px solid #e4e4e7",
                    }}
                  >
                    {cov ? "✓" : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#4f46e5",
                      fontFamily: mono,
                      minWidth: 42,
                    }}
                  >
                    {p.id}
                  </span>
                  <span style={{ flex: 1, fontSize: 13.5, color: "#3f3f46", lineHeight: 1.45 }}>
                    {p.text}
                  </span>
                  <span style={{ fontSize: 12, color: "#a1a1aa", whiteSpace: "nowrap" }}>
                    {n === 0 ? "—" : `${n} item${n === 1 ? "" : "s"}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* evidence */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          margin: "30px 0 16px",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          Evidence{" "}
          <span style={{ color: "#a1a1aa", fontWeight: 500 }}>{ev.length ? `· ${ev.length}` : ""}</span>
        </h2>
        {isLearner && collectsHere && (
          <button
            onClick={() => actions.openAdd(sel.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
            Add evidence
          </button>
        )}
      </div>

      {ev.length === 0 ? (
        <div
          style={{
            border: "1.5px dashed #e4e4e7",
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
            color: "#a1a1aa",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "#71717a", marginBottom: 4 }}>
            {collectsHere ? "No evidence yet" : "No evidence needed"}
          </div>
          <div style={{ fontSize: 13.5 }}>
            {collectsHere ? (
              <>
                Link a GitHub artefact, write a reflection, or upload a file to start evidencing
                this {sel.category}.
              </>
            ) : (
              <>
                This {sel.category} is assessed by{" "}
                {methods.map((mm) => mm.label.toLowerCase()).join(" and ")} rather than through
                your portfolio, so there is nothing to submit here.
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ev.map((e) => (
            <EvidenceCard key={e.id} e={e} ksbId={sel.id} />
          ))}
        </div>
      )}
    </div>
  );
}
