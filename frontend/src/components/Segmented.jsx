import React from "react";

export default function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              "rounded-lg px-3 py-1.5 text-sm transition " +
              (active
                ? "bg-slate-300 text-slate-900"
                : "bg-white text-slate-700 hover:bg-slate-100")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
