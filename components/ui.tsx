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
        fontSize: 12.5,
        background: "#f4f4f5",
        padding: "1px 5px",
        borderRadius: 5,
      }}
    >
      {children}
    </code>
  );
}

export const mono = "var(--font-jetbrains-mono), monospace";
