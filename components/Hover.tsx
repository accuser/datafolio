"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * A card/row that brightens on hover — used for the KSB rows, repo folder rows
 * and coverage rows. When given an `onClick` it renders as a real `<button>` so
 * keyboard and screen-reader users can activate it (Enter/Space, focusable,
 * announced as a button); the hover style also applies on keyboard focus.
 */
export function HoverDiv({
  style,
  hoverStyle,
  onClick,
  children,
  title,
  ariaLabel,
}: {
  style: CSSProperties;
  hoverStyle: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
}) {
  const [active, setActive] = useState(false);
  const merged = active ? { ...style, ...hoverStyle } : style;

  if (onClick) {
    return (
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        onClick={onClick}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        style={{
          font: "inherit",
          color: "inherit",
          textAlign: "left",
          appearance: "none",
          width: "100%",
          ...merged,
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <div style={merged} title={title}>
      {children}
    </div>
  );
}
