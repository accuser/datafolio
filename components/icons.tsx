import type { CSSProperties } from "react";

// Inline SVG icon set ported from the prototype. Swap for the codebase's own
// icon library if it has one; the shapes are standard (Lucide-style) glyphs.
// Every icon is decorative (it sits beside a text label), so all are marked
// aria-hidden / non-focusable — screen readers announce the adjacent text.

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
}

const a11y = { "aria-hidden": true, focusable: "false" } as const;

export function GithubMark({ size = 20, color = "currentColor", style }: IconProps) {
  return (
    <svg {...a11y} width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function Lock({ size = 16, color = "#71717a", strokeWidth = 2, style }: IconProps) {
  return (
    <svg
      {...a11y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      style={{ flexShrink: 0, ...style }}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function LogOut({ size = 16, color = "currentColor", strokeWidth = 2, style }: IconProps) {
  return (
    <svg
      {...a11y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function ChevronRight({ size = 17, color = "#d4d4d8", strokeWidth = 2, style }: IconProps) {
  return (
    <svg
      {...a11y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      style={{ flexShrink: 0, ...style }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronLeft({ size = 15, color = "currentColor", strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...a11y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function LinkIcon({ size = 14, color = "currentColor", strokeWidth = 2, style }: IconProps) {
  return (
    <svg
      {...a11y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      style={{ flexShrink: 0, ...style }}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function FileIcon({ size = 15, color = "#a1a1aa", strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...a11y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function FolderIcon({ size = 16, color = "#6366f1", style }: IconProps) {
  return (
    <svg {...a11y} width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" style={style}>
      <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
    </svg>
  );
}

export function UploadCloud({ size = 26, color = "#a1a1aa", strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...a11y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

export function Check({ size = 15, color = "currentColor", strokeWidth = 2.4, style }: IconProps) {
  return (
    <svg {...a11y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function Plus({ size = 16, color = "currentColor", strokeWidth = 2.4, style }: IconProps) {
  return (
    <svg {...a11y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function CheckBadge({ size = 17, color = "#1d4ed8", strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...a11y} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} style={style}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
