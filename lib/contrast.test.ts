// Asserts the design tokens in app/globals.css meet WCAG AA, in both schemes.
//
// Why a test and not a review step: this exact class of defect — a foreground
// token paired with a surface it doesn't quite clear — shipped past manual
// review three times (nav tabs, role tabs, the theme toggle), each time at
// 4.40:1 against 4.5. It is also invisible to a rendered audit unless the
// element happens to be on screen: white-on-green for the Approve button sat at
// 3.30:1 and was missed by every browser sweep, because that button only
// renders for a reviewer looking at a submitted item.
//
// Reading the palette directly catches both, and costs nothing to run.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const AA_TEXT = 4.5;
/** WCAG 2.2 non-text contrast, for UI indicators like the focus ring. */
const AA_NON_TEXT = 3;

// ---- Parse -----------------------------------------------------------------

type Scheme = "light" | "dark";

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
const rootBlock = /^:root \{([\s\S]*?)^\}/m.exec(css);
assert.ok(rootBlock, "could not find the :root token block in app/globals.css");

const tokens = new Map<string, Record<Scheme, string>>();
for (const m of rootBlock[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
  const [, name, raw] = m;
  const value = raw.trim();
  const pair = /^light-dark\(\s*([\s\S]+?)\s*,\s*([\s\S]+?)\s*\)$/.exec(value);
  tokens.set(
    name,
    pair ? { light: pair[1], dark: pair[2] } : { light: value, dark: value },
  );
}
assert.ok(tokens.size > 50, `expected a full palette, parsed ${tokens.size} tokens`);

// ---- Colour ----------------------------------------------------------------

type Rgb = [number, number, number];

function parseColour(input: string): Rgb | null {
  const c = input.trim();
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const full = hex.length === 3 ? [...hex].map((ch) => ch + ch).join("") : hex;
    if (full.length !== 6) return null;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(c);
  if (!fn) return null;
  const parts = fn[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
  return parts.slice(0, 3) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function colourOf(name: string, scheme: Scheme): Rgb {
  const t = tokens.get(name);
  // A missing token means a rename silently dropped a check — louder than a skip.
  assert.ok(t, `token ${name} is checked here but not defined in globals.css`);
  const c = parseColour(t[scheme]);
  assert.ok(c, `token ${name} (${scheme}) is not a plain colour: ${t[scheme]}`);
  return c;
}

// ---- Pairings --------------------------------------------------------------

interface Pair {
  fg: string;
  bg: string;
  min: number;
  why: string;
}

const names = [...tokens.keys()];
const pairs: Pair[] = [];

// Any text token may end up on any surface, so guarantee the whole matrix
// rather than the combinations that happen to exist today. This is what makes
// "muted text on a muted surface" safe to write without checking.
const textTokens = names.filter((n) => /^--text(-|$)/.test(n));
const surfaceTokens = names.filter((n) => /^--surface(-|$)/.test(n));
assert.ok(textTokens.length && surfaceTokens.length, "no text/surface tokens found");
for (const fg of textTokens) {
  for (const bg of surfaceTokens) {
    pairs.push({ fg, bg, min: AA_TEXT, why: "body text on a surface" });
  }
}

// Auto-discovered families: every `--x-fg` implies `--x-bg`. Adding a new tone,
// evidence type or category is covered without touching this file.
for (const fg of names.filter((n) => n.endsWith("-fg"))) {
  const bg = fg.replace(/-fg$/, "-bg");
  if (tokens.has(bg)) {
    pairs.push({ fg, bg, min: AA_TEXT, why: "named tone pairing" });
  }
}

// Same trick for the feedback banners: `--x-text` sits on `--x-tint`.
for (const fg of names.filter((n) => n.endsWith("-text"))) {
  const bg = fg.replace(/-text$/, "-tint");
  if (tokens.has(bg)) {
    pairs.push({ fg, bg, min: AA_TEXT, why: "feedback banner" });
  }
}

// Pairings whose names don't encode the relationship.
const explicit: [string, string, string][] = [
  ["--on-accent", "--accent", "label on a filled accent control"],
  ["--on-success", "--success", "label on the Approve button"],
  ["--on-danger", "--danger-strong", "label on the destructive button"],
  ["--invert-fg", "--invert-bg", "skip link and GitHub button"],
  ["--on-dark-panel", "--dark-surface-alt", "sign-in hero"],
  ["--dark-text", "--dark-surface", "code preview body"],
  ["--dark-text-strong", "--dark-surface", "code preview heading"],
  ["--dark-text-muted", "--dark-surface", "code preview caption"],
  ["--dark-hero-text", "--dark-surface-alt", "sign-in hero body"],
  ["--dark-hero-muted", "--dark-surface-alt", "sign-in hero stats"],
  ["--accent", "--accent-tint", "active nav tab"],
  ["--accent-deep", "--accent-tint", "selected method chip"],
  ["--accent-strong", "--accent-tint", "KSB code badge"],
  ["--md-badge-fg", "--md-badge-bg", "markdown file badge"],
];
for (const [fg, bg, why] of explicit) pairs.push({ fg, bg, min: AA_TEXT, why });

// The focus ring is a UI indicator, so 3:1 against whatever it sits on.
for (const bg of surfaceTokens) {
  pairs.push({ fg: "--accent", bg, min: AA_NON_TEXT, why: "focus ring on a surface" });
}

// ---- Assert ----------------------------------------------------------------

const failures: string[] = [];
for (const scheme of ["light", "dark"] as Scheme[]) {
  for (const { fg, bg, min, why } of pairs) {
    const ratio = contrast(colourOf(fg, scheme), colourOf(bg, scheme));
    if (ratio + 1e-9 < min) {
      failures.push(
        `  ${scheme}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (needs ${min}) — ${why}`,
      );
    }
  }
}

assert.equal(
  failures.length,
  0,
  `${failures.length} token pairing(s) below WCAG AA:\n${failures.join("\n")}\n\n` +
    `Fix the palette in app/globals.css rather than the component: these tokens\n` +
    `are reused, so a pairing that fails here fails everywhere it is written.`,
);

console.log(
  `contrast.test.ts: ok — ${pairs.length} pairings × 2 schemes, all ≥ AA`,
);
