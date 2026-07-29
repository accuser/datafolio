"use client";

import { useEffect, useState } from "react";

/**
 * Read a query parameter once, then strip it from the URL.
 *
 * For one-shot signals the server redirects back with (`?auth=<reason>` from a
 * failed OAuth callback, `?portfolios=truncated-N` from sign-in): the value is
 * captured on first render and kept for this component's lifetime, while the
 * URL is cleaned so a refresh or a copied link doesn't replay a stale notice.
 *
 * The read happens in a lazy `useState` initialiser, not an effect — there is
 * deliberately no post-mount `setState` (see react-hooks/set-state-in-effect).
 * That's safe from hydration mismatch here because every caller renders only
 * after a client-side check settles (session restore), so it is never part of
 * server-rendered HTML.
 */
export function useConsumedSearchParam(name: string): string | null {
  const [value] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(name);
  });

  useEffect(() => {
    if (value === null) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(name) === null) return;
    params.delete(name);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );
  }, [name, value]);

  return value;
}
