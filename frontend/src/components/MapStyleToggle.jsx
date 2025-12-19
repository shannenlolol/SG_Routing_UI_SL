import React from "react";

export default function MapStyleToggle({ value, onChange }) {
  const options = [
    { value: "standard", label: "Standard" },
    { value: "light", label: "Light" },
  ];

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
              (active ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
