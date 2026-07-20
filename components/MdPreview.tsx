"use client";

import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { useApp } from "@/lib/state";
import { ksbIndex } from "@/lib/standards";
import { genMd } from "@/lib/domain";
import { mono } from "./ui";
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
      <DialogBackdrop style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 50 }} />
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          zIndex: 51,
        }}
      >
        <DialogPanel
          aria-label={path ? `Preview of ${path}` : "File preview"}
          style={{
            width: "100%",
            maxWidth: 720,
            maxHeight: "82vh",
            background: "#0f172a",
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 24px 60px rgba(0,0,0,.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              borderBottom: "1px solid #1e293b",
            }}
          >
            <FileIcon size={15} color="#64748b" />
            <span style={{ fontFamily: mono, fontSize: 13, color: "#e2e8f0" }}>{path}</span>
            <span
              style={{
                fontSize: 11,
                color: "#64748b",
                background: "#1e293b",
                borderRadius: 6,
                padding: "2px 8px",
              }}
            >
              auto-written
            </span>
            <span style={{ flex: 1 }} />
            <button
              onClick={actions.closeMd}
              aria-label="Close preview"
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                fontSize: 20,
                lineHeight: 1,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ×
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "18px 20px",
              overflow: "auto",
              fontFamily: mono,
              fontSize: 12.5,
              lineHeight: 1.65,
              color: "#cbd5e1",
              whiteSpace: "pre",
            }}
          >
            {text}
          </pre>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
