"use client";

import { useApp } from "@/lib/state";
import { KSBS } from "@/lib/ksbs";
import { evFor, evForPoint, ksbStatusKey, routeMeta, statusMeta } from "@/lib/domain";
import { InlineCode, Pill, mono } from "../ui";
import { HoverDiv } from "../Hover";

const GRID = "64px 1fr 150px 90px 110px 150px";

export function Coverage() {
  const { state, actions } = useApp();
  const { evidence } = state;

  return (
    <div style={{ padding: "28px 0 64px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 4px" }}>
        Coverage matrix
      </h1>
      <p style={{ fontSize: 14, color: "#71717a", margin: "0 0 22px", maxWidth: 720, lineHeight: 1.55 }}>
        Generated from each folder&apos;s <InlineCode>index.md</InlineCode> front-matter by{" "}
        <InlineCode>scripts/build_coverage.py</InlineCode> on every push, and committed back as{" "}
        <InlineCode>COVERAGE.md</InlineCode>.
      </p>

      <div
        style={{
          border: "1px solid #ececec",
          borderRadius: 14,
          overflow: "hidden",
          background: "#fff",
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            padding: "11px 18px",
            background: "#fafafa",
            borderBottom: "1px solid #ececec",
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#a1a1aa",
          }}
        >
          <div>KSB</div>
          <div>Statement</div>
          <div>Route</div>
          <div style={{ textAlign: "center" }}>Evidence</div>
          <div style={{ textAlign: "center" }}>Sub-pts</div>
          <div>Status</div>
        </div>

        {KSBS.map((k) => {
          const m = statusMeta(ksbStatusKey(evidence, k.id));
          const rm = routeMeta(k.route);
          const n = evFor(evidence, k.id).length;
          const pts = k.points || [];
          const cov = pts.filter((p) => evForPoint(evidence, p.id).length).length;
          return (
            <HoverDiv
              key={k.id}
              onClick={() => actions.openKsb(k.id)}
              ariaLabel={`Open ${k.id}: ${k.short}`}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                alignItems: "center",
                padding: "12px 18px",
                borderBottom: "1px solid #f4f4f5",
                cursor: "pointer",
                fontSize: 13,
              }}
              hoverStyle={{ background: "#fafafa" }}
            >
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4f46e5", fontFamily: mono }}>
                  {k.id}
                </span>
              </div>
              <div style={{ color: "#3f3f46", paddingRight: 14, lineHeight: 1.4 }}>{k.short}</div>
              <div>
                <Pill bg={rm.bg} fg={rm.fg}>
                  {rm.label}
                </Pill>
              </div>
              <div style={{ textAlign: "center", color: "#52525b", fontWeight: 600 }}>{n}</div>
              <div style={{ textAlign: "center", color: "#52525b", fontFamily: mono }}>
                {pts.length ? `${cov}/${pts.length}` : "—"}
              </div>
              <div>
                <Pill bg={m.bg} fg={m.fg}>
                  {m.label}
                </Pill>
              </div>
            </HoverDiv>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #ececec", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Front-matter schema</div>
          <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.7 }}>
            <div>
              <SchemaCode>ksb</SchemaCode> · <SchemaCode>type</SchemaCode> ·{" "}
              <SchemaCode>title</SchemaCode> · <SchemaCode>route</SchemaCode> ·{" "}
              <SchemaCode>status</SchemaCode>
            </div>
            <div style={{ marginTop: 6 }}>
              <SchemaCode>subpoints[]</SchemaCode> —{" "}
              <span style={{ color: "#71717a" }}>id, covered</span>
            </div>
            <div>
              <SchemaCode>evidence[]</SchemaCode> —{" "}
              <span style={{ color: "#71717a" }}>id, title, type, ref/file, maps[], status, date, feedback</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <SchemaCode>updated</SchemaCode>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "#a1a1aa", marginTop: 12, lineHeight: 1.5 }}>
            Open any folder&apos;s <span style={{ fontFamily: mono }}>index.md</span> in the Repository
            tab to preview the generated file.
          </div>
        </div>

        <div style={{ background: "#0f172a", borderRadius: 14, padding: "16px 18px", overflow: "auto" }}>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: 8,
              fontFamily: mono,
            }}
          >
            scripts/build_coverage.py
          </div>
          <pre
            style={{
              margin: 0,
              fontFamily: mono,
              fontSize: 11.5,
              lineHeight: 1.6,
              color: "#cbd5e1",
              whiteSpace: "pre",
            }}
          >
{`for md in evidence/*/index.md:
    fm = parse_front_matter(md)
    rows.append({
        "ksb": fm["ksb"],
        "route": fm["route"],
        "status": fm["status"],
        "evidence": len(fm["evidence"]),
        "subpoints": covered_ratio(fm),
    })
write("COVERAGE.md", render_table(rows))`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function SchemaCode({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: mono, color: "#4338ca" }}>{children}</code>;
}
