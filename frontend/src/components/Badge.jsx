import React from "react";

export default function Badge({ tone = "neutral", children }) {
  const toneClass =
    tone === "good"
      ? "bg-green-100 text-green-800 border-green-200"
      : tone === "warn"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : tone === "bad"
          ? "bg-red-100 text-red-800 border-red-200"
          : "bg-slate-100 text-slate-800 border-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-sm ${toneClass}`}>
      {children}
    </span>
  );
}
