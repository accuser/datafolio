import type { CSSProperties, ReactNode } from "react";

/**
 * Rounded status/route badge. The tone arrives as custom properties rather than
 * a modifier class because some pills are coloured by the standard's own config
 * (each assessment method carries its own pair), which we can't enumerate here.
 */
export function Pill({
  bg,
  fg,
  children,
  className,
}: {
  bg: string;
  fg: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={className ? `pill ${className}` : "pill"}
      style={{ "--pill-bg": bg, "--pill-fg": fg } as CSSProperties}
    >
      {children}
    </span>
  );
}

/** Inline `code` chip used in prose (mono, muted background). */
export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="inline-code">{children}</code>;
}

/**
 * Shown while the portfolio is loading from the repo. Without it these screens
 * paint real-looking zeroes ("0 of 19 approved", every KSB "Not started", an
 * empty repo tree) before the data lands, which reads as data loss.
 */
export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="loading-state">
      <span aria-hidden="true" className="spinner" />
      {label}
    </div>
  );
}

export const mono = "var(--font-jetbrains-mono), monospace";
