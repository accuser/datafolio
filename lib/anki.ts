// Anki export: the whole portfolio's revision cards as one annotated TSV.
//
// Anki imports this natively — File → Import, pick the file — with no plugin,
// and the header directives pre-fill the note type and route each card to its
// own subdeck. Generating it is pure string work, so it runs anywhere the app
// already runs, including Cloudflare's edge.
//
// A true .apkg is a zipped SQLite collection. Producing one well (stable note
// ids so a re-import updates rather than duplicates) needs genanki or
// equivalent, i.e. a runtime with SQLite, which the edge does not have. That
// stays a known upgrade behind a separate non-edge function.

import { rootOf } from "./domain";
import { ksbIndex, type Standard } from "./standards";
import type { Card } from "./types";

/**
 * Anki parses header directives ONLY at the top of the file — repeating `#deck:`
 * between sections does not switch decks, it is simply read as note content. So
 * per-card decks come from a *column*, declared once up here, rather than from
 * per-section headers.
 *
 * `#deck column:` / `#tags column:` indices are 1-based, and need Anki 2.1.54+.
 * See https://docs.ankiweb.net/importing/text-files.html
 */
const HEADER = [
  "#separator:tab",
  "#html:true",
  "#notetype:Basic",
  "#deck column:3",
  "#tags column:4",
  "#columns:Front\tBack\tDeck\tTags",
];

/**
 * `#html:true` means the field is rendered as HTML, so anything the learner
 * typed that looks like markup has to be escaped or it silently disappears from
 * the card. Quotes go too: a field starting with `"` would otherwise be read as
 * the start of a quoted field by the TSV parser.
 */
function escapeField(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // A literal tab would end the field and shift every later column.
    .replace(/\t/g, " ")
    // Rows are newline-delimited, so a multi-line answer has to become markup.
    .replace(/\r\n|\r|\n/g, "<br>");
}

/**
 * `ST0585::Knowledge::K4 Analytical algorithms` — `::` is Anki's subdeck
 * separator, so this nests the whole portfolio under one collapsible deck.
 * Cards tagged against a sub-point route to their parent KSB's deck.
 */
export function deckNameFor(standard: Standard, card: Card): string {
  const ksb = ksbIndex(standard)[rootOf(card.ksbIds[0] ?? "")];
  const top = standard.id.toUpperCase();
  if (!ksb) return `${top}::Unsorted`;
  return `${top}::${ksb.category}::${ksb.id} ${deckSafe(ksb.short)}`;
}

/**
 * `short` labels are free text from the standard's config. A tab there would
 * shift every later column, and a stray `::` would silently nest an extra
 * subdeck — neither is possible in ST0585, but neither should be able to
 * corrupt the file if a future standard tries it.
 */
function deckSafe(label: string): string {
  return label.replace(/[\t\r\n]+/g, " ").replace(/::+/g, ":");
}

/**
 * Tags carry the card's own tags plus every code it revises, so a sub-point card
 * stays findable by `K4.2` as well as by `K4` — that traceability back to the
 * standard is the point of exporting tags at all. Anki splits tags on spaces, so
 * any internal space would silently become two tags.
 */
function tagsFor(card: Card): string {
  const all = [...(card.tags ?? []), ...card.ksbIds];
  return [...new Set(all.map((t) => t.trim().replace(/\s+/g, "-")))]
    .filter(Boolean)
    .join(" ");
}

/**
 * The whole portfolio as one importable file, ordered by the standard's own KSB
 * order so the decks appear in a sensible sequence rather than by card id.
 *
 * Returns just the header when there are no cards: an empty deck file is a
 * clearer outcome than an error, and Anki imports it as zero notes.
 */
export function toAnkiTsv(standard: Standard, cards: Card[]): string {
  const order = new Map(standard.ksbs.map((k, i) => [k.id, i]));
  const rank = (c: Card) => order.get(rootOf(c.ksbIds[0] ?? "")) ?? Number.MAX_SAFE_INTEGER;
  const sorted = [...cards].sort((a, b) => rank(a) - rank(b));

  const rows = sorted.map((c) =>
    [
      escapeField(c.front),
      escapeField(c.back),
      deckNameFor(standard, c),
      tagsFor(c),
    ].join("\t"),
  );
  // Trailing newline: without one, some importers drop the final row.
  return [...HEADER, ...rows].join("\n") + "\n";
}

/** e.g. "datafolio-st0585-revision.txt" — .txt because Anki's importer expects it. */
export function ankiFileName(standard: Standard): string {
  return `datafolio-${standard.id}-revision.txt`;
}
