"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/** A div that merges `hoverStyle` over `style` while hovered — used for the
 *  KSB rows, repo folder rows and coverage rows that brighten on hover. */
export function HoverDiv({
  style,
  hoverStyle,
  onClick,
  children,
  title,
}: {
  style: CSSProperties;
  hoverStyle: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
  title?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={hover ? { ...style, ...hoverStyle } : style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      title={title}
    >
      {children}
    </div>
  );
}
