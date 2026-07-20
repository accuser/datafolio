// Compile `standards/*.yaml` into lib/standards/generated.ts.
//
// The generated module is checked in and imported by the app. We codegen rather
// than read YAML at runtime because the app deploys to Cloudflare Workers, where
// there is no filesystem on the request path — and because it keeps the standards
// fully type-checked by tsc.
//
//   npm run standards:build     regenerate
//   npm run standards:check     verify the checked-in file is current (CI)

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseStandard } from "../lib/standards/parse";
import type { Standard } from "../lib/standards/types";

const ROOT = resolve(__dirname, "..");
const SRC_DIR = join(ROOT, "standards");
const OUT_FILE = join(ROOT, "lib", "standards", "generated.ts");

function build(): string {
  const files = readdirSync(SRC_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  if (files.length === 0)
    throw new Error(`No standards found in ${SRC_DIR}`);

  const standards: Standard[] = files.map((f) =>
    parseStandard(readFileSync(join(SRC_DIR, f), "utf8"), `standards/${f}`),
  );

  const byId = new Map<string, string>();
  for (const [i, s] of standards.entries()) {
    const prev = byId.get(s.id);
    if (prev)
      throw new Error(
        `Duplicate standard id "${s.id}" in ${prev} and standards/${files[i]}`,
      );
    byId.set(s.id, `standards/${files[i]}`);
  }

  const entries = standards
    .map((s) => `  ${JSON.stringify(s.id)}: ${JSON.stringify(s, null, 2)},`)
    .join("\n");

  return `// GENERATED FILE — DO NOT EDIT.
//
// Compiled from standards/*.yaml by scripts/build-standards.ts.
// Edit the YAML and run \`npm run standards:build\`.

import type { Standard } from "./types";

export const STANDARD_IDS = [
${standards.map((s) => `  ${JSON.stringify(s.id)},`).join("\n")}
] as const;

export type StandardId = (typeof STANDARD_IDS)[number];

export const STANDARDS: Record<string, Standard> = {
${entries}
};
`;
}

const generated = build();
const check = process.argv.includes("--check");

if (check) {
  let current: string;
  try {
    current = readFileSync(OUT_FILE, "utf8");
  } catch {
    console.error(
      `${OUT_FILE} is missing. Run \`npm run standards:build\` and commit the result.`,
    );
    process.exit(1);
  }
  if (current !== generated) {
    console.error(
      "lib/standards/generated.ts is out of date with standards/*.yaml.\n" +
        "Run `npm run standards:build` and commit the result.",
    );
    process.exit(1);
  }
  console.log("standards: generated.ts is up to date");
} else {
  writeFileSync(OUT_FILE, generated);
  console.log(`standards: wrote ${OUT_FILE}`);
}
