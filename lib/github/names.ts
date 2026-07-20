// GitHub's own grammar for the two names we ever accept from a URL.
//
// `/api/auth/login` writes these straight into the session from a GET, and
// SameSite=Lax still sends the session cookie on a top-level cross-site
// navigation — so a malicious page can bounce a victim through the login route
// and pin their session at an owner of its choosing. `canRead` still blocks
// reading anything the victim can't already reach, so this is confusion rather
// than exposure, but there is no reason to persist arbitrary strings.

/** A GitHub login: alphanumeric or hyphen, up to 39 characters. */
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** A repository name: alphanumerics plus `.`, `_` and `-`, up to 100. */
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export function isValidOwner(value: string): boolean {
  return OWNER_RE.test(value);
}

export function isValidRepoName(value: string): boolean {
  // `.` and `..` would resolve as path segments rather than a repo.
  return value !== "." && value !== ".." && REPO_RE.test(value);
}
