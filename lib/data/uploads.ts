// Upload constraints shared by the client (early feedback) and the server
// (the enforced boundary). No server-only imports — safe in the browser.

export const MAX_UPLOAD_MB = 5;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Approximate decoded byte length of a base64 string (ignores padding). */
export function base64Bytes(b64: string): number {
  const len = b64.length;
  if (!len) return 0;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Reduce a client-supplied filename to a safe basename that can be used
 * verbatim as a git tree path segment:
 *   - strip any directory part (`a/b/c.pdf` → `c.pdf`), so no `/` in the path
 *   - allow only `[A-Za-z0-9._-]`; collapse every other run to a single `_`
 *   - drop leading dots (no hidden files / `..` traversal) and edge separators
 *   - never collide with the generated `index.md`
 *   - cap the length, preserving the extension
 */
export function sanitizeFileName(raw: string): string {
  const base = String(raw ?? "").split(/[\\/]/).pop() ?? "";
  let name = base
    .replace(/[^A-Za-z0-9._-]+/g, "_") // collapse runs of disallowed chars
    .replace(/^\.+/, "") // no leading dots (hidden files / traversal)
    .replace(/_{2,}/g, "_") // collapse underscores
    .replace(/^[._-]+|[._-]+$/g, ""); // trim separators at the ends

  if (name.length > 100) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot) : "";
    name = name.slice(0, 100 - ext.length) + ext;
  }
  if (!name) name = "upload";
  if (name.toLowerCase() === "index.md") name = "file-" + name;
  return name;
}
