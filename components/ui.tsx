import type { CSSProperties, ReactNode } from "react";
import { pill } from "@/lib/domain";

/** Rounded status/route badge. */
export function Pill({
  bg,
  fg,
  children,
  style,
}: {
  bg: string;
  fg: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <span style={{ ...pill(bg, fg), ...style }}>{children}</span>;
}

/** Inline `code` chip used in prose (mono, muted background). */
export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--font-jetbrains-mono), monospace",
        fontSize: "0.8125rem",
        background: "#f4f4f5",
        // Explicit, not inherited: these chips sit inside muted #71717a prose,
        // which would only reach 4.4:1 against the chip's own grey.
        color: "#3f3f46",
        padding: "1px 5px",
        borderRadius: 5,
      }}
    >
      {children}
    </code>
  );
}

export const mono = "var(--font-jetbrains-mono), monospace";

/**
 * Shown while the portfolio is loading from the repo. Without it these screens
 * paint real-looking zeroes ("0 of 19 approved", every KSB "Not started", an
 * empty repo tree) before the data lands, which reads as data loss.
 */
export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "80px 0",
        color: "#71717a",
        fontSize: "0.875rem",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 9999,
          border: "2px solid #e4e4e7",
          borderTopColor: "#4f46e5",
          animation: "df-spin .7s linear infinite",
        }}
      />
      {label}
    </div>
  );
}

/** Visually hidden, still announced — for live regions and off-screen labels. */
export const SR_ONLY: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
};
