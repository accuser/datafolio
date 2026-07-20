"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * A card/row that brightens on hover — used for the KSB rows, repo folder rows
 * and coverage rows. The hover style also applies on keyboard focus.
 *
 * Pass `href` when the row navigates: it renders a real `<a>` so the row can be
 * opened in a new tab, its URL previewed on hover and copied from the context
 * menu, and screen readers announce it as a link. Pass `onClick` only for rows
 * that act on the current page (expand a folder, open a dialog) — those render
 * as a `<button>`. Without either it's a plain `<div>`.
 */
export function HoverDiv({
  style,
  hoverStyle,
  href,
  onClick,
  children,
  title,
  ariaLabel,
}: {
  style: CSSProperties;
  hoverStyle: CSSProperties;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
}) {
  const [active, setActive] = useState(false);
  const merged = active ? { ...style, ...hoverStyle } : style;

  const interactive = {
    title,
    "aria-label": ariaLabel,
    onMouseEnter: () => setActive(true),
    onMouseLeave: () => setActive(false),
    onFocus: () => setActive(true),
    onBlur: () => setActive(false),
    style: {
      font: "inherit",
      color: "inherit",
      textAlign: "left" as const,
      appearance: "none" as const,
      width: "100%",
      ...merged,
    },
  };

  if (href) {
    return (
      <Link href={href} {...interactive}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} {...interactive}>
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
