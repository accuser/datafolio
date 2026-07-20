/**
 * Colour-scheme preference.
 *
 * "system" is the absence of a choice, not a third palette: it stores nothing
 * and leaves `data-theme` off the root, so the `color-scheme: light dark`
 * default in globals.css follows the OS with no JavaScript involved. That also
 * means it keeps tracking the OS live, without a matchMedia listener.
 *
 * The document element is the source of truth — an inline script sets it before
 * first paint — and this module exposes it as an external store so React reads
 * it rather than keeping a second copy that could drift.
 */
export type ThemePref = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "datafolio:theme";

export const THEME_PREFS: ThemePref[] = ["system", "light", "dark"];

function isPref(v: unknown): v is ThemePref {
  return v === "system" || v === "light" || v === "dark";
}

const listeners = new Set<() => void>();

function write(pref: ThemePref): void {
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", pref);
  }
}

/** Apply a preference to the document, persist it, and notify subscribers. */
export function applyThemePref(pref: ThemePref): void {
  write(pref);
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Private mode or blocked storage: the choice still applies to this page.
  }
  listeners.forEach((l) => l());
}

/** Read the live preference off the document. */
export function getThemePref(): ThemePref {
  const attr = document.documentElement.getAttribute("data-theme");
  return isPref(attr) ? attr : "system";
}

/** The server can't know a stored choice, so it always renders the default. */
export function getThemePrefOnServer(): ThemePref {
  return "system";
}

export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  // A change in another tab should land here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    write(isPref(e.newValue) ? e.newValue : "system");
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Runs before first paint, inlined into <head>, so a stored choice is on the
 * root element before anything renders. Kept tiny and self-contained because it
 * is serialised into the document — it can't import from here.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
