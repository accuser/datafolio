"use client";

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
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
        {/* The accessible name has to come from a DialogTitle in Headless UI's
            registry: an aria-label on DialogPanel lands on a plain <div>, not on
            the element carrying role="dialog", so the dialog announced only as
            "dialog" with no context. The path is that title. */}
        <DialogPanel className="on-dark md-preview">
          <div className="md-preview__bar">
            <FileIcon size={15} color="var(--dark-text-muted)" />
            <DialogTitle as="span" className="md-preview__path">
              {path}
            </DialogTitle>
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
