"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { MAX_UPLOAD_MB } from "@/lib/data/uploads";
import { rootOf, typeInfo } from "@/lib/domain";
import type { EvidenceType } from "@/lib/types";
import { mono } from "../ui";
import { ChevronLeft, UploadCloud } from "../icons";

/** Matches the copy on the dropzone — notebooks, PDFs, images or slides. */
const ACCEPT =
  ".ipynb,.pdf,.md,.csv,.png,.jpg,.jpeg,.gif,.webp,.svg,.ppt,.pptx,.key,.doc,.docx";

const LABEL: CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "#3f3f46",
  marginBottom: 7,
};

const INPUT: CSSProperties = {
  width: "100%",
  border: "1px solid #e4e4e7",
  borderRadius: 9,
  padding: "11px 13px",
  fontSize: "0.875rem",
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
  const standard = state.standard;
  // Title is required. Rather than sit behind a disabled button with no stated
  // reason (and no way to tab onto it), the submit stays live and explains.
  const [titleError, setTitleError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

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
      <div style={{ padding: "48px 0", color: "#71717a", fontSize: "0.875rem" }}>Loading…</div>
    );
  }

  const busy = state.submitting;
  const editing = !!form.editingId;
  const primary = form.ksbIds.length ? rootOf(form.ksbIds[0]) : ksbId || "K1";

  // Validate on submit so the reason is stated, then put the cursor where the
  // fix is. Draft saves go through the same gate — a draft still needs a name.
  const submit = (status: "Submitted" | "Draft") => {
    if (!form.title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    setTitleError(false);
    actions.save(status);
  };
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
  // Only those assessed by a method that collects evidence are offerable — a
  // knowledge-test-only KSB has nothing for the learner to submit.
  const collects = (methods: string[]) =>
    methods.some((mk) => standard.methods[mk]?.collectsEvidence);

  const options: { id: string; label: string }[] = [];
  standard.ksbs.forEach((k) => {
    if (collects(k.methods) && !form.ksbIds.includes(k.id))
      options.push({ id: k.id, label: `${k.id} — ${k.short}` });
    (k.points || []).forEach((p) => {
      if (collects(p.methods) && !form.ksbIds.includes(p.id))
        options.push({
          id: p.id,
          label: `   ${p.id} — ${p.text.slice(0, 52)}${p.text.length > 52 ? "…" : ""}`,
        });
    });
  });

  return (
    <div style={{ padding: "26px 0 64px", maxWidth: 680 }}>
      <Link
        href={`/ksb/${ksbId}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          color: "#71717a",
          fontSize: "0.875rem",
          fontFamily: "inherit",
          cursor: "pointer",
          padding: "4px 2px",
          marginBottom: 18,
          textDecoration: "none",
        }}
      >
        <ChevronLeft size={15} />
        Back to {ksbId}
      </Link>

      <h1 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 6px" }}>
        {editing ? "Edit evidence" : "Add evidence"}
      </h1>
      <p style={{ fontSize: "0.9375rem", color: "#71717a", margin: "0 0 28px" }}>
        {editing
          ? "Update this item and resubmit it for review, or save it as a draft."
          : "This will be committed to your private repo and mapped to the KSBs and sub-points you tag."}
      </p>

      {/* A <label> with no control isn't a label — this names the button group. */}
      <span style={{ ...LABEL, marginBottom: 9 }} id="evidence-type-label">
        Evidence type
      </span>
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
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                }}
              >
                {ti.icon}
              </div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, marginTop: 10 }}>{t.label}</div>
              {/* #52525b, not #71717a — the selected card's violet tint drops
                  #71717a to 4.4:1. */}
              <div style={{ fontSize: "0.75rem", color: "#52525b", lineHeight: 1.4, marginTop: 3 }}>
                {t.desc}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={LABEL} htmlFor="ev-title">
          Title
        </label>
        <input
          id="ev-title"
          ref={titleRef}
          value={form.title}
          onChange={(e) => {
            actions.setFormField("title", e.target.value);
            if (titleError) setTitleError(false);
          }}
          placeholder={titlePlaceholder}
          required
          aria-invalid={titleError || undefined}
          aria-describedby={titleError ? "ev-title-error" : undefined}
          style={{
            ...INPUT,
            borderColor: titleError ? "#dc2626" : "#e4e4e7",
          }}
        />
        {titleError && (
          <div
            id="ev-title-error"
            role="alert"
            style={{ fontSize: "0.8125rem", color: "#b91c1c", marginTop: 6, fontWeight: 500 }}
          >
            Give this evidence a title before saving it.
          </div>
        )}
      </div>

      {form.type === "github" && (
        <div style={{ marginBottom: 20 }}>
          <label style={LABEL} htmlFor="ev-url">
            GitHub URL
          </label>
          <input
            id="ev-url"
            value={form.url}
            onChange={(e) => actions.setFormField("url", e.target.value)}
            placeholder="github.com/you/portfolio-evidence/pull/12"
            aria-describedby="ev-url-hint"
            style={{ ...INPUT, fontFamily: mono }}
          />
          <div id="ev-url-hint" style={{ fontSize: "0.8125rem", color: "#71717a", marginTop: 6 }}>
            Paste a link to a file, commit or pull request in your repo.
          </div>
        </div>
      )}

      {form.type === "reflection" && (
        <div style={{ marginBottom: 20 }}>
          <label style={LABEL} htmlFor="ev-note">
            Reflection
          </label>
          <textarea
            id="ev-note"
            value={form.note}
            onChange={(e) => actions.setFormField("note", e.target.value)}
            rows={6}
            placeholder="Describe what you did, the decisions you made, and how it demonstrates this KSB…"
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
              fontSize: "0.875rem",
              fontFamily: mono,
              color: "#3f3f46",
              background: "#f4f4f5",
            }}
          >
            {form.fileName || "—"}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#71717a", marginTop: 6 }}>
            The uploaded file can&apos;t be swapped here — delete this item and add a new one to replace it.
          </div>
        </div>
      )}

      {form.type === "upload" && !editing && (
        <div style={{ marginBottom: 20 }}>
          <label style={LABEL} htmlFor="ev-file">
            File
          </label>
          {/* It looks like a dropzone, so it accepts drops as well as clicks. */}
          <label
            htmlFor="ev-file"
            className="dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) actions.setFile(f);
            }}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              border: "1.5px dashed " + (dragging ? "#4f46e5" : "#d4d4d8"),
              background: dragging ? "#f5f3ff" : "transparent",
              borderRadius: 12,
              padding: 28,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <UploadCloud size={26} color={dragging ? "#4f46e5" : "#71717a"} />
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#52525b" }}>
              {form.fileName || "Drop a file here, or click to choose one"}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "#71717a" }}>
              Notebooks, PDFs, images or slides · max {MAX_UPLOAD_MB} MB
            </span>
            <input
              id="ev-file"
              type="file"
              accept={ACCEPT}
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (f) actions.setFile(f);
              }}
            />
          </label>
          {form.fileName && (
            <button
              type="button"
              onClick={actions.clearFile}
              style={{
                marginTop: 8,
                background: "none",
                border: "none",
                padding: "4px 2px",
                color: "#b91c1c",
                fontSize: "0.8125rem",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Remove {form.fileName}
            </button>
          )}
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <label style={LABEL} htmlFor="ev-map">
          Mapped KSBs &amp; sub-points
        </label>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
          {form.ksbIds.map((id) => (
            <span
              key={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#4338ca",
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
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  margin: "-4px -6px -4px 0",
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "inherit",
                  fontFamily: "inherit",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  lineHeight: 1,
                  opacity: 0.75,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <select
          id="ev-map"
          value=""
          onChange={(e) => {
            if (e.target.value) actions.addTag(e.target.value);
          }}
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
            fontSize: "0.75rem",
            color: "#94a3b8",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Will commit to
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#a5b4fc" }}>{commitPath}</div>
        <div style={{ fontSize: "0.8125rem", color: "#94a3b8", marginTop: 4 }}>{commitNote}</div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => submit("Submitted")}
          disabled={busy}
          style={{
            background: "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "11px 20px",
            fontSize: "0.875rem",
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy
            ? "Submitting…"
            : editing
              ? "Save & resubmit"
              : "Submit for review"}
        </button>
        <button
          type="button"
          onClick={() => submit("Draft")}
          disabled={busy}
          style={{
            background: "#fff",
            color: "#3f3f46",
            border: "1px solid #e4e4e7",
            borderRadius: 9,
            padding: "11px 18px",
            fontSize: "0.875rem",
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {editing ? "Save as draft" : "Save draft"}
        </button>
        <div style={{ flex: 1 }} />
        <Link
          href={`/ksb/${ksbId}`}
          style={{
            background: "none",
            border: "none",
            color: "#71717a",
            fontSize: "0.875rem",
            fontFamily: "inherit",
            padding: "4px 2px",
            textDecoration: "none",
          }}
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
