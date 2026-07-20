"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useApp } from "@/lib/state";
import { cardable, collectsEvidence, ksbIndex } from "@/lib/standards";
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
import { Pill } from "../ui";
import { RevisionCards } from "../RevisionCards";
import { ChevronLeft, Check, FileIcon, FolderIcon, LinkIcon, Plus } from "../icons";

function EvidenceCard({ e, ksbId }: { e: Evidence; ksbId: string }) {
  const { state, actions } = useApp();
  const isReviewer = state.role === "reviewer";
  const isLearner = state.role === "learner";
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Asking to confirm replaces the Delete button, which would otherwise drop
  // focus to <body> and strand keyboard users mid-action.
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmDelete) confirmRef.current?.focus();
  }, [confirmDelete]);
  const em = evMeta(e.status);
  const ti = typeInfo(e.type);
  const showReview = isReviewer && e.status === "Submitted";
  const httpsHref = e.url ? "https://" + e.url.replace(/^https?:\/\//, "") : "#";

  return (
    <div className="card evidence-card">
      <div className="evidence-card__inner">
        <div className={`evidence-card__icon type--${ti.tone}`}>{ti.icon}</div>
        <div className="evidence-card__body">
          <div className="evidence-card__head">
            <span className="evidence-card__title">{e.title}</span>
            <Pill tone={em.tone}>
              {em.label}
            </Pill>
          </div>
          <div className="evidence-card__meta">
            {ti.label} · {e.date}
          </div>

          {e.type === "github" && (
            <a href={httpsHref} target="_blank" rel="noreferrer" className="evidence-card__link">
              <LinkIcon size={14} />
              {e.url}
            </a>
          )}

          {e.type === "upload" && (
            <div className="evidence-card__file">
              <FileIcon size={14} color="var(--text-secondary)" />
              {e.fileName}
            </div>
          )}

          {e.type === "reflection" && e.note && (
            <p className="evidence-card__note">{e.note}</p>
          )}

          {e.feedback && (
            <div
              className={
                e.status === "Changes"
                  ? "feedback feedback--changes"
                  : "feedback feedback--approved"
              }
            >
              <div className="feedback__label">Reviewer feedback</div>
              <div className="feedback__text">{e.feedback}</div>
            </div>
          )}

          {showReview && (
            <div className="review-box">
              <textarea
                placeholder="Add feedback for the learner (optional)…"
                aria-label={`Feedback for ${e.title}`}
                rows={2}
                value={state.reviewComments[e.id] || ""}
                onChange={(ev) => actions.setReview(e.id, ev.target.value)}
                className="input review-box__input"
              />
              <div className="review-box__actions">
                <button
                  type="button"
                  onClick={() => actions.approve(e.id)}
                  disabled={state.submitting}
                  className="btn btn--sm btn--approve"
                >
                  <Check size={15} />
                  {state.submitting ? "Working…" : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => actions.requestChanges(e.id)}
                  disabled={state.submitting}
                  className="btn btn--sm btn--changes"
                >
                  Request changes
                </button>
              </div>
            </div>
          )}

          <div className="evidence-card__tags">
            {e.ksbIds.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>

          {isLearner && (
            <div className="evidence-card__actions">
              {e.status === "Changes" && (
                <button
                  type="button"
                  onClick={() => actions.resubmit(e.id)}
                  disabled={state.submitting}
                  className="btn btn--xs btn--primary"
                >
                  Resubmit
                </button>
              )}
              {!confirmDelete && (
                <Link
                  href={`/ksb/${ksbId}/add?edit=${encodeURIComponent(e.id)}`}
                  className="btn btn--xs btn--neutral"
                >
                  Edit
                </Link>
              )}
              {confirmDelete ? (
                <>
                  <span role="alert" className="confirm-prompt">
                    Delete this item?
                  </span>
                  <button
                    ref={confirmRef}
                    type="button"
                    onClick={() => actions.deleteEvidence(e.id)}
                    disabled={state.submitting}
                    className="btn btn--xs btn--danger"
                  >
                    {state.submitting ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={state.submitting}
                    className="btn btn--xs btn--neutral"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={state.submitting}
                  className="btn btn--xs btn--danger-outline"
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

export function KsbDetail({ ksbId }: { ksbId: string }) {
  const { state } = useApp();
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
  // Cards are the learner's own revision, and a reviewer never acts on them, so
  // they are not surfaced in the reviewer's app at all. They still sit in the
  // learner's repo, which a reviewer can already read — this is "not shown here",
  // not privacy. Real privacy from a line-manager reviewer would need a separate
  // location they aren't granted.
  const showCards = isLearner && cardable(standard, sel);
  // On an examined KSB there is nothing to submit, and the strip above already
  // says so — so cards take that dead space rather than sitting under an
  // "Evidence · 0 / nothing to submit" panel that repeats it.
  const showEvidence = collectsHere || !showCards;
  const pts = sel.points || [];
  const neededPts = collectingPoints(standard, sel);
  const coveredN = neededPts.filter((p) => evForPoint(evidence, p.id).length).length;
  const ev = evFor(evidence, sel.id);

  return (
    <div className="screen">
      <Link href="/" className="back-link">
        <ChevronLeft size={15} />
        All KSBs
      </Link>

      <div className="ksb-head">
        <span className="ksb-head__code">{sel.id}</span>
        <div className="ksb-head__body">
          <div className="ksb-head__badges">
            <span className="ksb-head__category">{sel.category}</span>
            {methods.map((mm) => (
              <Pill key={mm.key} bg={mm.bg} fg={mm.fg}>
                {mm.label}
              </Pill>
            ))}
            <Pill tone={m.tone}>
              {m.label}
            </Pill>
          </div>
          <h1 className="ksb-head__statement">{sel.statement}</h1>
        </div>
      </div>

      {/* route + folder strip */}
      <div className="ksb-strip">
        <div className="card card--md ksb-strip__card ksb-strip__card--grow">
          <div className="eyebrow ksb-strip__label">How it&apos;s gathered</div>
          <div className="ksb-strip__note">{methods.map((mm) => mm.note).join(" ")}</div>
        </div>
        <Link
          href={`/repository?open=${sel.id}`}
          aria-label={`Open the evidence/${sel.id} folder in the repository`}
          className="row--lift card--md ksb-strip__card ksb-strip__folder"
        >
          <div className="eyebrow ksb-strip__label">Repository folder</div>
          <div className="ksb-strip__path">
            <FolderIcon size={15} />
            evidence/{sel.id}/
          </div>
        </Link>
        {showCards && (
          <div className="card card--md ksb-strip__card ksb-strip__folder">
            <div className="eyebrow ksb-strip__label">Revision folder</div>
            <div className="ksb-strip__path">
              <FolderIcon size={15} />
              revision/{sel.id}/
            </div>
          </div>
        )}
      </div>

      {/* sub-points */}
      {pts.length > 0 && (
        <div className="ksb-subpoints">
          <h2 className="section-title">
            Sub-points{" "}
            <span className="section-title__aside">
              {neededPts.length
                ? ` — ${coveredN}/${neededPts.length} covered`
                : " — none require portfolio evidence"}
            </span>
          </h2>
          <div className="ksb-subpoints__list">
            {pts.map((p) => {
              const n = evForPoint(evidence, p.id).length;
              const cov = n > 0;
              return (
                <div key={p.id} className="card card--sm point-row">
                  <span className={cov ? "point-row__tick point-row__tick--on" : "point-row__tick"}>
                    {cov ? "✓" : ""}
                  </span>
                  <span className="point-row__code">{p.id}</span>
                  <span className="point-row__text">{p.text}</span>
                  <span className="point-row__count">
                    {n === 0 ? "—" : `${n} item${n === 1 ? "" : "s"}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* evidence */}
      {showEvidence && (
      <>
      <div className="evidence-head">
        <h2 className="section-title section-title--lg">
          Evidence <span className="section-title__aside">{ev.length ? `· ${ev.length}` : ""}</span>
        </h2>
        {isLearner && collectsHere && (
          <Link href={`/ksb/${sel.id}/add`} className="btn btn--primary btn--add">
            <Plus size={16} />
            Add evidence
          </Link>
        )}
      </div>

      {ev.length === 0 ? (
        <div className="empty-state empty-state--evidence">
          <div className="empty-state__title empty-state__title--muted">
            {collectsHere ? "No evidence yet" : "No evidence needed"}
          </div>
          <div className="empty-state__body empty-state__body--flush">
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
        <div className="evidence-list">
          {ev.map((e) => (
            <EvidenceCard key={e.id} e={e} ksbId={sel.id} />
          ))}
        </div>
      )}
      </>
      )}

      {showCards && <RevisionCards ksb={sel} />}
    </div>
  );
}
