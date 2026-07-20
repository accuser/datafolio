"use client";

import { useSyncExternalStore } from "react";
import {
  applyThemePref,
  getThemePref,
  getThemePrefOnServer,
  subscribeTheme,
  type ThemePref,
} from "@/lib/theme";
import { Monitor, Moon, Sun } from "./icons";

const OPTIONS: { pref: ThemePref; label: string; Icon: typeof Sun }[] = [
  { pref: "system", label: "System", Icon: Monitor },
  { pref: "light", label: "Light", Icon: Sun },
  { pref: "dark", label: "Dark", Icon: Moon },
];

/**
 * Three-state colour-scheme control: System / Light / Dark.
 *
 * "System" is a real option rather than the absence of one — a two-state toggle
 * can't get back to following the OS once it has been touched.
 *
 * The scheme is already on the document before this mounts (an inline script in
 * the layout replays the stored choice), so this reads that element as an
 * external store rather than holding its own copy. That also keeps the control
 * honest if another tab changes the preference.
 */
export function ThemeToggle() {
  const pref = useSyncExternalStore(
    subscribeTheme,
    getThemePref,
    getThemePrefOnServer,
  );

  return (
    <div role="group" aria-label="Colour scheme" className="theme-toggle">
      {OPTIONS.map(({ pref: p, label, Icon }) => (
        <button
          key={p}
          type="button"
          aria-pressed={pref === p}
          title={`${label} theme`}
          className="theme-toggle__option"
          onClick={() => applyThemePref(p)}
        >
          <Icon size={14} />
          <span className="sr-only">{label} theme</span>
        </button>
      ))}
    </div>
  );
}
