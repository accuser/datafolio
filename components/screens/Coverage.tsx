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
import { InlineCode, LoadingState, Pill } from "../ui";

export function Coverage() {
  const { state } = useApp();
  const { evidence, standard, loading } = state;

  if (loading) return <LoadingState label="Loading the coverage matrix…" />;

  return (
    <div className="screen screen--table">
      <h1 className="screen-title">Coverage matrix</h1>
      <p className="screen-intro screen-intro--wide">
        Generated from each folder&apos;s <InlineCode>index.md</InlineCode> front-matter by{" "}
        <InlineCode>scripts/build_coverage.py</InlineCode> on every push, and committed back as{" "}
        <InlineCode>COVERAGE.md</InlineCode>.
      </p>

      {/* The table is wider than a phone, so it scrolls. A scroll container has
          to be focusable or keyboard-only users can't pan it. */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Coverage matrix"
        className="table-scroll cov-scroll"
      >
        <table className="cov-table">
          <caption className="sr-only">
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
                        className="cov-code"
                      >
                        {k.id}
                      </Link>
                    </th>
                    <td className="cov-statement">{k.short}</td>
                    <td>
                      <span className="cov-methods">
                        {methods.map((mm) => (
                          <Pill key={mm.key} bg={mm.bg} fg={mm.fg}>
                            {mm.abbr}
                          </Pill>
                        ))}
                      </span>
                    </td>
                    <td className="num cov-num--strong">
                      {n}
                    </td>
                    <td className="num mono">
                      {needed.length ? `${cov}/${needed.length}` : "—"}
                    </td>
                    <td>
                      <Pill tone={m.tone}>
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
                        <th scope="row" className="mono">
                          {p.id}
                        </th>
                        <td className="cov-subtext">{p.text}</td>
                        <td>
                          <span className="cov-methods">
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
                            <Pill tone={psm.tone}>
                              {psm.label}
                            </Pill>
                          ) : (
                            <span className="cov-notreq">Not required</span>
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

      <div className="grid-2 coverage-panels">
        <div className="card schema-card">
          <div className="schema-card__title">Front-matter schema</div>
          <div className="schema-card__body">
            <div>
              <SchemaCode>ksb</SchemaCode> · <SchemaCode>type</SchemaCode> ·{" "}
              <SchemaCode>title</SchemaCode> · <SchemaCode>methods[]</SchemaCode> ·{" "}
              <SchemaCode>status</SchemaCode>
            </div>
            <div className="schema-card__row">
              <SchemaCode>subpoints[]</SchemaCode> —{" "}
              <span className="t-muted">id, methods[], covered</span>
            </div>
            <div>
              <SchemaCode>evidence[]</SchemaCode> —{" "}
              <span className="t-muted">id, title, type, ref/file, maps[], status, date, feedback</span>
            </div>
            <div className="schema-card__row">
              <SchemaCode>updated</SchemaCode>
            </div>
          </div>
          <div className="schema-card__hint">
            Open any folder&apos;s <span className="mono">index.md</span> in the Repository
            tab to preview the generated file.
          </div>
        </div>

        <div className="on-dark panel-dark code-panel">
          <div className="code-panel__label" id="build-coverage-label">
            scripts/build_coverage.py
          </div>
          {/* A focusable scroll container needs a name, the same way the
              coverage matrix above is named — its visible label supplies it. */}
          <pre
            tabIndex={0}
            role="region"
            aria-labelledby="build-coverage-label"
            className="code-panel__code"
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
  return <code className="schema-code">{children}</code>;
}
