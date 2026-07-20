"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useApp } from "@/lib/state";
import { cardsFor, genreOf } from "@/lib/cards";
import type { Card, Ksb } from "@/lib/types";
import { Plus } from "./icons";

/** Front/back editor, shared by the composer and the per-card edit form. */
function CardEditor({
  card,
  genre,
  onSave,
  onCancel,
}: {
  card?: Card;
  genre: "recall" | "rehearsal";
  onSave: (front: string, back: string) => void;
  onCancel: () => void;
}) {
  const { state } = useApp();
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const frontRef = useRef<HTMLTextAreaElement>(null);
  // Scoped ids: only one editor is open at a time today, but a fixed id would
  // silently break the label association the moment that stops being true.
  const uid = useId();

  // Opening the editor should land the caret in it — otherwise a keyboard user
  // has to hunt for the field that just appeared below their button.
  useEffect(() => {
    frontRef.current?.focus();
  }, []);

  return (
    <div className="card card--md revision-editor">
      <label className="revision-editor__label" htmlFor={`${uid}-front`}>
        Front
      </label>
      <textarea
        id={`${uid}-front`}
        ref={frontRef}
        rows={2}
        value={front}
        onChange={(e) => setFront(e.target.value)}
        placeholder={
          genre === "recall"
            ? "What do you want to be asked?"
            : "What should you be ready to talk about?"
        }
        className="input revision-editor__input"
      />
      <label className="revision-editor__label" htmlFor={`${uid}-back`}>
        Back
      </label>
      <textarea
        id={`${uid}-back`}
        rows={4}
        value={back}
        onChange={(e) => setBack(e.target.value)}
        placeholder={
          genre === "recall"
            ? "The answer, in your own words."
            : "Your worked example — the story you'd actually tell."
        }
        className="input revision-editor__input"
      />
      <div className="revision-editor__actions">
        <button
          type="button"
          onClick={() => onSave(front, back)}
          disabled={state.submitting || !front.trim()}
          className="btn btn--sm btn--primary"
        >
          {state.submitting ? "Saving…" : "Save card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={state.submitting}
          className="btn btn--sm btn--neutral"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RevisionCard({ c, genre }: { c: Card; genre: "recall" | "rehearsal" }) {
  const { state, actions } = useApp();
  const isLearner = state.role === "learner";
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Mirrors the evidence card: the confirm button takes focus so the Delete
  // button disappearing doesn't strand a keyboard user on <body>.
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmDelete) confirmRef.current?.focus();
  }, [confirmDelete]);

  if (state.editingCardId === c.id) {
    return (
      <CardEditor
        card={c}
        genre={genre}
        onSave={(front, back) => actions.updateCard(c.id, front, back)}
        onCancel={() => actions.editCard(null)}
      />
    );
  }

  return (
    <div className="card revision-card">
      <div className="revision-card__front">{c.front}</div>
      {c.back ? (
        <div className="revision-card__back">{c.back}</div>
      ) : (
        <div className="revision-card__back revision-card__back--empty">
          No answer yet — this side is yours to write.
        </div>
      )}
      <div className="revision-card__foot">
        <div className="revision-card__tags">
          {c.ksbIds.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
          <span
            className={
              c.source === "seed"
                ? "revision-card__source revision-card__source--seed"
                : "revision-card__source"
            }
          >
            {c.source === "seed" ? "Starter" : "Yours"}
          </span>
        </div>
        {isLearner && (
          <div className="revision-card__actions">
            {!confirmDelete && (
              <button
                type="button"
                onClick={() => actions.editCard(c.id)}
                disabled={state.submitting}
                className="btn btn--xs btn--neutral"
              >
                Edit
              </button>
            )}
            {confirmDelete ? (
              <>
                <span role="alert" className="confirm-prompt">
                  Delete this card?
                </span>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={() => actions.deleteCard(c.id)}
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
  );
}

/**
 * The revision-cards section, symmetric to the evidence section.
 *
 * On a knowledge-test KSB this is the only capture action on the page, so it
 * stands alone. On a professional-discussion KSB it sits below the evidence and
 * has to be told apart from it: evidence is the artefact that proves you did the
 * thing, a card is a prompt to help you talk about it. The helper text carries
 * that distinction, because the two capture buttons otherwise look alike.
 */
export function RevisionCards({ ksb }: { ksb: Ksb }) {
  const { state, actions } = useApp();
  const { cards, standard, role, cardsError, cardsLoaded } = state;
  const isLearner = role === "learner";
  const mine = cardsFor(cards, ksb.id);
  const genre = genreOf(standard, ksb.methods);
  const composing = state.composingFor === ksb.id;
  // Until the cards have actually loaded we can't claim this KSB has none, and
  // must not offer to seed a deck that may already exist unread in the repo.
  const cardsUnavailable = !!cardsError && !cardsLoaded;

  return (
    <>
      <div className="evidence-head">
        <h2 className="section-title section-title--lg">
          Revision cards{" "}
          <span className="section-title__aside">
            {mine.length ? `· ${mine.length}` : ""}
          </span>
        </h2>
        {isLearner && !cardsUnavailable && (
          <div className="revision-head__actions">
            {!mine.some((c) => c.source === "seed") && (
              <button
                type="button"
                onClick={() => actions.generateCards(ksb.id)}
                disabled={state.submitting}
                className="btn btn--neutral btn--add"
              >
                Generate starter cards
              </button>
            )}
            <button
              type="button"
              onClick={() => actions.composeCard(composing ? null : ksb.id)}
              disabled={state.submitting}
              className="btn btn--primary btn--add"
            >
              <Plus size={16} />
              Add card
            </button>
          </div>
        )}
      </div>

      {/* Built as one string rather than text-around-an-expression: JSX drops
          the leading space of a multi-line text node that follows {…}, which
          silently renders "This Knowledgeis examined". */}
      <p className="revision-intro">
        {genre === "recall"
          ? `This ${ksb.category} is examined, so cards are recall practice — definitions, comparisons, when to use which. Export them to Anki when you're ready to drill.`
          : "Evidence proves you did the work; a card is a prompt to help you talk about it fluently in the professional discussion. The back is your own worked example, not a definition."}
      </p>

      {composing && (
        <CardEditor
          genre={genre}
          onSave={(front, back) => actions.addCard(ksb.id, front, back)}
          onCancel={() => actions.composeCard(null)}
        />
      )}

      {cardsUnavailable ? (
        // Not the "no cards yet" empty state: we don't know that there are none,
        // only that we couldn't read them. Saying so keeps the learner from
        // generating a duplicate deck.
        <div role="status" className="empty-state empty-state--evidence">
          <div className="empty-state__title empty-state__title--muted">
            Couldn’t load your revision cards
          </div>
          <div className="empty-state__body empty-state__body--flush">
            Your cards are safe in your repository — this was a problem reading
            them. Reload to try again; avoid generating new cards until they’ve
            loaded, so you don’t end up with a duplicate deck.
          </div>
        </div>
      ) : mine.length === 0 && !composing ? (
        <div className="empty-state empty-state--evidence">
          <div className="empty-state__title empty-state__title--muted">
            No cards yet
          </div>
          <div className="empty-state__body empty-state__body--flush">
            {`Generate a starter set from this ${ksb.category}'s own wording, or write your own. Cards stay in your repo and export to Anki — DataFolio captures them, Anki schedules them.`}
          </div>
        </div>
      ) : (
        <div className="evidence-list">
          {mine.map((c) => (
            <RevisionCard key={c.id} c={c} genre={genre} />
          ))}
        </div>
      )}
    </>
  );
}
