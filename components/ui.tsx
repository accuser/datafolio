import type { CSSProperties, ReactNode } from "react";

/**
 * Rounded status/route badge, in one of two flavours.
 *
 * `tone` names a pairing defined in CSS, so it can differ between the light and
 * dark schemes. `bg`/`fg` pass literal colours through for the pills we don't
 * own — each assessment method carries its own pair in the standard's config,
 * so that set can't be enumerated as classes; `.pill--data` adapts those for
 * dark mode instead.
 */
export function Pill(
  props: { children: ReactNode } & (
    | { tone: string; bg?: never; fg?: never }
    | { bg: string; fg: string; tone?: never }
  ),
) {
  const { children } = props;
  if (props.tone) {
    return <span className={`pill pill--${props.tone}`}>{children}</span>;
  }
  return (
    <span
      className="pill pill--data"
      style={{ "--pill-bg": props.bg, "--pill-fg": props.fg } as CSSProperties}
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
