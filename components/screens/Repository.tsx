"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/state";
import { evFor, ksbStatusKey, statusMeta } from "@/lib/domain";
import { InlineCode, LoadingState, Pill } from "../ui";
import { FileIcon, FolderIcon, GithubMark } from "../icons";

export function Repository() {
  const { state, user, actions } = useApp();
  const { evidence, openFolders, standard, loading } = state;
  // `?open=K1` lets other screens link straight to an expanded folder, so the
  // "Repository folder" card is a real link rather than a state-then-navigate
  // button. Toggling from here still wins, hence the explicit `??`.
  const linkedOpen = useSearchParams().get("open");

  const withEv = standard.ksbs.filter((k) => evFor(evidence, k.id).length);

  if (loading) return <LoadingState label="Loading the repository…" />;

  return (
    <div className="screen screen--table">
      <h1 className="screen-title">Repository</h1>
      <p className="screen-intro">
        Every evidence item is committed to a folder for its KSB. Uploaded files sit alongside an{" "}
        <InlineCode>index.md</InlineCode> that logs each entry.
      </p>

      <div className="repo-tree">
        <div className="repo-tree__header">
          <GithubMark size={14} color="currentColor" />
          {/* The owner is whose repo is open, not who is signed in — for a
              reviewer those differ, and pairing their own login with the
              learner's repo name rendered a path that doesn't exist. */}
          {state.target?.owner ?? user.login}/{state.target?.repo ?? user.repo}
        </div>

        <div className="repo-tree__body">
          <div className="repo-tree__static">
            <FileIcon size={15} />
            README.md <span className="t-muted">— portfolio overview &amp; KSB index</span>
          </div>
          <div className="repo-tree__static repo-tree__static--strong">
            <FolderIcon size={16} />
            evidence/
          </div>

          {withEv.map((k) => {
            const items = evFor(evidence, k.id);
            const m = statusMeta(ksbStatusKey(evidence, k.id));
            const open = openFolders[k.id] ?? linkedOpen === k.id;
            const uploads = items.filter((e) => e.type === "upload");
            const fileCount = 1 + uploads.length;
            return (
              <div key={k.id}>
                <button
                  type="button"
                  onClick={() => actions.setFolderOpen(k.id, !open)}
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} the evidence/${k.id} folder`}
                  className="row row--tint folder-row"
                >
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    width={12}
                    height={12}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth={2.4}
                    className="folder-row__caret"
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                  <FolderIcon size={16} />
                  <span className="folder-row__name">evidence/{k.id}/</span>
                  <Pill tone={m.tone}>
                    {m.label}
                  </Pill>
                  <span className="row__spacer" />
                  <span className="folder-row__count">
                    {fileCount} file{fileCount === 1 ? "" : "s"}
                  </span>
                </button>

                {open && (
                  <div className="folder-contents">
                    <button
                      type="button"
                      onClick={() => actions.openMd(k.id)}
                      aria-label={`Preview evidence/${k.id}/index.md`}
                      className="row row--tint file-row"
                    >
                      <span className="file-row__badge file-row__badge--md">M↓</span>
                      index.md
                      <span className="file-row__aside">
                        — {items.length} entr{items.length === 1 ? "y" : "ies"}
                      </span>
                      <span className="row__spacer" />
                      <span className="file-row__view">view →</span>
                    </button>

                    {uploads.map((u) => (
                      <div key={u.id} className="file-row file-row--static">
                        <span className="file-row__badge file-row__badge--upload">▤</span>
                        {u.fileName}
                      </div>
                    ))}

                    <div className="folder-contents__footer">
                      <Link href={`/ksb/${k.id}`} className="folder-contents__link">
                        Open evidence/{k.id} in DataFolio →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {withEv.length === 0 && (
            <div className="repo-tree__empty">
              No evidence committed yet — add your first item from any KSB.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
