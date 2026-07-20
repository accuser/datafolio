"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useApp } from "@/lib/state";
import { ksbIndex } from "@/lib/standards";
import { genMd } from "@/lib/domain";
import { FileIcon } from "./icons";

export function MdPreview() {
  const { state, actions } = useApp();
  const kid = state.mdPreviewKid;
  const open = !!kid;
  const ksb = kid ? ksbIndex(state.standard)[kid] : undefined;
  const path = kid ? `evidence/${kid}/index.md` : "";
  const text = ksb ? genMd(state.evidence, ksb) : "";

  return (
    <Dialog open={open} onClose={actions.closeMd}>
      <DialogBackdrop className="modal-backdrop" />
      <div className="modal-layer">
        <DialogPanel
          aria-label={path ? `Preview of ${path}` : "File preview"}
          className="on-dark md-preview"
        >
          <div className="md-preview__bar">
            <FileIcon size={15} color="var(--dark-text-muted)" />
            <span className="md-preview__path">{path}</span>
            <span className="md-preview__badge">auto-written</span>
            <span className="row__spacer" />
            <button onClick={actions.closeMd} aria-label="Close preview" className="md-preview__close">
              ×
            </button>
          </div>
          {/* Long lines scroll horizontally; a scroll container that can't take
              focus is unreachable for keyboard-only users. */}
          <pre tabIndex={0} className="md-preview__body">
            {text}
          </pre>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
