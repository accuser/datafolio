// Starter revision cards, generated from the standard's own text.
//
// Nobody should face a blank page, and the KSB and sub-point wording is already
// structured data, so a usable first deck is close to free. This is deliberately
// mechanical: a genre-appropriate prefix in front of the published wording, with
// the back left empty for the learner. It does not paraphrase or rewrite the
// standard — a card that quietly reworded the KSB it revises would be worse than
// no card, and the learner is the one who knows what their answer should say.

import { dump } from "js-yaml";
import { cardablePoints, isoDate, rootOf, todayLabel } from "./domain";
import { cardable, type Ksb, type MethodKey, type Standard } from "./standards";
import type { Card } from "./types";

/**
 * What a card is for, which decides its phrasing.
 *
 * `recall` is exam revision: a definition, a comparison, a when-to-use-which.
 * `rehearsal` is preparation for talking: the back is the learner's own worked
 * example, not a fact.
 */
export type CardGenre = "recall" | "rehearsal";

/**
 * Derived from the existing flags rather than by naming methods directly, so
 * this holds for any standard rather than only the ones with a method literally
 * keyed `knowledge_test`.
 *
 * A cardable method that collects no evidence is examined — there is no artefact
 * to discuss, so the card can only be recall. A cardable method that does
 * collect evidence is the professional discussion, where the learner is asked to
 * talk about the evidence they gathered, so the card rehearses that. When a
 * target is both, recall wins: the examined half is the half you can fail by
 * not knowing something.
 */
export function genreOf(standard: Standard, methods: MethodKey[]): CardGenre {
  const examined = methods.some((k) => {
    const m = standard.methods[k];
    return m?.supportsCards && !m.collectsEvidence;
  });
  return examined ? "recall" : "rehearsal";
}

/** Strip the trailing full stop so a prefix doesn't produce "Explain: X..". */
function trimEnd(text: string): string {
  return text.trim().replace(/\.$/, "");
}

/**
 * A statement ending in a colon is a stem for its sub-points ("...using:"), not
 * a claim in its own right. Turning one into a card yields a prompt that asks
 * nothing, so the sub-point cards carry that KSB instead.
 */
function isStem(statement: string): boolean {
  return statement.trim().endsWith(":");
}

/**
 * The whole statement goes on the front, however long it is.
 *
 * Several professional-discussion KSBs are multi-sentence paragraphs (K1, B1,
 * B6), so those starters are undeniably wordy for a flash card. Truncating to
 * the first sentence would read better and be worse: the learner would drill a
 * third of B1 while believing they had covered it. A prompt that is too long is
 * one the learner trims; one that is too short is one they never notice. These
 * are starters, and the front is editable.
 */
function promptFor(genre: CardGenre, text: string): string {
  return genre === "recall"
    ? `Explain: ${trimEnd(text)}.`
    : `Be ready to discuss: ${trimEnd(text)}.`;
}

/**
 * Seeded ids are derived from what the card revises, not from a counter or a
 * clock. Re-running generation therefore produces the same ids, which is what
 * lets a second "Generate starter cards" be a no-op instead of a duplicate deck.
 */
export function seedCardId(target: string): string {
  return `c-${target}`;
}

/**
 * Starter cards for one KSB: one per cardable sub-point, plus a KSB-level card
 * when the statement stands on its own. Returns [] for a non-cardable KSB.
 *
 * `today` is passed in rather than read from the clock so callers stay testable
 * and the whole function is pure.
 */
export function generateStarterCards(
  standard: Standard,
  ksb: Ksb,
  today: string,
): Card[] {
  if (!cardable(standard, ksb)) return [];

  const cards: Card[] = [];
  const card = (target: string, methods: MethodKey[], text: string): Card => ({
    id: seedCardId(target),
    ksbIds: [target],
    front: promptFor(genreOf(standard, methods), text),
    back: "",
    tags: [standard.id.toUpperCase(), ksb.id],
    source: "seed",
    created: today,
    updated: today,
  });

  if (!isStem(ksb.statement)) {
    cards.push(card(ksb.id, ksb.methods, ksb.statement));
  }
  for (const p of cardablePoints(standard, ksb)) {
    cards.push(card(p.id, p.methods, p.text));
  }
  return cards;
}

/** Starter cards for every cardable KSB in a standard, in declared order. */
export function generateAllStarterCards(
  standard: Standard,
  today: string,
): Card[] {
  return standard.ksbs.flatMap((k) => generateStarterCards(standard, k, today));
}

/** Cards revising a KSB or any of its sub-points, matched the way evidence is. */
export function cardsFor(cards: Card[], ksbId: string): Card[] {
  return cards.filter((c) => c.ksbIds.some((t) => t.split(".")[0] === ksbId));
}

// ---- revision/<KSB>/cards.md ------------------------------------------------

/** The folder a card is stored in — the root KSB of its first mapping. */
export function cardFolder(card: Card): string {
  return card.ksbIds.length ? rootOf(card.ksbIds[0]) : "";
}

/** Cards physically stored in a given KSB's folder. */
export function cardsInFolder(all: Card[], ksbId: string): Card[] {
  return all.filter((c) => cardFolder(c) === ksbId);
}

/**
 * Render one KSB's `revision/<KSB>/cards.md`.
 *
 * Mirrors `renderIndexMd`: everything the app reads lives in the front matter,
 * and the body is presentation only and never parsed back — so a card's text
 * can contain anything without corrupting the next load.
 */
export function renderCardsMd(ksb: Ksb, cards: Card[]): string {
  const fm: Record<string, unknown> = {
    ksb: ksb.id,
    type: ksb.category,
    cards: cards.map((c) => {
      const item: Record<string, unknown> = {
        id: c.id,
        maps: c.ksbIds,
        source: c.source,
        front: c.front,
        back: c.back,
      };
      if (c.tags?.length) item.tags = c.tags;
      item.created = isoDate(c.created);
      item.updated = isoDate(c.updated);
      return item;
    }),
    updated: isoDate(todayLabel()),
  };
  // `lineWidth: -1` keeps long prompts on one line rather than folding them,
  // which would otherwise make the diff of an edited card unreadable.
  const frontMatter = dump(fm, { lineWidth: -1, noRefs: true });

  const L: string[] = [];
  L.push(`# ${ksb.id} — ${ksb.short} (revision)`);
  L.push("");
  L.push(`> ${ksb.statement}`);
  L.push("");
  if (!cards.length) L.push("_No cards yet._");
  cards.forEach((c) => {
    L.push(`## ${c.front}`);
    L.push("");
    L.push(c.back || "_No answer yet._");
    L.push("");
    L.push(`— ${c.ksbIds.join(", ")} · ${c.source === "seed" ? "starter" : "own"}`);
    L.push("");
  });

  return `---\n${frontMatter}---\n\n${L.join("\n")}`;
}
