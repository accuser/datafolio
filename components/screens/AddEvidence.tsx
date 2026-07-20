"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import { MAX_UPLOAD_MB } from "@/lib/data/uploads";
import { rootOf, typeInfo } from "@/lib/domain";
import type { EvidenceType } from "@/lib/types";
import { ChevronLeft, UploadCloud } from "../icons";

/** Matches the copy on the dropzone — notebooks, PDFs, images or slides. */
const ACCEPT =
  ".ipynb,.pdf,.md,.csv,.png,.jpg,.jpeg,.gif,.webp,.svg,.ppt,.pptx,.key,.doc,.docx";

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
      <div className="form-loading">Loading…</div>
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
    <div className="screen screen--narrow">
      <Link href={`/ksb/${ksbId}`} className="back-link">
        <ChevronLeft size={15} />
        Back to {ksbId}
      </Link>

      <h1 className="screen-title screen-title--form">
        {editing ? "Edit evidence" : "Add evidence"}
      </h1>
      <p className="form-intro">
        {editing
          ? "Update this item and resubmit it for review, or save it as a draft."
          : "This will be committed to your private repo and mapped to the KSBs and sub-points you tag."}
      </p>

      {/* A <label> with no control isn't a label — this names the button group. */}
      <span className="label label--group" id="evidence-type-label">
        Evidence type
      </span>
      <div
        role="group"
        aria-labelledby="evidence-type-label"
        className="type-cards"
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
              className="type-card"
            >
              <div
                aria-hidden="true"
                className="type-card__icon"
                style={{ "--type-bg": ti.bg, "--type-fg": ti.fg } as CSSProperties}
              >
                {ti.icon}
              </div>
              <div className="type-card__label">{t.label}</div>
              <div className="type-card__desc">{t.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="field">
        <label className="label" htmlFor="ev-title">
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
          className="input"
        />
        {titleError && (
          <div
            id="ev-title-error"
            role="alert"
            className="field-error"
          >
            Give this evidence a title before saving it.
          </div>
        )}
      </div>

      {form.type === "github" && (
        <div className="field">
          <label className="label" htmlFor="ev-url">
            GitHub URL
          </label>
          <input
            id="ev-url"
            value={form.url}
            onChange={(e) => actions.setFormField("url", e.target.value)}
            placeholder="github.com/you/portfolio-evidence/pull/12"
            aria-describedby="ev-url-hint"
            className="input input--mono"
          />
          <div id="ev-url-hint" className="field-hint">
            Paste a link to a file, commit or pull request in your repo.
          </div>
        </div>
      )}

      {form.type === "reflection" && (
        <div className="field">
          <label className="label" htmlFor="ev-note">
            Reflection
          </label>
          <textarea
            id="ev-note"
            value={form.note}
            onChange={(e) => actions.setFormField("note", e.target.value)}
            rows={6}
            placeholder="Describe what you did, the decisions you made, and how it demonstrates this KSB…"
            className="input input--textarea"
          />
        </div>
      )}

      {form.type === "upload" && editing && (
        <div className="field">
          <label className="label">File</label>
          <div className="file-locked">
            {form.fileName || "—"}
          </div>
          <div className="field-hint">
            The uploaded file can&apos;t be swapped here — delete this item and add a new one to replace it.
          </div>
        </div>
      )}

      {form.type === "upload" && !editing && (
        <div className="field">
          <label className="label" htmlFor="ev-file">
            File
          </label>
          {/* It looks like a dropzone, so it accepts drops as well as clicks. */}
          <label
            htmlFor="ev-file"
            className={dragging ? "dropzone dropzone--active" : "dropzone"}
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
          >
            <UploadCloud size={26} color={dragging ? "var(--accent)" : "var(--text-muted)"} />
            <span className="dropzone__primary">
              {form.fileName || "Drop a file here, or click to choose one"}
            </span>
            <span className="dropzone__hint">
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
              className="file-clear"
            >
              Remove {form.fileName}
            </button>
          )}
        </div>
      )}

      <div className="field field--map">
        <label className="label" htmlFor="ev-map">
          Mapped KSBs &amp; sub-points
        </label>
        <div className="map-tags">
          {form.ksbIds.map((id) => (
            <span
              key={id}
              className="map-tag"
            >
              {id}
              <button
                type="button"
                onClick={() => actions.removeTag(id)}
                aria-label={`Remove mapping ${id}`}
                className="icon-btn map-tag__remove"
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
          className="input input--select"
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
      <div className="on-dark commit-preview">
        <div className="commit-preview__label">Will commit to</div>
        <div className="commit-preview__path">{commitPath}</div>
        <div className="commit-preview__note">{commitNote}</div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          onClick={() => submit("Submitted")}
          disabled={busy}
          className="btn btn--primary"
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
          className="btn btn--secondary"
        >
          {editing ? "Save as draft" : "Save draft"}
        </button>
        <div className="row__spacer" />
        <Link href={`/ksb/${ksbId}`} className="btn--ghost form-actions__cancel">
          Cancel
        </Link>
      </div>
    </div>
  );
}
