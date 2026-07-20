"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useApp } from "@/lib/state";
import {
  collectingPoints,
  evFor,
  evForPoint,
  ksbMethods,
  ksbStatusKey,
  methodMeta,
  pointStatusKey,
  statusMeta,
} from "@/lib/domain";
import { InlineCode, LoadingState, Pill, SR_ONLY, mono } from "../ui";

export function Coverage() {
  const { state } = useApp();
  const { evidence, standard, loading } = state;

  if (loading) return <LoadingState label="Loading the coverage matrix…" />;

  return (
    <div style={{ padding: "28px 0 64px" }}>
      <h1 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 4px" }}>
        Coverage matrix
      </h1>
      <p style={{ fontSize: "0.875rem", color: "#71717a", margin: "0 0 22px", maxWidth: 720, lineHeight: 1.55 }}>
        Generated from each folder&apos;s <InlineCode>index.md</InlineCode> front-matter by{" "}
        <InlineCode>scripts/build_coverage.py</InlineCode> on every push, and committed back as{" "}
        <InlineCode>COVERAGE.md</InlineCode>.
      </p>

      {/* The table is wider than a phone, so it scrolls. A scroll container has
          to be focusable or keyboard-only users can't pan it. */}
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Coverage matrix"
        style={{
          marginBottom: 28,
          border: "1px solid #ececec",
          borderRadius: 14,
          background: "#fff",
        }}
      >
        <table className="cov-table">
          <caption style={SR_ONLY}>
            Every KSB and sub-point in the standard, with how it is assessed, how many
            evidence items it has, and its current status.
          </caption>
          <thead>
            <tr>
              <th scope="col">KSB</th>
              <th scope="col">Statement</th>
              <th scope="col">Assessed by</th>
              <th scope="col" className="num">
                Evidence
              </th>
              <th scope="col" className="num">
                Sub-pts
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {standard.ksbs.map((k) => {
              const m = statusMeta(ksbStatusKey(evidence, k.id));
              const methods = ksbMethods(standard, k);
              const n = evFor(evidence, k.id).length;
              const pts = k.points || [];
              // Ratio is over sub-points that need evidence, not all of them.
              const needed = collectingPoints(standard, k);
              const cov = needed.filter((p) => evForPoint(evidence, p.id).length).length;
              return (
                <Fragment key={k.id}>
                  <tr>
                    <th scope="row">
                      <Link
                        href={`/ksb/${k.id}`}
                        style={{
                          display: "inline-block",
                          padding: "3px 2px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#4f46e5",
                          fontFamily: mono,
                        }}
                      >
                        {k.id}
                      </Link>
                    </th>
                    <td style={{ color: "#3f3f46", lineHeight: 1.4 }}>{k.short}</td>
                    <td>
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {methods.map((mm) => (
                          <Pill key={mm.key} bg={mm.bg} fg={mm.fg}>
                            {mm.abbr}
                          </Pill>
                        ))}
                      </span>
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {n}
                    </td>
                    <td className="num" style={{ fontFamily: mono }}>
                      {needed.length ? `${cov}/${needed.length}` : "—"}
                    </td>
                    <td>
                      <Pill bg={m.bg} fg={m.fg}>
                        {m.label}
                      </Pill>
                    </td>
                  </tr>

                  {/* Sub-points are always shown here: this is the audit view, and a
                      parent's "Assessed by" cell can't stand in for them — K3 is
                      professional discussion, but only K3.3 of its three is. */}
                  {pts.map((p) => {
                    const pMethods = p.methods.map((mk) => methodMeta(standard, mk));
                    const collects = pMethods.some((mm) => mm.collectsEvidence);
                    const pn = evForPoint(evidence, p.id).length;
                    const psm = statusMeta(pointStatusKey(evidence, p.id));
                    return (
                      <tr key={p.id} className="subpoint">
                        <th scope="row" style={{ fontFamily: mono, fontWeight: 400 }}>
                          {p.id}
                        </th>
                        <td style={{ lineHeight: 1.4 }}>{p.text}</td>
                        <td>
                          <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {pMethods.map((mm) => (
                              <Pill key={mm.key} bg={mm.bg} fg={mm.fg}>
                                {mm.abbr}
                              </Pill>
                            ))}
                          </span>
                        </td>
                        <td className="num">{collects ? pn : "—"}</td>
                        <td className="num">—</td>
                        <td>
                          {collects ? (
                            <Pill bg={psm.bg} fg={psm.fg}>
                              {psm.label}
                            </Pill>
                          ) : (
                            <span style={{ fontSize: "0.75rem" }}>Not required</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid-2" style={{ display: "grid", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #ececec", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: 10 }}>Front-matter schema</div>
          <div style={{ fontSize: "0.8125rem", color: "#52525b", lineHeight: 1.7 }}>
            <div>
              <SchemaCode>ksb</SchemaCode> · <SchemaCode>type</SchemaCode> ·{" "}
              <SchemaCode>title</SchemaCode> · <SchemaCode>methods[]</SchemaCode> ·{" "}
              <SchemaCode>status</SchemaCode>
            </div>
            <div style={{ marginTop: 6 }}>
              <SchemaCode>subpoints[]</SchemaCode> —{" "}
              <span style={{ color: "#71717a" }}>id, methods[], covered</span>
            </div>
            <div>
              <SchemaCode>evidence[]</SchemaCode> —{" "}
              <span style={{ color: "#71717a" }}>id, title, type, ref/file, maps[], status, date, feedback</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <SchemaCode>updated</SchemaCode>
            </div>
          </div>
          <div style={{ fontSize: "0.8125rem", color: "#71717a", marginTop: 12, lineHeight: 1.5 }}>
            Open any folder&apos;s <span style={{ fontFamily: mono }}>index.md</span> in the Repository
            tab to preview the generated file.
          </div>
        </div>

        <div
          className="on-dark"
          style={{ background: "#0f172a", borderRadius: 14, padding: "16px 18px", overflow: "auto" }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: "#94a3b8",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: 8,
              fontFamily: mono,
            }}
          >
            scripts/build_coverage.py
          </div>
          <pre
            tabIndex={0}
            style={{
              margin: 0,
              fontFamily: mono,
              fontSize: "0.75rem",
              lineHeight: 1.6,
              color: "#cbd5e1",
              whiteSpace: "pre",
              overflow: "auto",
            }}
          >
{`for md in evidence/*/index.md:
    fm = parse_front_matter(md)
    rows.append({
        "ksb": fm["ksb"],
        "methods": fm["methods"],
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
