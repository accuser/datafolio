"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useApp } from "@/lib/state";
import { KSBS } from "@/lib/ksbs";
import { rootOf, typeInfo } from "@/lib/domain";
import type { EvidenceType } from "@/lib/types";
import { mono } from "../ui";
import { ChevronLeft, UploadCloud } from "../icons";

const LABEL: CSSProperties = {
  display: "block",
  fontSize: 13.5,
  fontWeight: 600,
  color: "#3f3f46",
  marginBottom: 7,
};

const INPUT: CSSProperties = {
  width: "100%",
  border: "1px solid #e4e4e7",
  borderRadius: 9,
  padding: "11px 13px",
  fontSize: 14,
  fontFamily: "inherit",
  color: "#18181b",
};

const TYPE_CARDS: { key: EvidenceType; label: string; desc: string }[] = [
  { key: "github", label: "GitHub link", desc: "A file, commit or PR" },
  { key: "reflection", label: "Written reflection", desc: "Narrative in your words" },
  { key: "upload", label: "File upload", desc: "Notebook, PDF or image" },
];

export function AddEvidence({ ksbId, editId }: { ksbId: string; editId?: string }) {
  const { state, actions } = useApp();
  const form = state.form;

  // Build the form from the route once (per add/edit target). For an edit we
  // wait until the target item has loaded, so a deep link / refresh still works.
  const initedRef = useRef<string | null>(null);
  useEffect(() => {
    const target = editId ? `edit:${editId}` : `add:${ksbId}`;
    if (initedRef.current === target) return;
    if (editId && !state.evidence.some((e) => e.id === editId)) return;
    actions.startForm(ksbId, editId);
    initedRef.current = target;
  }, [ksbId, editId, state.evidence, actions]);

  const ready = !!form && (editId ? form.editingId === editId : !form.editingId);
  if (!ready || !form) {
    return (
      <div style={{ padding: "48px 0", color: "#a1a1aa", fontSize: 14 }}>Loading…</div>
    );
  }

  const busy = state.submitting;
  const editing = !!form.editingId;
  const canSave = !!form.title.trim() && !busy;
  const primary = form.ksbIds.length ? rootOf(form.ksbIds[0]) : ksbId || "K1";
  const commitPath =
    "evidence/" +
    primary +
    "/" +
    (form.type === "upload" ? form.fileName || "<file>" : "index.md");
  const commitNote =
    form.type === "upload"
      ? "File committed to the folder; logged in index.md."
      : form.type === "github"
        ? "Link recorded as an entry in index.md."
        : "Reflection appended to index.md.";
  const titlePlaceholder =
    form.type === "reflection"
      ? "e.g. Reflection on model validation"
      : "e.g. Feature engineering notebook";

  // Untagged KSBs and (indented) their sub-points, for the mapping <select>.
  const options: { id: string; label: string }[] = [];
  KSBS.forEach((k) => {
    if (!form.ksbIds.includes(k.id)) options.push({ id: k.id, label: `${k.id} — ${k.short}` });
    (k.points || []).forEach((p) => {
      if (!form.ksbIds.includes(p.id))
        options.push({
          id: p.id,
          label: `   ${p.id} — ${p.text.slice(0, 52)}${p.text.length > 52 ? "…" : ""}`,
        });
    });
  });

  return (
    <div style={{ padding: "26px 0 64px", maxWidth: 680 }}>
      <button
        onClick={() => actions.backToKsb(ksbId)}
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
        Back to {ksbId}
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 6px" }}>
        {editing ? "Edit evidence" : "Add evidence"}
      </h1>
      <p style={{ fontSize: 14.5, color: "#71717a", margin: "0 0 28px" }}>
        {editing
          ? "Update this item and resubmit it for review, or save it as a draft."
          : "This will be committed to your private repo and mapped to the KSBs and sub-points you tag."}
      </p>

      <label style={{ ...LABEL, marginBottom: 9 }} id="evidence-type-label">
        Evidence type
      </label>
      <div
        role="group"
        aria-labelledby="evidence-type-label"
        className="type-cards"
        style={{ display: "flex", gap: 10, marginBottom: 24 }}
      >
        {TYPE_CARDS.map((t) => {
          const ti = typeInfo(t.key);
          const on = form.type === t.key;
          // Type is fixed once created — locked while editing.
          if (editing && !on) return null;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={on}
              disabled={editing}
              onClick={() => {
                if (!editing) actions.setFormField("type", t.key);
              }}
              style={{
                textAlign: "left",
                appearance: "none",
                font: "inherit",
                color: "inherit",
                cursor: editing ? "default" : "pointer",
                flex: 1,
                border: "1.5px solid " + (on ? "#4f46e5" : "#e4e4e7"),
                background: on ? "#f5f3ff" : "#fff",
                borderRadius: 12,
                padding: "14px 15px",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: ti.bg,
                  color: ti.fg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {ti.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.4, marginTop: 3 }}>
                {t.desc}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={LABEL}>Title</label>
        <input
          value={form.title}
          onChange={(e) => actions.setFormField("title", e.target.value)}
          placeholder={titlePlaceholder}
          aria-label="Title"
          style={INPUT}
        />
      </div>

      {form.type === "github" && (
        <div style={{ marginBottom: 20 }}>
          <label style={LABEL}>GitHub URL</label>
          <input
            value={form.url}
            onChange={(e) => actions.setFormField("url", e.target.value)}
            placeholder="github.com/you/portfolio-evidence/pull/12"
            aria-label="GitHub URL"
            style={{ ...INPUT, fontFamily: mono }}
          />
          <div style={{ fontSize: 12.5, color: "#a1a1aa", marginTop: 6 }}>
            Paste a link to a file, commit or pull request in your repo.
          </div>
        </div>
      )}

      {form.type === "reflection" && (
        <div style={{ marginBottom: 20 }}>
          <label style={LABEL}>Reflection</label>
          <textarea
            value={form.note}
            onChange={(e) => actions.setFormField("note", e.target.value)}
            rows={6}
            placeholder="Describe what you did, the decisions you made, and how it demonstrates this KSB…"
            aria-label="Reflection"
            style={{ ...INPUT, lineHeight: 1.6, resize: "vertical" }}
          />
        </div>
      )}

      {form.type === "upload" && editing && (
        <div style={{ marginBottom: 20 }}>
          <label style={LABEL}>File</label>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid #e4e4e7",
              borderRadius: 10,
              padding: "11px 13px",
              fontSize: 13.5,
              fontFamily: mono,
              color: "#3f3f46",
              background: "#f4f4f5",
            }}
          >
            {form.fileName || "—"}
          </div>
          <div style={{ fontSize: 12.5, color: "#a1a1aa", marginTop: 6 }}>
            The uploaded file can&apos;t be swapped here — delete this item and add a new one to replace it.
          </div>
        </div>
      )}

      {form.type === "upload" && !editing && (
        <div style={{ marginBottom: 20 }}>
          <label style={LABEL}>File</label>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              border: "1.5px dashed #d4d4d8",
              borderRadius: 12,
              padding: 28,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <UploadCloud size={26} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#52525b" }}>
              {form.fileName || "Click to choose a file"}
            </span>
            <span style={{ fontSize: 12.5, color: "#a1a1aa" }}>
              Notebooks, PDFs, images or slides
            </span>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (f) actions.setFile(f);
              }}
              style={{ display: "none" }}
            />
          </label>
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <label style={LABEL}>Mapped KSBs &amp; sub-points</label>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
          {form.ksbIds.map((id) => (
            <span
              key={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#4f46e5",
                background: "#eef2ff",
                borderRadius: 8,
                padding: "5px 9px",
                fontFamily: mono,
              }}
            >
              {id}
              <button
                type="button"
                onClick={() => actions.removeTag(id)}
                aria-label={`Remove mapping ${id}`}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "inherit",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  opacity: 0.6,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) actions.addTag(e.target.value);
          }}
          aria-label="Map to another KSB or sub-point"
          style={{ ...INPUT, color: "#52525b", background: "#fff" }}
        >
          <option value="">＋ Also map to another KSB or sub-point…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* commit preview */}
      <div
        style={{
          background: "#0f172a",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 26,
          fontFamily: mono,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#64748b",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Will commit to
        </div>
        <div style={{ fontSize: 13, color: "#a5b4fc" }}>{commitPath}</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>{commitNote}</div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={() => actions.save("Submitted")}
          disabled={!canSave}
          style={{
            background: canSave ? "#4f46e5" : "#c7d2fe",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "11px 20px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: canSave ? "pointer" : "default",
          }}
        >
          {busy
            ? "Submitting…"
            : editing
              ? "Save & resubmit"
              : "Submit for review"}
        </button>
        <button
          onClick={() => actions.save("Draft")}
          disabled={busy}
          style={{
            background: "#fff",
            color: "#3f3f46",
            border: "1px solid #e4e4e7",
            borderRadius: 9,
            padding: "11px 18px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {editing ? "Save as draft" : "Save draft"}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => actions.backToKsb(ksbId)}
          disabled={busy}
          style={{
            background: "none",
            border: "none",
            color: "#71717a",
            fontSize: 14,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
