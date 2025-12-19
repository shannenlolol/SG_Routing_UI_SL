// src/components/LoadingOverlay.jsx
import React from "react";

export default function LoadingOverlay({ title, subtitle }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-[520px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{title || "Loading…"}</div>
            {subtitle ? <div className="mt-0.5 text-xs text-slate-600">{subtitle}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
