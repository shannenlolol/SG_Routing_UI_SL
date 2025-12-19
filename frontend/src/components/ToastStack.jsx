// src/components/ToastStack.jsx
import React from "react";

export default function ToastStack({ toasts }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex w-[340px] max-w-[90vw] flex-col gap-2">
      {toasts.map((t) => {
        const toneClass =
          t.tone === "good"
            ? "border-green-200 bg-green-50 text-green-900"
            : t.tone === "warn"
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-red-200 bg-red-50 text-red-900";

        return (
          <div key={t.id} className={`rounded-xl border p-3 text-sm shadow-sm ${toneClass}`}>
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
