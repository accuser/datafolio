// Parse a DataFolio `revision/<KSB>/cards.md` back into the domain model — the
// inverse of `renderCardsMd` in lib/cards.ts.
//
// As with evidence, only the front matter is read: the Markdown body is
// presentation, so anything a learner types into a card can't corrupt a load.

import { load } from "js-yaml";
import { asIsoString, isoToDisplayDate, splitFrontMatter } from "./frontmatter";
import type { Card } from "../types";

export interface ParsedCardFolder {
  ksb: string;
  cards: Card[];
  updated: string;
}

interface RawCard {
  id?: unknown;
  maps?: unknown;
  source?: unknown;
  front?: unknown;
  back?: unknown;
  tags?: unknown;
  created?: unknown;
  updated?: unknown;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

/** Parse a `revision/<KSB>/cards.md` string into the domain model. */
export function parseCardsMd(md: string): ParsedCardFolder {
  const { frontMatter } = splitFrontMatter(md, "parseCardsMd");
  const fm = (load(frontMatter) ?? {}) as {
    ksb?: unknown;
    cards?: unknown;
    updated?: unknown;
  };

  const raw: RawCard[] = Array.isArray(fm.cards) ? (fm.cards as RawCard[]) : [];
  const cards: Card[] = raw
    // A card with no id can't be edited or deleted by id, and one with no
    // mapping has no folder to live in — both mean a hand-edited file, so drop
    // them rather than loading a card the app can't act on.
    .filter((c) => c.id != null && strList(c.maps).length > 0)
    .map((c) => {
      // js-yaml turns a bare `2026-07-20` into a Date, so normalise before
      // formatting rather than stringifying a Date object.
      const created = isoToDisplayDate(asIsoString(c.created));
      return {
        id: String(c.id),
        ksbIds: strList(c.maps),
        front: String(c.front ?? ""),
        back: c.back == null ? "" : String(c.back),
        // Anything not explicitly "seed" is the learner's own, so a hand-added
        // card in the repo is never mistaken for a starter and bulk-cleared.
        source: String(c.source) === "seed" ? ("seed" as const) : ("learner" as const),
        created,
        updated: c.updated == null ? created : isoToDisplayDate(asIsoString(c.updated)),
        ...(strList(c.tags).length ? { tags: strList(c.tags) } : {}),
      };
    });

  return {
    ksb: String(fm.ksb ?? ""),
    cards,
    updated: String(fm.updated ?? ""),
  };
}
